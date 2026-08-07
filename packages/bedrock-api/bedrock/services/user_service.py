"""
Module:  user_service.py
Layer:   api/services
Desc:    Phase 5.2 — user identity, password hashing, and JWT issuance backed
         by the project's DatabaseManager (no SQLAlchemy). Provides the core
         primitives that api/routes/auth.py and api/dependencies.py compose
         into register/login/logout/me endpoints and per-request auth guards.

         Password hashing:  passlib bcrypt (12 rounds default).
         Token format:      JWT (HS256) with claims sub, jti, exp, iat.
         Session tracking:  each issued JWT's jti is persisted in
                            user_sessions so P5.11 can revoke it server-side.
"""
from __future__ import annotations

import os
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from loguru import logger
from passlib.context import CryptContext
from jose import jwt, JWTError

from bedrock.core.database import db, DatabaseManager
from bedrock.core.schema_catalog import Tables as T


# ── Password hashing ─────────────────────────────────────────────────────────
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── JWT config ───────────────────────────────────────────────────────────────
_JWT_ALGORITHM = "HS256"
_JWT_LIFETIME_SECONDS = 60 * 60 * 24 * 7  # 7 days


def _jwt_secret() -> str:
    """Resolve the JWT signing secret in order of precedence:

    1. Env var JWT_SECRET (production canonical source).
    2. db.get_config("jwt_secret") (admin-settable via app_config_settings).
    3. Auto-generated dev-only ephemeral secret (logged once as a warning).

    Never hardcoded in the module. Follows §S4.
    """
    env_secret = os.environ.get("JWT_SECRET")
    if env_secret:
        return env_secret
    stored = db.get_config("jwt_secret", None)
    if stored:
        return str(stored)
    # Dev fallback: generate + persist so restarts keep the same secret,
    # avoiding session invalidation on every reload.
    generated = secrets.token_urlsafe(48)
    db.set_config("jwt_secret", generated)
    logger.warning(
        "JWT_SECRET not set — generated ephemeral dev secret and persisted "
        "via db.set_config('jwt_secret'). Set JWT_SECRET in production."
    )
    return generated


# ── Data classes ─────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class UserRecord:
    user_id: int
    email: str
    display_name: str | None
    avatar_url: str | None
    is_active: bool
    is_verified: bool
    is_superuser: bool
    created_at: str
    last_login_at: str | None

    def to_public(self) -> dict[str, Any]:
        """Serialize for `/auth/me` and admin listings (no hashed_password)."""
        return {
            "user_id": self.user_id,
            "email": self.email,
            "display_name": self.display_name,
            "avatar_url": self.avatar_url,
            "is_active": self.is_active,
            "is_verified": self.is_verified,
            "is_superuser": self.is_superuser,
            "created_at": self.created_at,
            "last_login_at": self.last_login_at,
        }


# ── Password helpers ─────────────────────────────────────────────────────────
def hash_password(raw: str) -> str:
    return _pwd_context.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return _pwd_context.verify(raw, hashed)
    except Exception:  # malformed hash, algorithm mismatch, etc.
        return False


# ── User CRUD ────────────────────────────────────────────────────────────────
def _row_to_user(row: dict[str, Any]) -> UserRecord:
    return UserRecord(
        user_id=int(row["user_id"]),
        email=row["email"],
        display_name=row.get("display_name"),
        avatar_url=row.get("avatar_url"),
        is_active=bool(row.get("is_active", 1)),
        is_verified=bool(row.get("is_verified", 0)),
        is_superuser=bool(row.get("is_superuser", 0)),
        created_at=str(row.get("created_at") or ""),
        last_login_at=(str(row["last_login_at"]) if row.get("last_login_at") else None),
    )


def get_user_by_id(user_id: int, *, database: DatabaseManager | None = None) -> UserRecord | None:
    d = database or db
    df = d.query(f"SELECT * FROM {T.AUTH_USERS} WHERE user_id = %s LIMIT 1", (user_id,))
    if df.empty:
        return None
    return _row_to_user(df.iloc[0].to_dict())


def get_user_by_email(email: str, *, database: DatabaseManager | None = None) -> UserRecord | None:
    d = database or db
    df = d.query(f"SELECT * FROM {T.AUTH_USERS} WHERE lower(email) = lower(%s) LIMIT 1", (email,))
    if df.empty:
        return None
    return _row_to_user(df.iloc[0].to_dict())


def _get_password_hash(user_id: int, *, database: DatabaseManager | None = None) -> str | None:
    d = database or db
    df = d.query(f"SELECT hashed_password FROM {T.AUTH_USERS} WHERE user_id = %s", (user_id,))
    if df.empty:
        return None
    return df.iloc[0]["hashed_password"]


def create_user(
    *,
    email: str,
    password: str | None,
    display_name: str | None = None,
    is_active: bool = True,
    is_verified: bool = False,
    is_superuser: bool = False,
    default_role: str | None = "collector",
    database: DatabaseManager | None = None,
) -> UserRecord:
    """Create a user row and (optionally) assign a default role slug.

    Called by both password registration and OAuth first-login flows.
    `password=None` is valid — it produces an OAuth-only account.
    """
    d = database or db
    if get_user_by_email(email, database=d) is not None:
        raise ValueError("A user with this email already exists")

    hashed = hash_password(password) if password else None
    d.execute(
        f"""
        INSERT INTO {T.AUTH_USERS} (email, hashed_password, is_active, is_verified,
                           is_superuser, display_name)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (email, hashed, 1 if is_active else 0, 1 if is_verified else 0,
         1 if is_superuser else 0, display_name),
    )
    user = get_user_by_email(email, database=d)
    assert user is not None, "user vanished immediately after INSERT"

    if default_role:
        assign_role(user.user_id, default_role, database=d)

    logger.info("User created: user_id={} email={}", user.user_id, email)
    return user


def touch_last_login(user_id: int, *, database: DatabaseManager | None = None) -> None:
    d = database or db
    d.execute(
        f"UPDATE {T.AUTH_USERS} SET last_login_at = datetime('now') WHERE user_id = %s",
        (user_id,),
    )


def set_password(user_id: int, raw_password: str, *, database: DatabaseManager | None = None) -> None:
    d = database or db
    d.execute(
        f"UPDATE {T.AUTH_USERS} SET hashed_password = %s WHERE user_id = %s",
        (hash_password(raw_password), user_id),
    )


def set_verified(user_id: int, verified: bool, *, database: DatabaseManager | None = None) -> None:
    """Mark whether the user has proven control of their email address.

    Set by the verification and invitation flows — clicking a link delivered to
    an address is the proof — and never by the user directly.
    """
    d = database or db
    d.execute(
        f"UPDATE {T.AUTH_USERS} SET is_verified = %s WHERE user_id = %s",
        (1 if verified else 0, user_id),
    )


def set_active(user_id: int, active: bool, *, database: DatabaseManager | None = None) -> None:
    d = database or db
    d.execute(
        f"UPDATE {T.AUTH_USERS} SET is_active = %s WHERE user_id = %s",
        (1 if active else 0, user_id),
    )


# ── Role assignment ──────────────────────────────────────────────────────────
def _role_id(slug: str, *, database: DatabaseManager | None = None) -> int | None:
    d = database or db
    df = d.query(f"SELECT role_id FROM {T.AUTH_ROLES} WHERE slug = %s", (slug,))
    if df.empty:
        return None
    return int(df.iloc[0]["role_id"])


def assign_role(user_id: int, slug: str, *, database: DatabaseManager | None = None) -> bool:
    d = database or db
    rid = _role_id(slug, database=d)
    if rid is None:
        raise ValueError(f"unknown role slug: {slug}")
    # Idempotent — PK on (user_id, role_id) prevents duplicates.
    d.execute(
        f"INSERT OR IGNORE INTO {T.AUTH_USER_ROLES} (user_id, role_id) VALUES (%s, %s)",
        (user_id, rid),
    )
    return True


def revoke_role(user_id: int, slug: str, *, database: DatabaseManager | None = None) -> bool:
    d = database or db
    rid = _role_id(slug, database=d)
    if rid is None:
        return False
    d.execute(f"DELETE FROM {T.AUTH_USER_ROLES} WHERE user_id = %s AND role_id = %s", (user_id, rid))
    return True


def get_user_roles(user_id: int, *, database: DatabaseManager | None = None) -> list[str]:
    d = database or db
    df = d.query(
        f"""
        SELECT r.slug FROM {T.AUTH_USER_ROLES} ur
          JOIN {T.AUTH_ROLES} r ON r.role_id = ur.role_id
         WHERE ur.user_id = %s
         ORDER BY r.slug
        """,
        (user_id,),
    )
    return df["slug"].tolist() if not df.empty else []


# ── Authentication ───────────────────────────────────────────────────────────
def authenticate(email: str, password: str, *, database: DatabaseManager | None = None) -> UserRecord | None:
    d = database or db
    user = get_user_by_email(email, database=d)
    if user is None or not user.is_active:
        return None
    hashed = _get_password_hash(user.user_id, database=d)
    if not hashed or not verify_password(password, hashed):
        return None
    return user


# ── JWT & session persistence ────────────────────────────────────────────────
def create_access_token(
    user_id: int,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
    database: DatabaseManager | None = None,
    lifetime_seconds: int = _JWT_LIFETIME_SECONDS,
) -> str:
    """Mint a JWT and record its jti in user_sessions so it can be revoked."""
    d = database or db
    now = datetime.now(timezone.utc)
    expires = now + timedelta(seconds=lifetime_seconds)
    jti = secrets.token_urlsafe(24)
    payload = {
        "sub": str(user_id),
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
    }
    token = jwt.encode(payload, _jwt_secret(), algorithm=_JWT_ALGORITHM)
    d.execute(
        f"""
        INSERT INTO {T.AUTH_SESSIONS} (session_id, user_id, expires_at, ip_address, user_agent)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (jti, user_id, expires.isoformat(sep=" ", timespec="seconds"), ip, user_agent),
    )
    return token


def decode_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, _jwt_secret(), algorithms=[_JWT_ALGORITHM])
    except JWTError:
        return None


def is_session_revoked(jti: str, *, database: DatabaseManager | None = None) -> bool:
    d = database or db
    df = d.query(
        f"SELECT revoked_at FROM {T.AUTH_SESSIONS} WHERE session_id = %s LIMIT 1",
        (jti,),
    )
    if df.empty:
        # Unknown session id: treat as revoked so orphan tokens are rejected.
        return True
    return df.iloc[0]["revoked_at"] is not None


def revoke_session(jti: str, *, database: DatabaseManager | None = None) -> bool:
    d = database or db
    d.execute(
        f"UPDATE {T.AUTH_SESSIONS} SET revoked_at = datetime('now') WHERE session_id = %s",
        (jti,),
    )
    return True


def revoke_all_sessions(user_id: int, *, database: DatabaseManager | None = None) -> int:
    """Revoke every live session this user holds.

    Called on a password reset. A reset exists to end an attacker's access, and
    a rotated password does nothing about a JWT they already hold — the token
    is valid for seven days and carries no password material to invalidate.
    Without this, "I reset my password" and "they are locked out" are different
    statements.

    :returns: How many sessions were revoked.
    """
    d = database or db
    return d.execute(
        f"UPDATE {T.AUTH_SESSIONS} SET revoked_at = datetime('now') "
        f"WHERE user_id = %s AND revoked_at IS NULL",
        (user_id,),
    )
