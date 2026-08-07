"""
Module:  provider.py
Layer:   bedrock/storage
Desc:    The storage capability (plan F4). Where an uploaded file's bytes go.

         A provider rather than a registry, by the test in
         `docs/extension_points.md`: two storage backends do not both hold the
         file. One wins, and which one is deployment configuration — the same
         application code runs against local disk in development and a CDN in
         production.

         **The fallback is local disk, not a no-op**, and that is a deliberate
         divergence from mail. `NullMailProvider` drops the message because a
         dropped email is survivable and a self-hosted app with no relay must
         still boot. A dropped *file* is data loss: the user watched an upload
         succeed and the bytes are gone. Local disk needs no configuration —
         every bedrock app has a data directory — so "nothing configured" has a
         real, correct implementation available, and there is no reason to
         reach for a black hole instead.

         The protocol is three methods because the platform calls three. No
         listing, no copying, no presigned URLs, no multipart: guessing at a
         wider surface forces every backend to implement what nothing calls,
         and an S3 adapter that has to invent a `list_prefix` is an adapter
         nobody will write.
"""
from __future__ import annotations

import hashlib
import os
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol, runtime_checkable

from loguru import logger

from bedrock.core.config import config
from bedrock.core.providers import ProviderRegistry

#: `app_config_settings` key naming the active backend.
STORAGE_PROVIDER_KEY = "storage_provider"

#: Name of the backend that needs no configuration and is therefore the
#: fallback. Callers compare against this to tell "stored locally" from
#: "stored somewhere public".
LOCAL_PROVIDER = "local"


@dataclass(frozen=True)
class StoredObject:
    """The result of storing bytes.

    `key` is what the application persists and passes back to `delete`. It is
    opaque on purpose: a filesystem path for local disk, an image id for
    Cloudflare, an object key for S3. Code that parses it has coupled itself to
    one backend.
    """

    key: str
    #: Publicly reachable URL, when the backend has one. Local disk does not —
    #: the app serves those bytes itself — so this is None there.
    url: str | None = None
    #: Which backend stored it, recorded so a later delete goes to the right
    #: place even after the active provider is changed.
    provider: str = LOCAL_PROVIDER
    size_bytes: int = 0


@runtime_checkable
class StorageProvider(Protocol):
    """What the platform calls. Implement these three and register the class."""

    #: Backend name, recorded on every stored object.
    name: str

    def store(self, data: bytes, filename: str) -> StoredObject:
        """Persist `data`. Raises on failure — the caller decides what that means."""
        ...

    def delete(self, key: str) -> bool:
        """Remove a stored object. Returns False when it was already gone."""
        ...

    def url_for(self, key: str) -> str | None:
        """Public URL, or None when the application must serve the bytes."""
        ...


def _safe_stem(filename: str) -> str:
    """A filename-shaped fragment with nothing path-traversing left in it.

    `filename` reaches here from an upload, so it is attacker-controlled.
    `../../etc/passwd` and an embedded NUL both have to stop being interesting
    before the value touches a path.
    """
    stem = Path(filename).stem or "file"
    cleaned = "".join(c for c in stem if c.isalnum() or c in "-_")[:60]
    return cleaned or "file"


def _extension(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if not ext or len(ext) > 10 or not ext[1:].isalnum():
        return ""
    return ext


class LocalStorageProvider:
    """Files on the application's own disk, under `<DATA_DIR>/storage`.

    The fallback, and a real implementation rather than a placeholder: a
    single-container deployment with a mounted volume is a perfectly good place
    to keep uploads, and it is what every app gets before it configures
    anything.

    Note the consequence for scaling — local disk is per-container, so two API
    containers do not see each other's uploads. That is a reason to configure a
    real backend before scaling out, not a reason for this to be a no-op.
    """

    name = LOCAL_PROVIDER

    def __init__(self, root: str | os.PathLike[str] | None = None) -> None:
        self.root = Path(root) if root else Path(config.DATA_DIR) / "storage"

    def store(self, data: bytes, filename: str) -> StoredObject:
        # A uuid suffix rather than the bare name: two uploads called
        # `front.jpg` are the normal case, and the second must not silently
        # replace the first.
        stored = f"{_safe_stem(filename)}-{uuid.uuid4().hex[:12]}{_extension(filename)}"
        self.root.mkdir(parents=True, exist_ok=True)
        path = self.root / stored
        path.write_bytes(data)
        logger.debug("Stored {} bytes at {}", len(data), path)
        # Relative to the data directory, so moving or remounting the volume
        # does not invalidate every key in the database.
        return StoredObject(
            key=stored, url=None, provider=self.name, size_bytes=len(data)
        )

    def delete(self, key: str) -> bool:
        # `key` came out of the database, but the database is not a trust
        # boundary worth assuming here — re-sanitising costs nothing and means
        # a corrupted row cannot unlink an arbitrary file.
        path = self.root / Path(key).name
        try:
            path.unlink()
            return True
        except FileNotFoundError:
            return False

    def url_for(self, key: str) -> str | None:
        # No public URL: the application serves these bytes through its own
        # route, where its own authorisation applies. Returning a filesystem
        # path here would be a path leak dressed as a feature.
        return None

    def path_for(self, key: str) -> Path:
        """Absolute path, for the route that streams the file back."""
        return self.root / Path(key).name


def content_digest(data: bytes) -> str:
    """SHA-256 of the bytes, for duplicate detection.

    Offered because "the same photo uploaded twice" is a question every
    consumer asks and none should answer with its own hash choice.
    """
    return hashlib.sha256(data).hexdigest()


def _cloudflare_provider() -> StorageProvider:
    # Imported lazily so the httpx-backed adapter is only constructed when the
    # backend is actually selected.
    from bedrock.storage.cloudflare import CloudflareImagesProvider

    return CloudflareImagesProvider()


storage: ProviderRegistry[StorageProvider] = ProviderRegistry(
    capability="storage",
    config_key=STORAGE_PROVIDER_KEY,
    fallback=LocalStorageProvider,
)

storage.register(LOCAL_PROVIDER, LocalStorageProvider)
storage.register("cloudflare_images", _cloudflare_provider)
