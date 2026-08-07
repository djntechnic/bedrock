"""
Module:  cloudflare.py
Layer:   bedrock/storage
Desc:    Cloudflare Images as a `StorageProvider` (plan F4).

         Ships with the platform for the same reason SMTP does: talking to
         Cloudflare's image API needs no application knowledge, so a backend
         bedrock can write is one every consumer would otherwise write
         identically. *Which* account is configuration.

         Credentials come from the environment, not `app_config_settings` —
         `CLOUDFLARE_API_TOKEN` is a credential and app config is rendered in
         an admin UI and returned by the export endpoint. The same line F1 drew
         for `SMTP_PASSWORD`.
"""
from __future__ import annotations

import httpx
from loguru import logger

from bedrock.core.config import config
from bedrock.storage.provider import StoredObject

_API_BASE = "https://api.cloudflare.com/client/v4/accounts"
_CDN_BASE = "https://imagedelivery.net"

PROVIDER_NAME = "cloudflare_images"


def is_configured() -> bool:
    """All three values, because two out of three cannot upload anything.

    The delivery hash is not optional even though it plays no part in the
    upload: without it there is no URL to hand back, and an object stored with
    no way to reach it is worse than a refusal.
    """
    return bool(
        config.CLOUDFLARE_ACCOUNT_ID
        and config.CLOUDFLARE_API_TOKEN
        and config.CLOUDFLARE_IMAGES_HASH
    )


class CloudflareImagesProvider:
    """Uploads to Cloudflare Images and serves from their CDN."""

    name = PROVIDER_NAME

    def __init__(self, *, timeout: float | None = None) -> None:
        if not is_configured():
            # Raised rather than degraded: the registry catches a failing
            # factory, logs it, and falls back to local disk. That is the right
            # outcome — an operator who selected this backend and forgot the
            # token gets working uploads and a loud log, not lost files.
            raise RuntimeError(
                "cloudflare_images selected but not configured — set "
                "CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN and "
                "CLOUDFLARE_IMAGES_HASH"
            )
        self._timeout = timeout
        self._account = config.CLOUDFLARE_ACCOUNT_ID
        self._token = config.CLOUDFLARE_API_TOKEN
        self._hash = config.CLOUDFLARE_IMAGES_HASH

    def _resolve_timeout(self) -> float:
        if self._timeout is not None:
            return self._timeout
        # Read per call rather than at construction: the provider instance is
        # cached for the process lifetime, and an operator raising the timeout
        # should not need a restart.
        from bedrock.core.database import db

        try:
            return float(db.get_config("api_cloudflare_upload_timeout", 30.0))
        except Exception:  # noqa: BLE001 — a bad config value must not block an upload.
            return 30.0

    def store(self, data: bytes, filename: str) -> StoredObject:
        url = f"{_API_BASE}/{self._account}/images/v1"
        with httpx.Client(timeout=self._resolve_timeout()) as client:
            response = client.post(
                url,
                headers={"Authorization": f"Bearer {self._token}"},
                files={"file": (filename, data)},
            )

        if response.status_code != 200:
            raise RuntimeError(
                f"Cloudflare Images upload failed [{response.status_code}]: "
                f"{response.text[:300]}"
            )
        payload = response.json()
        if not payload.get("success"):
            raise RuntimeError(f"Cloudflare Images error: {payload.get('errors', [])}")

        image_id = payload["result"]["id"]
        return StoredObject(
            key=image_id,
            url=self.url_for(image_id),
            provider=self.name,
            size_bytes=len(data),
        )

    def delete(self, key: str) -> bool:
        url = f"{_API_BASE}/{self._account}/images/v1/{key}"
        with httpx.Client(timeout=self._resolve_timeout()) as client:
            response = client.delete(
                url, headers={"Authorization": f"Bearer {self._token}"}
            )
        if response.status_code == 404:
            # Already gone. Not an error: the caller wanted it absent and it is.
            return False
        if response.status_code != 200:
            logger.error(
                "Cloudflare Images delete failed [{}]: {}",
                response.status_code, response.text[:300],
            )
            return False
        return True

    def url_for(self, key: str) -> str | None:
        return f"{_CDN_BASE}/{self._hash}/{key}/public"
