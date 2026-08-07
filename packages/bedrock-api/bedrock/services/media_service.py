"""
Module:  media_service.py
Layer:   bedrock/services
Desc:    Attach files to anything, and hold them for review (plan F4).

         Generalised out of MLBTracker's `photo_service`, which was good work
         bound to one table: every function took a `collection_card_id` and
         resolved ownership through `_owner_of_card`. What was actually generic
         — validate, store, record, queue for approval, promote on approval,
         purge on delete — is here, keyed by `(entity_type, entity_id)`.

         **Two-phase by design.** An upload lands `pending` on whatever backend
         is configured; approval is what moves it to a public one. An
         unreviewed image must not be reachable on a CDN, and the ordering is
         what guarantees that rather than a policy anyone has to remember.

         What stayed in the application: naming. MLBTracker's slug is derived
         from the card's player and set, and a filename that reads well is
         exactly the kind of thing only the app knows. Pass `filename`.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Sequence

from loguru import logger

from bedrock.core.database import db as default_db
from bedrock.core.schema_catalog import Tables as T
from bedrock.storage.provider import (
    LOCAL_PROVIDER,
    StoredObject,
    content_digest,
    storage,
)

STATUS_PENDING = "pending"
STATUS_APPROVED = "approved"
STATUS_REJECTED = "rejected"
STATUSES = frozenset({STATUS_PENDING, STATUS_APPROVED, STATUS_REJECTED})

#: Ceiling on an upload, in bytes. A limit has to exist somewhere or a request
#: body is an unbounded allocation; 20 MB is MLBTracker's, and it is a config
#: key rather than a constant so an app with different needs can move it.
DEFAULT_MAX_BYTES = 20 * 1024 * 1024
MAX_BYTES_SETTING = "media_max_upload_bytes"


@dataclass(frozen=True)
class MediaAsset:
    """One attached file, as the platform sees it."""

    media_id: int
    entity_type: str
    entity_id: int
    filename: str
    storage_key: str
    storage_provider: str
    status: str
    url: str | None = None
    owner_id: int | None = None
    content_type: str | None = None
    file_size_bytes: int | None = None
    width: int | None = None
    height: int | None = None
    content_hash: str | None = None
    sort_order: int | None = None
    tags: list[str] = field(default_factory=list)
    source_url: str | None = None
    submitted_by_user_id: int | None = None
    reviewed_by_user_id: int | None = None
    reviewed_at: str | None = None
    reject_reason: str | None = None
    created_at: str | None = None


def _db(database=None):
    return database if database is not None else default_db


def _max_bytes(database=None) -> int:
    try:
        value = int(_db(database).get_config(MAX_BYTES_SETTING, DEFAULT_MAX_BYTES))
        return value if value > 0 else DEFAULT_MAX_BYTES
    except (TypeError, ValueError):
        # An admin-editable value must not be able to make uploads impossible.
        return DEFAULT_MAX_BYTES


def _rows(df) -> list[dict[str, Any]]:
    """DataFrame → dicts. `db.query` returns pandas, which every service here
    unwraps the same way."""
    if df is None or df.empty:
        return []
    return [r.to_dict() for _, r in df.iterrows()]


def _optional_int(value: Any) -> int | None:
    # pandas turns a NULL integer column into NaN, which is a float and is not
    # None — so a plain `or None` leaves NaN in the dataclass and it reaches
    # the JSON encoder as a value no client can read.
    if value is None:
        return None
    try:
        if value != value:  # NaN
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _optional_str(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and value != value:  # NaN
        return None
    return str(value)


def _row_to_asset(row: dict[str, Any]) -> MediaAsset:
    raw_tags = _optional_str(row.get("tags"))
    try:
        tags = json.loads(raw_tags) if raw_tags else []
    except (TypeError, ValueError):
        tags = []
    return MediaAsset(
        media_id=int(row["media_id"]),
        entity_type=row["entity_type"],
        entity_id=int(row["entity_id"]),
        filename=row["filename"],
        storage_key=row["storage_key"],
        storage_provider=row.get("storage_provider") or LOCAL_PROVIDER,
        status=row.get("status") or STATUS_PENDING,
        url=_optional_str(row.get("url")),
        owner_id=_optional_int(row.get("owner_id")),
        content_type=_optional_str(row.get("content_type")),
        file_size_bytes=_optional_int(row.get("file_size_bytes")),
        width=_optional_int(row.get("width")),
        height=_optional_int(row.get("height")),
        content_hash=_optional_str(row.get("content_hash")),
        sort_order=_optional_int(row.get("sort_order")),
        tags=tags if isinstance(tags, list) else [],
        source_url=_optional_str(row.get("source_url")),
        submitted_by_user_id=_optional_int(row.get("submitted_by_user_id")),
        reviewed_by_user_id=_optional_int(row.get("reviewed_by_user_id")),
        reviewed_at=_optional_str(row.get("reviewed_at")),
        reject_reason=_optional_str(row.get("reject_reason")),
        created_at=_optional_str(row.get("created_at")),
    )


def _image_dimensions(data: bytes) -> tuple[int | None, int | None]:
    """Width and height when Pillow is installed and the bytes are an image.

    Optional on purpose. Pillow is a heavy dependency for an application that
    attaches PDFs, and dimensions are metadata — worth having, never worth
    failing an upload over.
    """
    try:
        import io

        from PIL import Image  # type: ignore[import-not-found]

        with Image.open(io.BytesIO(data)) as img:
            return img.width, img.height
    except Exception:  # noqa: BLE001 — no Pillow, or not an image.
        return None, None


# ── Writing ──────────────────────────────────────────────────────────────────

def attach_media(
    entity_type: str,
    entity_id: int,
    data: bytes,
    filename: str,
    *,
    owner_id: int | None = None,
    content_type: str | None = None,
    tags: Sequence[str] | None = None,
    source_url: str | None = None,
    submitted_by_user_id: int | None = None,
    status: str = STATUS_PENDING,
    database=None,
) -> MediaAsset:
    """Store bytes and record them against an entity.

    Lands `pending` unless told otherwise, so nothing an admin has not seen is
    reachable from a public URL. An application with no review step passes
    ``status=STATUS_APPROVED`` and says so at the call site, which is better
    than a config flag that makes the same decision invisibly.

    Raises `ValueError` for an oversized upload and lets a storage failure
    propagate: unlike a dropped email, the caller *can* act on this one —
    telling the user the upload failed is both possible and necessary.
    """
    if not entity_type:
        raise ValueError("entity_type is required")
    if status not in STATUSES:
        raise ValueError(f"unknown status {status!r}")

    limit = _max_bytes(database)
    if len(data) > limit:
        raise ValueError(f"File exceeds the {limit} byte limit ({len(data)} bytes)")
    if not data:
        raise ValueError("Refusing to store an empty file")

    provider = storage.active()
    stored: StoredObject = provider.store(data, filename)
    width, height = _image_dimensions(data)

    d = _db(database)
    d.execute(
        f"""
        INSERT INTO {T.MEDIA_ASSETS}
            (entity_type, entity_id, owner_id, storage_key, storage_provider,
             url, filename, content_type, file_size_bytes, width, height,
             content_hash, status, tags, source_url, submitted_by_user_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            entity_type, entity_id, owner_id, stored.key, stored.provider,
            stored.url, filename, content_type, len(data), width, height,
            content_digest(data), status, json.dumps(list(tags or [])),
            source_url, submitted_by_user_id,
        ),
    )

    row = _rows(d.query(
        f"SELECT * FROM {T.MEDIA_ASSETS} WHERE storage_key = %s "
        f"ORDER BY media_id DESC LIMIT 1",
        (stored.key,),
    ))
    logger.info(
        "Attached media to {}:{} as {} ({} bytes, {})",
        entity_type, entity_id, stored.key, len(data), stored.provider,
    )
    return _row_to_asset(row[0])


def approve(
    media_ids: Sequence[int],
    *,
    reviewed_by_user_id: int | None = None,
    database=None,
) -> int:
    """Mark assets approved. Returns how many changed.

    Only `pending` rows move, enforced in the WHERE clause rather than by
    reading first: two admins clicking approve on the same queue must not both
    count it, and an already-rejected asset must not be resurrected by a stale
    page.
    """
    if not media_ids:
        return 0
    d = _db(database)
    placeholders = ", ".join(["%s"] * len(media_ids))
    return d.execute(
        f"""
        UPDATE {T.MEDIA_ASSETS}
           SET status = %s, reviewed_by_user_id = %s,
               reviewed_at = datetime('now'), reject_reason = NULL
         WHERE media_id IN ({placeholders}) AND status = %s
        """,
        (STATUS_APPROVED, reviewed_by_user_id, *media_ids, STATUS_PENDING),
    )


def reject(
    media_id: int,
    *,
    reason: str | None = None,
    reviewed_by_user_id: int | None = None,
    purge: bool = True,
    database=None,
) -> bool:
    """Reject an asset and, by default, remove the stored bytes.

    Purging is the default because the bytes are the reason the asset was
    rejected — an image an admin refused should not sit on disk indefinitely.
    The row stays, so the queue keeps a record of the decision and the reason.
    """
    d = _db(database)
    rows = _rows(d.query(
        f"SELECT * FROM {T.MEDIA_ASSETS} WHERE media_id = %s", (media_id,)
    ))
    if not rows:
        return False

    changed = d.execute(
        f"""
        UPDATE {T.MEDIA_ASSETS}
           SET status = %s, reviewed_by_user_id = %s,
               reviewed_at = datetime('now'), reject_reason = %s
         WHERE media_id = %s AND status = %s
        """,
        (STATUS_REJECTED, reviewed_by_user_id, reason, media_id, STATUS_PENDING),
    )
    if not changed:
        return False

    if purge:
        _purge_bytes(_row_to_asset(rows[0]))
    return True


def delete_media(media_id: int, *, database=None) -> bool:
    """Remove an asset and its bytes."""
    d = _db(database)
    rows = _rows(d.query(
        f"SELECT * FROM {T.MEDIA_ASSETS} WHERE media_id = %s", (media_id,)
    ))
    if not rows:
        return False
    asset = _row_to_asset(rows[0])
    # Row first. If the delete of the bytes fails we have an orphaned file,
    # which is recoverable; the other order leaves a row pointing at nothing,
    # which renders as a broken image forever.
    d.execute(f"DELETE FROM {T.MEDIA_ASSETS} WHERE media_id = %s", (media_id,))
    _purge_bytes(asset)
    return True


def delete_for_entity(entity_type: str, entity_id: int, *, database=None) -> int:
    """Remove every asset attached to an entity. Returns the count.

    There is no foreign key from `media_assets` to an application table — that
    is the price of one table serving every entity — so an application deleting
    an entity calls this. Nothing cascades on its own.
    """
    d = _db(database)
    rows = _rows(d.query(
        f"SELECT * FROM {T.MEDIA_ASSETS} WHERE entity_type = %s AND entity_id = %s",
        (entity_type, entity_id),
    ))
    if not rows:
        return 0
    d.execute(
        f"DELETE FROM {T.MEDIA_ASSETS} WHERE entity_type = %s AND entity_id = %s",
        (entity_type, entity_id),
    )
    for row in rows:
        _purge_bytes(_row_to_asset(row))
    return len(rows)


def _purge_bytes(asset: MediaAsset) -> None:
    """Delete the stored object, tolerating a backend that no longer has it.

    Swallows, and here that is right: the database row is already gone or
    marked rejected, so raising would report a failed delete for an operation
    that has, from the user's point of view, succeeded. Logged at warning so an
    accumulating orphan is visible.
    """
    try:
        provider = storage.active()
        # The asset records which backend stored it, which matters after the
        # active provider has been changed: deleting a Cloudflare image through
        # the local provider would unlink nothing and report success.
        if provider.name != asset.storage_provider:
            logger.warning(
                "Media {} was stored on {!r} but the active backend is {!r}; "
                "leaving the object in place",
                asset.media_id, asset.storage_provider, provider.name,
            )
            return
        provider.delete(asset.storage_key)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not purge media {}: {}", asset.media_id, exc)


# ── Reading ──────────────────────────────────────────────────────────────────

def list_for_entity(
    entity_type: str,
    entity_id: int,
    *,
    status: str | None = STATUS_APPROVED,
    database=None,
) -> list[MediaAsset]:
    """Assets attached to one entity.

    Defaults to approved only. A public page asking for "the images" must not
    have to remember to filter, because the one time it forgets is the time an
    unreviewed upload is on the internet.
    """
    d = _db(database)
    sql = (
        f"SELECT * FROM {T.MEDIA_ASSETS} "
        f"WHERE entity_type = %s AND entity_id = %s"
    )
    params: list[Any] = [entity_type, entity_id]
    if status is not None:
        sql += " AND status = %s"
        params.append(status)
    sql += " ORDER BY COALESCE(sort_order, media_id), media_id"
    return [_row_to_asset(r) for r in _rows(d.query(sql, tuple(params)))]


def pending_queue(*, limit: int = 200, database=None) -> list[MediaAsset]:
    """Everything awaiting review, oldest first."""
    d = _db(database)
    rows = _rows(d.query(
        f"SELECT * FROM {T.MEDIA_ASSETS} WHERE status = %s "
        f"ORDER BY created_at, media_id LIMIT %s",
        (STATUS_PENDING, limit),
    ))
    return [_row_to_asset(r) for r in rows]


def get(media_id: int, *, database=None) -> MediaAsset | None:
    rows = _rows(_db(database).query(
        f"SELECT * FROM {T.MEDIA_ASSETS} WHERE media_id = %s", (media_id,)
    ))
    return _row_to_asset(rows[0]) if rows else None


def find_by_content(
    data: bytes, *, entity_type: str | None = None, database=None
) -> list[MediaAsset]:
    """Assets whose bytes match, for "you have already uploaded this"."""
    d = _db(database)
    sql = f"SELECT * FROM {T.MEDIA_ASSETS} WHERE content_hash = %s"
    params: list[Any] = [content_digest(data)]
    if entity_type:
        sql += " AND entity_type = %s"
        params.append(entity_type)
    return [_row_to_asset(r) for r in _rows(d.query(sql, tuple(params)))]
