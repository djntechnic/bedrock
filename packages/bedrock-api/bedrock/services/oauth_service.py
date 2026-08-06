"""
Module:  oauth_service.py
Layer:   api/services
Desc:    Phase 5.3 — Google OAuth 2.0 integration.

         Provides:
           - `build_authorize_url(state)`  → hosted-consent URL to redirect to
           - `exchange_code(code)`         → provider tokens
           - `fetch_google_profile(token)` → id / email / name / picture
           - `link_or_create_user(profile, tokens)` → resolve to UserRecord

         Configuration comes from environment first, then `db.get_config`
         (§S4). Never hardcode client id / secret.

         The GoogleOAuth2 client is constructed lazily inside a helper so
         tests can monkeypatch `_google_client()` without needing real
         credentials at import time.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

import httpx
from httpx_oauth.clients.google import GoogleOAuth2
from loguru import logger

from bedrock.core.database import db, DatabaseManager
from bedrock.core.schema_catalog import Tables as T
from bedrock.services import user_service as us


GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
_DEFAULT_SCOPES = ["openid", "email", "profile"]


from dotenv import load_dotenv

from bedrock.core.paths import app_path

# OAuth client secrets live in the application's .env, not in a directory
# derived from this file — see bedrock.core.paths for why.
load_dotenv(app_path(".env"), override=True)


def _cfg(key: str, default: str | None = None) -> str | None:
    val = os.environ.get(key.upper())
    if val:
        return val
    stored = db.get_config(key, None)
    return str(stored) if stored else default


def _google_client() -> GoogleOAuth2:
    client_id = _cfg("google_client_id")
    client_secret = _cfg("google_client_secret")
    if not client_id or not client_secret:
        raise RuntimeError(
            "Google OAuth is not configured: set google_client_id / "
            "google_client_secret via env or db.set_config()."
        )
    return GoogleOAuth2(client_id, client_secret, scopes=_DEFAULT_SCOPES)


def _redirect_uri() -> str:
    uri = _cfg("google_redirect_uri")
    if not uri:
        raise RuntimeError(
            "google_redirect_uri is not configured. Set env GOOGLE_REDIRECT_URI "
            "or db.set_config('google_redirect_uri', ...)."
        )
    return uri


async def build_authorize_url(state: str | None = None) -> str:
    client = _google_client()
    return await client.get_authorization_url(_redirect_uri(), state=state)


async def exchange_code(code: str) -> dict[str, Any]:
    """Exchange a one-time authorization code for provider tokens."""
    client = _google_client()
    return await client.get_access_token(code, _redirect_uri())


async def fetch_google_profile(access_token: str) -> dict[str, Any]:
    """Fetch the caller's Google userinfo. Returns { sub, email, name, picture, ... }."""
    async with httpx.AsyncClient(timeout=10.0) as http:
        r = await http.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    r.raise_for_status()
    return r.json()


# ── Persistence ──────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class OAuthLinkResult:
    user: us.UserRecord
    created: bool          # True → new user, False → existing user
    linked: bool           # True → new oauth_accounts row created this call


def _get_oauth_account(
    oauth_name: str, account_id: str, *, database: DatabaseManager | None = None
) -> dict[str, Any] | None:
    d = database or db
    df = d.query(
        f"SELECT * FROM {T.AUTH_OAUTH_ACCOUNTS} WHERE oauth_name = %s AND account_id = %s LIMIT 1",
        (oauth_name, account_id),
    )
    if df.empty:
        return None
    return df.iloc[0].to_dict()


def _insert_oauth_account(
    *,
    user_id: int,
    oauth_name: str,
    access_token: str,
    refresh_token: str | None,
    expires_at: int | None,
    account_id: str,
    account_email: str,
    database: DatabaseManager | None = None,
) -> None:
    d = database or db
    d.execute(
        f"""
        INSERT INTO {T.AUTH_OAUTH_ACCOUNTS}
            (user_id, oauth_name, access_token, refresh_token,
             expires_at, account_id, account_email)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (user_id, oauth_name, access_token, refresh_token,
         expires_at, account_id, account_email),
    )


def _update_oauth_tokens(
    row_id: int,
    *,
    access_token: str,
    refresh_token: str | None,
    expires_at: int | None,
    database: DatabaseManager | None = None,
) -> None:
    d = database or db
    d.execute(
        f"""
        UPDATE {T.AUTH_OAUTH_ACCOUNTS}
           SET access_token = %s,
               refresh_token = COALESCE(%s, refresh_token),
               expires_at = %s
         WHERE id = %s
        """,
        (access_token, refresh_token, expires_at, row_id),
    )


def link_or_create_user(
    profile: dict[str, Any],
    tokens: dict[str, Any],
    *,
    oauth_name: str = "google",
    default_role: str = "collector",
    database: DatabaseManager | None = None,
) -> OAuthLinkResult:
    """Resolve a Google login to a local UserRecord.

    Resolution order:
      1. Match on (oauth_name, account_id) → existing OAuth-linked user.
      2. Match on email → link the OAuth account to that user.
      3. Create a brand-new user (no password) and link.

    tokens must expose 'access_token' and may expose 'refresh_token',
    'expires_at'.
    """
    d = database or db
    account_id = str(profile.get("sub") or profile.get("id") or "").strip()
    email = (profile.get("email") or "").strip().lower()
    if not account_id or not email:
        raise ValueError("google profile missing sub/email — refusing to link")

    display_name = profile.get("name") or profile.get("given_name") or None
    picture = profile.get("picture")
    access_token = tokens.get("access_token", "")
    refresh_token = tokens.get("refresh_token")
    expires_at = tokens.get("expires_at")

    # 1) Already linked?
    existing_link = _get_oauth_account(oauth_name, account_id, database=d)
    if existing_link:
        _update_oauth_tokens(
            int(existing_link["id"]),
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=expires_at,
            database=d,
        )
        user = us.get_user_by_id(int(existing_link["user_id"]), database=d)
        assert user is not None
        logger.info("Google login: existing oauth link user_id={}", user.user_id)
        return OAuthLinkResult(user=user, created=False, linked=False)

    # 2) Existing user by email? Link the OAuth account.
    user = us.get_user_by_email(email, database=d)
    if user is not None:
        _insert_oauth_account(
            user_id=user.user_id,
            oauth_name=oauth_name,
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=expires_at,
            account_id=account_id,
            account_email=email,
            database=d,
        )
        logger.info("Google login: linked to existing user_id={} email={}", user.user_id, email)
        return OAuthLinkResult(user=user, created=False, linked=True)

    # 3) New user — no password (OAuth-only).
    user = us.create_user(
        email=email,
        password=None,
        display_name=display_name,
        is_verified=True,
        default_role=default_role,
        database=d,
    )
    if picture and not user.avatar_url:
        d.execute(
            f"UPDATE {T.AUTH_USERS} SET avatar_url = %s WHERE user_id = %s",
            (picture, user.user_id),
        )
    _insert_oauth_account(
        user_id=user.user_id,
        oauth_name=oauth_name,
        access_token=access_token,
        refresh_token=refresh_token,
        expires_at=expires_at,
        account_id=account_id,
        account_email=email,
        database=d,
    )
    logger.info("Google login: created new user_id={} email={}", user.user_id, email)
    # Refresh to include the avatar update.
    fresh = us.get_user_by_id(user.user_id, database=d) or user
    return OAuthLinkResult(user=fresh, created=True, linked=True)
