"""
Module: tests/test_object_store
Layer:  bedrock-api/tests
Desc:   The object-store capability (issue #23) and the S3-compatible backend.

        Two properties matter more than the rest and are asserted first: a
        caller-chosen key comes back exactly as given — an application that
        computed a key and got a different one cannot address its own objects —
        and `list_prefix` follows the continuation token to the end. The second
        is the one that fails silently: a listing that stops at S3's first page
        makes an orphan sweep examine a thousand keys out of forty thousand and
        report a clean bucket.
"""
from __future__ import annotations

import pytest

from bedrock.storage import provider as storage_provider
from bedrock.storage.object_store import (
    ListedObject,
    LocalObjectStore,
    ObjectStore,
    ObjectStoreUnsupported,
    PublicCheck,
    active_object_store,
    as_object_store,
    safe_key,
)
from bedrock.storage.provider import LocalStorageProvider, storage
from bedrock.storage.s3 import S3StorageProvider


# --- key normalisation -----------------------------------------------------


@pytest.mark.parametrize(
    "given,expected",
    [
        ("SKU-1/01.jpg", "SKU-1/01.jpg"),
        ("/leading/slash.jpg", "leading/slash.jpg"),
        ("nested//double.jpg", "nested/double.jpg"),
        ("./relative.jpg", "relative.jpg"),
        ("windows\\sep.jpg", "windows/sep.jpg"),
    ],
)
def test_safe_key_normalises_without_changing_meaning(given, expected):
    assert safe_key(given) == expected


@pytest.mark.parametrize("given", ["", "..", "../../etc/passwd", "c:/windows", "a\x00b"])
def test_safe_key_refuses_what_it_cannot_make_relative(given):
    # Refused rather than rewritten: silently returning a different key is the
    # failure this protocol exists to prevent.
    with pytest.raises(ValueError):
        safe_key(given)


# --- LocalObjectStore ------------------------------------------------------


@pytest.fixture
def local(tmp_path) -> LocalObjectStore:
    return LocalObjectStore(root=tmp_path)


def test_put_honours_the_callers_key_exactly(local, tmp_path):
    stored = local.put("SKU-9/01.jpg", b"bytes")

    assert stored.key == "SKU-9/01.jpg"
    assert (tmp_path / "SKU-9" / "01.jpg").read_bytes() == b"bytes"
    assert stored.size_bytes == 5


def test_put_replaces_what_was_at_that_key(local):
    local.put("a/1.jpg", b"first")
    local.put("a/1.jpg", b"second")

    assert local.path_for("a/1.jpg").read_bytes() == b"second"


def test_put_accepts_http_metadata_a_directory_cannot_hold(local):
    # Accepted and ignored, so the same application code runs here and on S3.
    stored = local.put(
        "a/1.jpg", b"x", content_type="image/jpeg", cache_control="immutable"
    )
    assert stored.key == "a/1.jpg"


def test_put_refuses_a_traversing_key(local, tmp_path):
    with pytest.raises(ValueError):
        local.put("../escaped.jpg", b"x")
    assert not (tmp_path.parent / "escaped.jpg").exists()


def test_list_prefix_finds_nested_keys_and_nothing_else(local):
    local.put("sku-a/01.jpg", b"1")
    local.put("sku-a/02.jpg", b"22")
    local.put("sku-b/01.jpg", b"333")

    assert local.list_prefix("sku-a") == [
        ListedObject(key="sku-a/01.jpg", size_bytes=1),
        ListedObject(key="sku-a/02.jpg", size_bytes=2),
    ]


def test_list_prefix_with_no_prefix_returns_everything(local):
    local.put("a/1.jpg", b"1")
    local.put("b/1.jpg", b"1")

    assert {item.key for item in local.list_prefix("")} == {"a/1.jpg", "b/1.jpg"}


def test_list_prefix_of_an_empty_store_is_empty(tmp_path):
    assert LocalObjectStore(root=tmp_path / "never-created").list_prefix("x") == []


def test_delete_many_counts_what_it_removed(local):
    local.put("a/1.jpg", b"1")
    local.put("a/2.jpg", b"1")

    assert local.delete_many(["a/1.jpg", "a/2.jpg", "a/gone.jpg"]) == 2
    assert local.list_prefix("a") == []


def test_delete_resolves_the_whole_key_not_its_basename(local):
    local.put("a/1.jpg", b"1")

    assert local.delete("a/1.jpg") is True
    assert local.delete("a/1.jpg") is False


def test_verify_public_reports_unsupported_not_failure(local):
    check = local.verify_public("a/1.jpg")

    # Local disk has no public URL by design. Reporting that as a failed check
    # would make a health page red for a correctly configured application.
    assert check.supported is False
    assert check.ok is False


def test_local_object_store_is_still_the_narrow_provider(local):
    # `media_service` calls three methods and must not notice this class.
    assert isinstance(local, LocalStorageProvider)
    stored = local.store(b"x", "front.jpg")
    assert stored.key.endswith(".jpg")
    assert local.url_for(stored.key) is None


# --- capability detection --------------------------------------------------


class _NarrowProvider:
    """A backend that mints its own keys — Cloudflare Images, in miniature."""

    name = "narrow"

    def store(self, data: bytes, filename: str):  # pragma: no cover - never called
        raise NotImplementedError

    def delete(self, key: str) -> bool:  # pragma: no cover - never called
        raise NotImplementedError

    def url_for(self, key: str) -> str | None:  # pragma: no cover - never called
        return None


def test_a_narrow_provider_is_not_an_object_store(local):
    assert as_object_store(_NarrowProvider()) is None
    assert as_object_store(local) is local
    assert isinstance(local, ObjectStore)


def test_active_object_store_names_the_backend_it_refused(monkeypatch):
    monkeypatch.setattr(storage, "active", lambda: _NarrowProvider())

    with pytest.raises(ObjectStoreUnsupported, match="narrow"):
        active_object_store()


def test_the_fallback_backend_is_an_object_store(monkeypatch, tmp_path):
    # The property this whole design turns on: an application built on
    # caller-chosen keys runs on a laptop with nothing configured.
    monkeypatch.setattr(storage_provider.config, "DATA_DIR", str(tmp_path))
    assert isinstance(storage_provider._local_object_store(), ObjectStore)


# --- the S3-compatible backend ---------------------------------------------


class FakeS3Client:
    """Records calls and replays canned `list_objects_v2` pages."""

    def __init__(self, pages: list[dict] | None = None) -> None:
        self.puts: list[dict] = []
        self.deletes: list[dict] = []
        self.list_calls: list[dict] = []
        self.head_bucket_calls = 0
        self._pages = pages or [{"Contents": [], "IsTruncated": False}]

    def put_object(self, **kwargs):
        self.puts.append(kwargs)

    def delete_object(self, **kwargs):
        self.deletes.append(kwargs)

    def delete_objects(self, **kwargs):
        self.deletes.append(kwargs)
        return {"Errors": []}

    def list_objects_v2(self, **kwargs):
        self.list_calls.append(kwargs)
        return self._pages[len(self.list_calls) - 1]

    def head_bucket(self, **kwargs):
        self.head_bucket_calls += 1


@pytest.fixture
def s3_config(monkeypatch):
    from bedrock.core.config import config

    monkeypatch.setattr(config, "S3_BUCKET", "test-bucket", raising=False)
    monkeypatch.setattr(config, "S3_PUBLIC_BASE_URL", "https://cdn.test/", raising=False)
    return config


def _provider(client: FakeS3Client, s3_config) -> S3StorageProvider:
    return S3StorageProvider(client=client)


def test_s3_refuses_to_construct_unconfigured(monkeypatch):
    from bedrock.core.config import config

    monkeypatch.setattr(config, "S3_BUCKET", "", raising=False)
    # Raised, not degraded: the registry falls back to local disk and logs it,
    # so a forgotten credential costs an operator a log line, not the files.
    with pytest.raises(RuntimeError, match="S3_BUCKET"):
        S3StorageProvider()


def test_s3_put_sends_the_key_verbatim_with_its_headers(s3_config):
    client = FakeS3Client()
    stored = _provider(client, s3_config).put(
        "SKU-1/01.jpg", b"bytes", cache_control="public, max-age=31536000, immutable"
    )

    (call,) = client.puts
    assert call["Key"] == "SKU-1/01.jpg"
    assert call["Bucket"] == "test-bucket"
    assert call["Body"] == b"bytes"
    assert call["ContentType"] == "image/jpeg"  # inferred from the key
    assert call["CacheControl"] == "public, max-age=31536000, immutable"
    assert stored.url == "https://cdn.test/SKU-1/01.jpg"


def test_s3_put_leaves_cache_control_off_when_not_asked(s3_config):
    client = FakeS3Client()
    _provider(client, s3_config).put("a/1.bin", b"x")

    assert "CacheControl" not in client.puts[0]
    assert client.puts[0]["ContentType"] == "application/octet-stream"


def test_s3_store_mints_a_key_for_the_narrow_caller(s3_config):
    client = FakeS3Client()
    stored = _provider(client, s3_config).store(b"x", "front.jpg")

    assert stored.key.endswith(".jpg")
    assert stored.key != "front.jpg"  # two uploads of front.jpg must not collide


def test_s3_url_for_is_none_without_a_public_base(monkeypatch, s3_config):
    monkeypatch.setattr(s3_config, "S3_PUBLIC_BASE_URL", "", raising=False)
    provider = _provider(FakeS3Client(), s3_config)

    assert provider.url_for("a/1.jpg") is None


def test_s3_delete_many_chunks_at_the_api_limit(s3_config):
    client = FakeS3Client()
    provider = _provider(client, s3_config)

    removed = provider.delete_many(f"a/{n}.jpg" for n in range(1001))

    # 1001 keys in one call is a hard API error, not a truncation.
    assert [len(call["Delete"]["Objects"]) for call in client.deletes] == [1000, 1]
    assert removed == 1001


def test_s3_list_prefix_follows_the_continuation_token(s3_config):
    pages = [
        {
            "Contents": [{"Key": "a/1.jpg", "Size": 1}],
            "IsTruncated": True,
            "NextContinuationToken": "page-2",
        },
        {"Contents": [{"Key": "a/2.jpg", "Size": 2}], "IsTruncated": False},
    ]
    client = FakeS3Client(pages)

    found = _provider(client, s3_config).list_prefix("a/")

    assert [item.key for item in found] == ["a/1.jpg", "a/2.jpg"]
    assert client.list_calls[1]["ContinuationToken"] == "page-2"


def test_s3_list_prefix_raises_rather_than_return_a_partial_listing(s3_config):
    client = FakeS3Client([{"Contents": [], "IsTruncated": True}])

    # Truncated with no token to continue from. Returning what arrived would
    # let a sweep treat an unexamined bucket as empty.
    with pytest.raises(RuntimeError, match="continuation token"):
        _provider(client, s3_config).list_prefix("a/")


def test_s3_counts_the_requests_it_billed_for(s3_config):
    client = FakeS3Client()
    provider = _provider(client, s3_config)

    provider.put("a/1.jpg", b"x")
    provider.delete("a/1.jpg")
    provider.list_prefix("a/")

    assert provider.ops == {"puts": 1, "deletes": 1, "lists": 1}


def test_s3_verify_public_reports_the_cdn_status(monkeypatch, s3_config):
    class _Response:
        status_code = 403
        headers = {"content-type": "text/html"}

    monkeypatch.setattr("httpx.head", lambda *a, **k: _Response())
    check = _provider(FakeS3Client(), s3_config).verify_public("a/1.jpg")

    # 403 with an HTML body is what a bot-protection challenge looks like from
    # the outside — the bucket is fine and every reader of the URL is broken.
    assert check == PublicCheck(ok=False, status=403, content_type="text/html")


def test_s3_verify_public_survives_an_unreachable_host(monkeypatch, s3_config):
    def explode(*_args, **_kwargs):
        raise OSError("name resolution failed")

    monkeypatch.setattr("httpx.head", explode)
    check = _provider(FakeS3Client(), s3_config).verify_public("a/1.jpg")

    assert check.ok is False
    assert check.status == 0
    assert "resolution" in check.error


def test_s3_check_connection_is_a_separate_diagnostic(s3_config):
    client = FakeS3Client()
    ok, detail = _provider(client, s3_config).check_connection()

    assert ok is True
    assert client.head_bucket_calls == 1
    assert "test-bucket" in detail


def test_s3_check_connection_reports_failure_without_raising(s3_config):
    client = FakeS3Client()

    def explode(**_kwargs):
        raise RuntimeError("SignatureDoesNotMatch")

    client.head_bucket = explode  # type: ignore[method-assign]
    ok, detail = _provider(client, s3_config).check_connection()

    assert ok is False
    assert "SignatureDoesNotMatch" in detail


def test_s3_is_an_object_store(s3_config):
    assert isinstance(_provider(FakeS3Client(), s3_config), ObjectStore)
