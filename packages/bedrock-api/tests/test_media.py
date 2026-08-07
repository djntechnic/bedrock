"""
Module:  test_media.py
Layer:   bedrock-api/tests
Desc:    The storage provider and the media service (plan F4).

         Two properties carry most of the weight here. Uploads land `pending`,
         so nothing unreviewed is reachable; and `list_for_entity` filters to
         approved *by default*, because the one time a public page forgets to
         filter is the time an unreviewed upload is on the internet.
"""
from __future__ import annotations

import pathlib

import pytest

from bedrock.core.database import db
from bedrock.core.schema_catalog import Tables as T
from bedrock.services import media_service as media
from bedrock.storage import provider as storage_provider
from bedrock.storage.provider import LocalStorageProvider, StoredObject, storage

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


@pytest.fixture(autouse=True)
def clean_table(platform_db):
    db.execute(f"DELETE FROM {T.MEDIA_ASSETS}")
    yield
    db.execute(f"DELETE FROM {T.MEDIA_ASSETS}")


@pytest.fixture
def local_root(tmp_path):
    """Point the storage registry at a temp directory for the duration.

    Selects the backend through `app_config_settings` rather than reaching into
    the registry, so these tests exercise the same resolution path a deployment
    does — registering a factory the config never names would leave `active()`
    returning the fallback with the real data directory, which is exactly the
    bug this fixture was written wrong once already.
    """
    provider = LocalStorageProvider(root=tmp_path)
    storage.reset_for_tests()
    storage.register(storage_provider.LOCAL_PROVIDER, lambda: provider)
    db.set_config(storage_provider.STORAGE_PROVIDER_KEY, storage_provider.LOCAL_PROVIDER)
    yield tmp_path
    db.set_config(storage_provider.STORAGE_PROVIDER_KEY, "")
    storage.reset_for_tests()
    storage.register(storage_provider.LOCAL_PROVIDER, LocalStorageProvider)
    storage.register("cloudflare_images", storage_provider._cloudflare_provider)


# ── LocalStorageProvider ─────────────────────────────────────────────────────

def test_local_provider_writes_the_bytes(tmp_path):
    provider = LocalStorageProvider(root=tmp_path)
    stored = provider.store(b"hello", "greeting.txt")
    assert (tmp_path / stored.key).read_bytes() == b"hello"
    assert stored.size_bytes == 5


def test_two_uploads_of_the_same_name_do_not_collide(tmp_path):
    """`front.jpg` twice is the normal case, not an edge one. The second must
    not silently replace the first."""
    provider = LocalStorageProvider(root=tmp_path)
    a = provider.store(b"one", "front.jpg")
    b = provider.store(b"two", "front.jpg")
    assert a.key != b.key
    assert (tmp_path / a.key).read_bytes() == b"one"
    assert (tmp_path / b.key).read_bytes() == b"two"


@pytest.mark.parametrize("hostile", [
    "../../etc/passwd",
    "/etc/passwd",
    "..\\..\\windows\\system32\\config",
    "....//....//escape.jpg",
])
def test_a_hostile_filename_cannot_escape_the_root(tmp_path, hostile):
    """`filename` arrives from an upload, so it is attacker-controlled."""
    provider = LocalStorageProvider(root=tmp_path)
    stored = provider.store(b"x", hostile)
    written = (tmp_path / stored.key).resolve()
    assert written.is_relative_to(tmp_path.resolve())


def test_local_provider_has_no_public_url(tmp_path):
    """Returning a filesystem path here would be a path leak dressed as a
    feature — the app serves these bytes through its own authorised route."""
    provider = LocalStorageProvider(root=tmp_path)
    stored = provider.store(b"x", "a.png")
    assert provider.url_for(stored.key) is None


def test_deleting_a_missing_object_is_false_not_an_error(tmp_path):
    assert LocalStorageProvider(root=tmp_path).delete("nope.png") is False


def test_the_fallback_is_local_disk_not_a_no_op(platform_db):
    """Diverges from mail deliberately: a dropped email is survivable, and a
    dropped file is data loss the user watched succeed. Asserted through the
    registry's own resolution rather than its internals — what matters is what
    an unconfigured app actually gets."""
    storage.reset_for_tests()
    try:
        assert isinstance(storage.active(), LocalStorageProvider)
    finally:
        storage.reset_for_tests()
        storage.register(storage_provider.LOCAL_PROVIDER, LocalStorageProvider)
        storage.register("cloudflare_images", storage_provider._cloudflare_provider)


# ── attach_media ─────────────────────────────────────────────────────────────

def test_attach_records_the_asset_against_its_entity(local_root):
    asset = media.attach_media("card", 42, PNG, "front.png", owner_id=7)
    assert asset.entity_type == "card"
    assert asset.entity_id == 42
    assert asset.owner_id == 7
    assert asset.file_size_bytes == len(PNG)
    assert (local_root / asset.storage_key).exists()


def test_uploads_land_pending(local_root):
    """The ordering that keeps an unreviewed image off a public CDN."""
    assert media.attach_media("card", 1, PNG, "a.png").status == media.STATUS_PENDING


def test_an_app_with_no_review_step_says_so_at_the_call_site(local_root):
    asset = media.attach_media(
        "avatar", 1, PNG, "a.png", status=media.STATUS_APPROVED
    )
    assert asset.status == media.STATUS_APPROVED


def test_an_oversized_upload_is_refused(local_root, monkeypatch):
    monkeypatch.setattr(media, "_max_bytes", lambda *_a, **_k: 10)
    with pytest.raises(ValueError, match="limit"):
        media.attach_media("card", 1, b"x" * 11, "big.png")


def test_an_empty_file_is_refused(local_root):
    with pytest.raises(ValueError):
        media.attach_media("card", 1, b"", "empty.png")


def test_a_storage_failure_propagates(local_root, monkeypatch):
    """Unlike a dropped email, the caller can act on this: telling the user the
    upload failed is both possible and necessary."""
    def explode(*_a, **_k):
        raise RuntimeError("disk full")

    monkeypatch.setattr(storage.active(), "store", explode)
    with pytest.raises(RuntimeError, match="disk full"):
        media.attach_media("card", 1, PNG, "a.png")


def test_nothing_is_recorded_when_storage_fails(local_root, monkeypatch):
    def explode(*_a, **_k):
        raise RuntimeError("disk full")

    monkeypatch.setattr(storage.active(), "store", explode)
    with pytest.raises(RuntimeError):
        media.attach_media("card", 1, PNG, "a.png")
    assert media.list_for_entity("card", 1, status=None) == []


def test_an_unknown_status_is_rejected(local_root):
    with pytest.raises(ValueError, match="status"):
        media.attach_media("card", 1, PNG, "a.png", status="maybe")


# ── Review ───────────────────────────────────────────────────────────────────

def test_approve_moves_only_pending_rows(local_root):
    asset = media.attach_media("card", 1, PNG, "a.png")
    assert media.approve([asset.media_id], reviewed_by_user_id=9) == 1
    # Two admins on the same queue must not both count it.
    assert media.approve([asset.media_id]) == 0
    assert media.get(asset.media_id).status == media.STATUS_APPROVED


def test_reject_purges_the_bytes_but_keeps_the_record(local_root):
    asset = media.attach_media("card", 1, PNG, "a.png")
    path = local_root / asset.storage_key

    assert media.reject(asset.media_id, reason="blurry") is True
    assert not path.exists()

    row = media.get(asset.media_id)
    assert row.status == media.STATUS_REJECTED
    assert row.reject_reason == "blurry"


def test_a_rejected_asset_cannot_be_resurrected_by_a_stale_page(local_root):
    asset = media.attach_media("card", 1, PNG, "a.png")
    media.reject(asset.media_id)
    assert media.approve([asset.media_id]) == 0


def test_rejecting_something_that_is_gone_is_false(local_root):
    assert media.reject(9999) is False


def test_the_queue_is_pending_only_and_oldest_first(local_root):
    first = media.attach_media("card", 1, PNG, "a.png")
    second = media.attach_media("card", 2, PNG, "b.png")
    media.approve([first.media_id])

    queue = media.pending_queue()
    assert [a.media_id for a in queue] == [second.media_id]


# ── Reading ──────────────────────────────────────────────────────────────────

def test_list_defaults_to_approved(local_root):
    """The default that matters: a public page asking for 'the images' must not
    have to remember to filter."""
    pending = media.attach_media("card", 1, PNG, "pending.png")
    approved = media.attach_media("card", 1, PNG, "approved.png")
    media.approve([approved.media_id])

    visible = media.list_for_entity("card", 1)
    assert [a.media_id for a in visible] == [approved.media_id]
    assert pending.media_id not in [a.media_id for a in visible]


def test_list_can_be_asked_for_everything(local_root):
    media.attach_media("card", 1, PNG, "a.png")
    assert len(media.list_for_entity("card", 1, status=None)) == 1


def test_entities_of_different_types_do_not_collide(local_root):
    """id 1 exists in every table in the application. Keying on the pair is
    what stops a post's attachments appearing on a card."""
    media.attach_media("card", 1, PNG, "card.png", status=media.STATUS_APPROVED)
    media.attach_media("post", 1, PNG, "post.png", status=media.STATUS_APPROVED)

    assert [a.filename for a in media.list_for_entity("card", 1)] == ["card.png"]
    assert [a.filename for a in media.list_for_entity("post", 1)] == ["post.png"]


def test_duplicate_detection_by_content(local_root):
    media.attach_media("card", 1, PNG, "a.png")
    assert len(media.find_by_content(PNG)) == 1
    assert media.find_by_content(b"different bytes entirely") == []


# ── Deletion ─────────────────────────────────────────────────────────────────

def test_delete_removes_the_row_and_the_bytes(local_root):
    asset = media.attach_media("card", 1, PNG, "a.png")
    path = local_root / asset.storage_key

    assert media.delete_media(asset.media_id) is True
    assert media.get(asset.media_id) is None
    assert not path.exists()


def test_delete_for_entity_clears_everything_attached(local_root):
    media.attach_media("card", 5, PNG, "a.png")
    media.attach_media("card", 5, PNG, "b.png")
    media.attach_media("card", 6, PNG, "c.png")

    assert media.delete_for_entity("card", 5) == 2
    assert media.list_for_entity("card", 5, status=None) == []
    assert len(media.list_for_entity("card", 6, status=None)) == 1


def test_a_failed_purge_still_removes_the_row(local_root, monkeypatch):
    """An orphaned file is recoverable. A row pointing at nothing renders as a
    broken image forever."""
    asset = media.attach_media("card", 1, PNG, "a.png")

    def explode(*_a, **_k):
        raise OSError("permission denied")

    monkeypatch.setattr(storage.active(), "delete", explode)
    assert media.delete_media(asset.media_id) is True
    assert media.get(asset.media_id) is None


def test_bytes_on_a_different_backend_are_left_alone(local_root, caplog):
    """After the active provider changes, deleting a Cloudflare image through
    the local provider would unlink nothing and report success."""
    asset = media.attach_media("card", 1, PNG, "a.png")
    db.execute(
        f"UPDATE {T.MEDIA_ASSETS} SET storage_provider = %s WHERE media_id = %s",
        ("cloudflare_images", asset.media_id),
    )
    path = local_root / asset.storage_key

    assert media.delete_media(asset.media_id) is True
    # Still there: the local provider was not asked to delete something it did
    # not store.
    assert path.exists()
