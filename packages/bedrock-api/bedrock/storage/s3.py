"""
Module:  s3.py
Layer:   bedrock/storage
Desc:    S3-compatible object storage as an `ObjectStore` (issue #23).

         One adapter covers Cloudflare R2, MinIO and S3 itself, because they
         differ only in an endpoint URL. It ships with the platform for the
         reason SMTP and Cloudflare Images do: talking S3 needs no application
         knowledge, so a backend bedrock can write is one every consumer would
         otherwise write identically — and CollectIt already did, at
         `api/services/storage/r2.py`, which is what this replaces.

         `boto3` is an optional dependency (`pip install bedrock-api[s3]`) and
         is imported inside the constructor. An application that never selects
         this backend never needs it installed, which is the same bargain
         `psycopg2` gets.

         Credentials come from the environment, never `app_config_settings`.
"""
from __future__ import annotations

import mimetypes
import uuid
from typing import Any, Iterable

import httpx
from loguru import logger

from bedrock.core.config import config
from bedrock.storage.object_store import (
    ListedObject,
    PublicCheck,
    safe_key,
)
from bedrock.storage.provider import StoredObject, _extension, _safe_stem

PROVIDER_NAME = "s3"

#: S3 accepts at most this many keys in one `delete_objects` call. Exceeding it
#: is a hard API error, not a truncation, so the batch is chunked.
_DELETE_CHUNK = 1000

_DEFAULT_CONTENT_TYPE = "application/octet-stream"


def is_configured() -> bool:
    """A bucket and a credential pair. The endpoint is empty for AWS itself."""
    return bool(
        config.S3_BUCKET
        and config.S3_ACCESS_KEY_ID
        and config.S3_SECRET_ACCESS_KEY
    )


def _guess_content_type(key: str) -> str:
    guessed, _ = mimetypes.guess_type(key)
    return guessed or _DEFAULT_CONTENT_TYPE


class S3StorageProvider:
    """Bytes in an S3-compatible bucket, addressed by the caller's own keys."""

    name = PROVIDER_NAME

    def __init__(self, *, client: Any | None = None) -> None:
        if client is None and not is_configured():
            # Raised, not degraded: the registry catches a failing factory,
            # logs it and falls back to local disk. An operator who selected
            # this backend and forgot a credential gets working uploads on the
            # container's own disk and a loud log, rather than lost files.
            raise RuntimeError(
                "s3 storage selected but not configured — set S3_BUCKET, "
                "S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY (plus "
                "S3_ENDPOINT_URL for R2 or MinIO)"
            )
        self.bucket = config.S3_BUCKET
        self.public_base_url = config.S3_PUBLIC_BASE_URL.rstrip("/")
        #: Requests made this process, by billed class. S3-compatible providers
        #: price per request, not only per byte, and the operation that
        #: surprises an operator is always a listing loop nobody counted.
        self.ops: dict[str, int] = {"puts": 0, "deletes": 0, "lists": 0}
        self._client = client if client is not None else self._build_client()

    def _build_client(self) -> Any:
        try:
            import boto3  # noqa: PLC0415 — optional dependency, imported on selection
        except ImportError as exc:  # pragma: no cover - depends on the install
            raise RuntimeError(
                "s3 storage selected but boto3 is not installed — "
                "pip install 'bedrock-api[s3]'"
            ) from exc

        return boto3.client(
            "s3",
            endpoint_url=config.S3_ENDPOINT_URL or None,
            aws_access_key_id=config.S3_ACCESS_KEY_ID,
            aws_secret_access_key=config.S3_SECRET_ACCESS_KEY,
            region_name=config.S3_REGION or "auto",
        )

    # --- StorageProvider -------------------------------------------------

    def store(self, data: bytes, filename: str) -> StoredObject:
        """Mint a key and write there — the narrow platform surface.

        A uuid suffix for the same reason local disk uses one: two uploads
        called `front.jpg` are the normal case and the second must not replace
        the first. An application with its own key space calls `put` instead.
        """
        key = f"{_safe_stem(filename)}-{uuid.uuid4().hex[:12]}{_extension(filename)}"
        return self.put(key, data)

    def delete(self, key: str) -> bool:
        self.ops["deletes"] += 1
        self._client.delete_object(Bucket=self.bucket, Key=safe_key(key))
        # S3 answers 204 whether or not the object existed, so there is nothing
        # here to distinguish "deleted" from "was already gone". Reported as
        # success: the caller wanted it absent and it is.
        return True

    def url_for(self, key: str) -> str | None:
        if not self.public_base_url:
            # A private bucket. The application serves the bytes itself, where
            # its own authorisation applies.
            return None
        return f"{self.public_base_url}/{safe_key(key)}"

    # --- ObjectStore -----------------------------------------------------

    def put(
        self,
        key: str,
        data: bytes,
        *,
        content_type: str | None = None,
        cache_control: str | None = None,
    ) -> StoredObject:
        normalised = safe_key(key)
        extra: dict[str, str] = {
            "ContentType": content_type or _guess_content_type(normalised)
        }
        if cache_control:
            extra["CacheControl"] = cache_control

        self.ops["puts"] += 1
        self._client.put_object(
            Bucket=self.bucket, Key=normalised, Body=data, **extra
        )
        logger.debug("Stored {} bytes at s3://{}/{}", len(data), self.bucket, normalised)
        return StoredObject(
            key=normalised,
            url=self.url_for(normalised),
            provider=self.name,
            size_bytes=len(data),
        )

    def delete_many(self, keys: Iterable[str]) -> int:
        pending = [safe_key(key) for key in keys]
        removed = 0
        for start in range(0, len(pending), _DELETE_CHUNK):
            chunk = pending[start : start + _DELETE_CHUNK]
            self.ops["deletes"] += 1
            response = self._client.delete_objects(
                Bucket=self.bucket,
                Delete={"Objects": [{"Key": key} for key in chunk], "Quiet": True},
            )
            errors = response.get("Errors") or []
            for error in errors:
                logger.error(
                    "S3 delete failed for {}: {}", error.get("Key"), error.get("Message")
                )
            removed += len(chunk) - len(errors)
        return removed

    def list_prefix(self, prefix: str) -> list[ListedObject]:
        """Every key under `prefix`, following the continuation token to the end.

        The pagination is the point. `list_objects_v2` returns at most 1000
        keys and reports the truncation in a field it is easy not to read; a
        version that ignores it makes an orphan sweep examine the first
        thousand objects of forty thousand and report a clean bucket.
        """
        found: list[ListedObject] = []
        token: str | None = None
        while True:
            kwargs: dict[str, Any] = {"Bucket": self.bucket, "Prefix": prefix}
            if token:
                kwargs["ContinuationToken"] = token
            self.ops["lists"] += 1
            response = self._client.list_objects_v2(**kwargs)
            for item in response.get("Contents") or []:
                found.append(
                    ListedObject(
                        key=item["Key"],
                        size_bytes=item.get("Size", 0),
                        etag=item.get("ETag"),
                    )
                )
            if not response.get("IsTruncated"):
                return found
            token = response.get("NextContinuationToken")
            if not token:
                # Truncated with no token to continue from: the backend is
                # lying, and returning a partial listing as complete is how a
                # sweep deletes the wrong thing.
                raise RuntimeError(
                    f"S3 listing of {prefix!r} reported truncation with no "
                    "continuation token"
                )

    def verify_public(self, key: str) -> PublicCheck:
        """HEAD the object through its public hostname.

        A separate diagnostic from `check_connection` because it catches a
        different failure: Cloudflare's Bot Fight Mode and hotlink protection
        sit in front of the public hostname, not the bucket. Credentials work,
        uploads succeed, `head_bucket` passes — and every reader of those URLs
        gets a challenge page instead of an image.
        """
        url = self.url_for(key)
        if not url:
            return PublicCheck(
                ok=False,
                supported=False,
                error="no public base URL configured for this bucket",
            )
        try:
            response = httpx.head(url, timeout=10.0, follow_redirects=True)
        except Exception as exc:  # noqa: BLE001 — unreachable is the answer, not an error
            return PublicCheck(ok=False, status=0, error=str(exc))
        return PublicCheck(
            ok=response.status_code == 200,
            status=response.status_code,
            content_type=response.headers.get("content-type", ""),
        )

    # --- backend-specific diagnostics ------------------------------------

    def check_connection(self) -> tuple[bool, str]:
        """Credentials and bucket reachability. Not part of the protocol.

        Deliberately not `verify_public`'s job and deliberately not merged with
        it: this one passing while that one fails is the exact signature of a
        CDN sitting in front of a healthy bucket.
        """
        try:
            self._client.head_bucket(Bucket=self.bucket)
        except Exception as exc:  # noqa: BLE001 — a diagnostic reports, never raises
            return False, str(exc)
        return True, f"bucket {self.bucket!r} reachable"


def s3_provider() -> S3StorageProvider:
    return S3StorageProvider()
