"""
Module:  test_media_service.py
Layer:   bedrock-api/tests
Desc:    Coverage for the corners of media_service.py that test_media.py does
         not reach: the config-driven upload ceiling (§S004 — the setting
         must be able to move, and a bad value must not be able to brick
         uploads), real image-dimension extraction via Pillow, and the read
         paths' null/empty edges (get, find_by_content, delete_for_entity,
         pending_queue).
"""
from __future__ import annotations

import io

import pytest

from bedrock.core.database import db
from bedrock.core.schema_catalog import Tables as T
from bedrock.services import media_service as media
from bedrock.storage import provider as storage_provider
from bedrock.storage.provider import LocalStorageProvider, storage

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


@pytest.fixture(autouse=True)
def clean_table(platform_db):
    db.execute(f"DELETE FROM {T.MEDIA_ASSETS}")
    yield
    db.execute(f"DELETE FROM {T.MEDIA_ASSETS}")


@pytest.fixture(autouse=True)
def clean_config():
    yield
    db.execute(f"DELETE FROM {T.APP_CONFIG_SETTINGS} WHERE key = %s", (media.MAX_BYTES_SETTING,))


@pytest.fixture
def local_root(tmp_path):
    provider = LocalStorageProvider(root=tmp_path)
    storage.reset_for_tests()
    storage.register(storage_provider.LOCAL_PROVIDER, lambda: provider)
    db.set_config(storage_provider.STORAGE_PROVIDER_KEY, storage_provider.LOCAL_PROVIDER)
    yield tmp_path
    db.set_config(storage_provider.STORAGE_PROVIDER_KEY, "")
    storage.reset_for_tests()
    storage.register(storage_provider.LOCAL_PROVIDER, storage_provider._local_object_store)
    storage.register("s3", storage_provider._s3_provider)
    storage.register("cloudflare_images", storage_provider._cloudflare_provider)


def _real_png(width: int = 4, height: int = 3) -> bytes:
    """An actual decodable PNG, unlike the module's fake-header fixture — the
    dimension extraction path only exercises Pillow's real decoder on bytes
    that are actually an image."""
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (width, height), color="red").save(buf, format="PNG")
    return buf.getvalue()


# ── _max_bytes (§S004: an admin-editable ceiling) ──────────────────────────

def test_max_bytes_defaults_when_unset():
    assert media._max_bytes() == media.DEFAULT_MAX_BYTES


def test_max_bytes_honours_the_configured_value():
    db.set_config(media.MAX_BYTES_SETTING, 12345)
    assert media._max_bytes() == 12345


@pytest.mark.parametrize("bad_value", ["not-a-number", "", None])
def test_max_bytes_falls_back_on_an_unparsable_value(bad_value):
    if bad_value is not None:
        db.set_config(media.MAX_BYTES_SETTING, bad_value)
    assert media._max_bytes() == media.DEFAULT_MAX_BYTES


@pytest.mark.parametrize("non_positive", [0, -1, -100])
def test_max_bytes_falls_back_on_a_non_positive_value(non_positive):
    """An admin-editable value must not be able to make uploads impossible."""
    db.set_config(media.MAX_BYTES_SETTING, non_positive)
    assert media._max_bytes() == media.DEFAULT_MAX_BYTES


# ── Dimension extraction ─────────────────────────────────────────────────────

def test_attach_media_records_real_image_dimensions(local_root):
    data = _real_png(width=8, height=5)
    asset = media.attach_media("card", 1, data, "real.png")
    assert asset.width == 8
    assert asset.height == 5


def test_attach_media_has_no_dimensions_for_non_image_bytes(local_root):
    asset = media.attach_media("card", 1, PNG, "fake.png")
    assert asset.width is None
    assert asset.height is None


# ── attach_media validation ──────────────────────────────────────────────────

def test_attach_media_requires_an_entity_type(local_root):
    with pytest.raises(ValueError, match="entity_type"):
        media.attach_media("", 1, PNG, "a.png")


# ── Reading edges ────────────────────────────────────────────────────────────

def test_get_missing_asset_is_none(local_root):
    assert media.get(999999) is None


def test_find_by_content_filters_by_entity_type(local_root):
    media.attach_media("card", 1, PNG, "a.png", status=media.STATUS_APPROVED)
    media.attach_media("post", 2, PNG, "b.png", status=media.STATUS_APPROVED)

    matches = media.find_by_content(PNG, entity_type="post")
    assert len(matches) == 1
    assert matches[0].entity_type == "post"


def test_find_by_content_with_no_matches_is_empty(local_root):
    assert media.find_by_content(b"never uploaded") == []


def test_delete_for_entity_with_nothing_attached_is_zero(local_root):
    assert media.delete_for_entity("card", 4242) == 0


def test_pending_queue_respects_the_limit(local_root):
    for i in range(3):
        media.attach_media("card", i, PNG, f"{i}.png")
    assert len(media.pending_queue(limit=2)) == 2


def test_pending_queue_empty_when_nothing_pending(local_root):
    asset = media.attach_media("card", 1, PNG, "a.png")
    media.approve([asset.media_id])
    assert media.pending_queue() == []
