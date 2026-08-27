"""
Module:  object_store.py
Layer:   bedrock/storage
Desc:    The object-store capability: caller-chosen keys, prefix listing, batch
         deletes, and public-URL verification (issue #23).

         `StorageProvider` is three methods because the *platform* calls three
         — hand it bytes and a filename, get an opaque key back. That is the
         right surface for "a user uploaded a photo, put it somewhere". It is
         the wrong surface for an application that owns its own key space, and
         CollectIt is that application: its image keys are `{sku}/{seq}.jpg`,
         minted by the app, immutable for the life of the listing, and the
         reason its `immutable` cache header is honest. A backend that mints
         its own key cannot express that at all.

         So this widens the capability without touching the narrow one.
         `ObjectStore` is a *second* protocol, and a provider either implements
         it or does not:

         - Nothing that implements only `StorageProvider` churns. Cloudflare
           Images stays exactly as it is — it mints its own image ids, and no
           amount of protocol design makes it accept a caller's key.
         - `media_service` and every existing caller keep calling three
           methods, unaware this file exists.
         - A caller that needs the wider surface asks for it by name and gets a
           typed refusal, not an `AttributeError`, when the configured backend
           cannot do it.

         Widening the original protocol in place was the alternative, and it
         fails on that first point: every implementation would have to grow
         methods to satisfy a caller that does not exist in its deployment.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Iterable, Protocol, runtime_checkable

from bedrock.storage.provider import (
    LocalStorageProvider,
    StorageProvider,
    StoredObject,
    storage,
)


class ObjectStoreUnsupported(RuntimeError):
    """The configured backend has no object-store surface.

    Raised rather than returning None from `active_object_store()` so that an
    application built on caller-chosen keys fails where it is misconfigured,
    with the backend named, instead of somewhere downstream holding a key
    nothing honoured.
    """


@dataclass(frozen=True)
class ListedObject:
    """One entry from `list_prefix`."""

    key: str
    size_bytes: int = 0
    #: Backend-supplied version tag, when there is one. Never parsed here.
    etag: str | None = None


@dataclass(frozen=True)
class PublicCheck:
    """The result of asking whether a key is actually reachable in public.

    This exists because the failure it catches is invisible from the storage
    API. Cloudflare's Bot Fight Mode and hotlink protection sit in front of the
    public hostname, not the bucket: credentials work, uploads succeed, a
    bucket-level probe passes, and every consumer of those URLs — eBay's image
    ingestion, in the case that produced this — silently gets nothing.

    `supported` separates "checked, and it is broken" from "this backend has no
    public URL to check". Local disk is the latter and must not be reported as
    a failure.
    """

    ok: bool
    status: int = 0
    content_type: str = ""
    error: str = ""
    supported: bool = True


@runtime_checkable
class ObjectStore(StorageProvider, Protocol):
    """A `StorageProvider` that also addresses its own key space.

    Implementations are also `StorageProvider`s: `store()` is still there for
    the platform's own uploads, and still mints the key itself.
    """

    def put(
        self,
        key: str,
        data: bytes,
        *,
        content_type: str | None = None,
        cache_control: str | None = None,
    ) -> StoredObject:
        """Write `data` at exactly `key`, replacing whatever was there.

        The caller owns the key. Backends must not decorate it — an application
        that computed a key and got a different one back cannot address its own
        objects.
        """
        ...

    def delete_many(self, keys: Iterable[str]) -> int:
        """Delete many keys, returning how many were removed.

        Separate from `delete` because the batch is not a loop on every
        backend: S3 bills per request and deletes a thousand keys in one call.
        """
        ...

    def list_prefix(self, prefix: str) -> list[ListedObject]:
        """Every object under `prefix`, exhaustively.

        Exhaustively is the whole contract. A backend that stops at its first
        page makes an orphan sweep report success having examined a thousand
        keys out of forty thousand — the sweep then deletes nothing and says so
        cheerfully. Paginate to the end or raise.
        """
        ...

    def verify_public(self, key: str) -> PublicCheck:
        """Fetch `key` through its public URL and report what happened.

        Never raises on an unreachable object: an unreachable object is the
        answer, not an error.
        """
        ...


def as_object_store(provider: StorageProvider) -> ObjectStore | None:
    """`provider` as an object store, or None when it has no such surface."""
    return provider if isinstance(provider, ObjectStore) else None


def active_object_store() -> ObjectStore:
    """The configured backend, as an object store.

    Raises `ObjectStoreUnsupported` naming the backend when it is not one.
    """
    provider = storage.active()
    store = as_object_store(provider)
    if store is None:
        raise ObjectStoreUnsupported(
            f"storage backend {getattr(provider, 'name', '?')!r} has no "
            "object-store surface: it mints its own keys and cannot list, so "
            "an application that owns its key space needs a different backend"
        )
    return store


def safe_key(key: str) -> str:
    """A normalised relative key, or `ValueError`.

    Keys reach a filesystem backend and are frequently built from
    user-supplied fragments, so `../` and absolute paths have to stop being
    interesting before the value touches a path. Normalising rather than
    silently rewriting: a caller that asked for a key it did not get is the
    failure this whole protocol exists to avoid.
    """
    parts = [
        part
        for part in PurePosixPath(str(key).replace("\\", "/")).parts
        if part not in ("", ".", "/")
    ]
    if not parts:
        raise ValueError(f"empty object key: {key!r}")
    # `..` is rejected, not filtered. Dropping it would turn
    # `../../etc/passwd` into the perfectly valid key `etc/passwd` — a
    # different object than the caller named, written without complaint.
    if any(part == ".." or ":" in part or "\x00" in part for part in parts):
        raise ValueError(f"unusable object key: {key!r}")
    return "/".join(parts)


class LocalObjectStoreMixin:
    """The object-store surface over a directory tree.

    Mixed into `LocalStorageProvider` below so that the fallback backend is a
    working object store: an application built on caller-chosen keys runs on a
    developer's laptop with nothing configured, which is the property that
    makes the wider surface testable without an S3 endpoint.
    """

    root: Path
    name: str

    def _resolved(self, key: str) -> Path:
        return self.root / safe_key(key)

    def put(
        self,
        key: str,
        data: bytes,
        *,
        content_type: str | None = None,
        cache_control: str | None = None,
    ) -> StoredObject:
        # content_type and cache_control are HTTP response metadata. A
        # directory has no such thing, and the route that serves these bytes
        # sets its own headers — accepted and ignored so the same application
        # code runs here and against S3.
        path = self._resolved(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return StoredObject(
            key=safe_key(key), url=None, provider=self.name, size_bytes=len(data)
        )

    def delete_many(self, keys: Iterable[str]) -> int:
        removed = 0
        for key in keys:
            try:
                self._resolved(key).unlink()
                removed += 1
            except (FileNotFoundError, ValueError):
                # Already gone, or never addressable. Either way the caller
                # wanted it absent and it is.
                continue
        return removed

    def list_prefix(self, prefix: str) -> list[ListedObject]:
        if not self.root.exists():
            return []
        normalised = "" if not prefix else safe_key(prefix)
        found: list[ListedObject] = []
        for path in sorted(self.root.rglob("*")):
            if not path.is_file():
                continue
            key = path.relative_to(self.root).as_posix()
            if normalised and not key.startswith(normalised):
                continue
            found.append(ListedObject(key=key, size_bytes=path.stat().st_size))
        return found

    def verify_public(self, key: str) -> PublicCheck:
        # Not a failure: local disk deliberately has no public URL, because the
        # application serves these bytes through its own authorisation.
        return PublicCheck(
            ok=False,
            supported=False,
            error="local storage has no public URL to verify",
        )


class LocalObjectStore(LocalObjectStoreMixin, LocalStorageProvider):
    """`LocalStorageProvider` with the object-store surface.

    A subclass rather than methods on `LocalStorageProvider` itself: the narrow
    provider is what `media_service` gets, and its `delete`/`path_for` flatten
    a key to its basename on purpose. Nested keys need the other resolution
    rule, and one class cannot honestly have both.
    """

    def delete(self, key: str) -> bool:
        try:
            self._resolved(key).unlink()
            return True
        except (FileNotFoundError, ValueError):
            return False

    def path_for(self, key: str) -> Path:
        return self._resolved(key)
