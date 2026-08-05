"""
Module:  admin_users_service.py
Layer:   api/services
Desc:    Phase 5.8 / 5.11 / 5.12 — data access for the Admin Users, Sessions,
         and Security Log tabs. Route handlers in api/routes/admin.py must
         call these helpers instead of hitting the DatabaseManager directly
         (Phase 5.d boundary rule enforced by scripts/maintenance/audit_grids.py).
"""
from __future__ import annotations

from typing import Any

from bedrock.core.database import db
from bedrock.core.schema_catalog import Tables as T


def get_admin_user_row(user_id: int) -> dict[str, Any] | None:
    """Return the admin-view columns for one user, or None if missing."""
    df = db.query(
        f"SELECT user_id, email, display_name, is_active, is_verified, "
        f"is_superuser, created_at, last_login_at FROM {T.AUTH_USERS} WHERE user_id = %s",
        (user_id,),
    )
    if df.empty:
        return None
    return df.iloc[0].to_dict()


def list_admin_user_rows() -> list[dict[str, Any]]:
    """Full user list ordered by newest-first `created_at`. Used by the P5.8 Users tab."""
    df = db.query(
        f"SELECT user_id, email, display_name, is_active, is_verified, "
        f"is_superuser, created_at, last_login_at FROM {T.AUTH_USERS} "
        f"ORDER BY created_at DESC"
    )
    if df.empty:
        return []
    return df.to_dict(orient="records")


def get_admin_users_counts() -> dict[str, int]:
    """Aggregate active/inactive counts for the Admin dashboard KPI tile."""
    df = db.query(
        f"SELECT COUNT(*) AS total, "
        f"SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active "
        f"FROM {T.AUTH_USERS}"
    )
    if df.empty:
        return {"total": 0, "active": 0, "inactive": 0}
    total = int(df.iloc[0]["total"] or 0)
    active = int(df.iloc[0]["active"] or 0)
    return {"total": total, "active": active, "inactive": max(0, total - active)}


def list_admin_sessions() -> list[dict[str, Any]]:
    """Return the 500 most-recent user_sessions rows joined to their user email."""
    df = db.query(
        f"SELECT s.session_id, s.user_id, u.email, s.ip_address, s.user_agent, "
        f"s.created_at, s.expires_at, s.revoked_at "
        f"FROM {T.AUTH_SESSIONS} s JOIN {T.AUTH_USERS} u ON u.user_id = s.user_id "
        f"ORDER BY s.created_at DESC LIMIT 500"
    )
    if df.empty:
        return []
    return df.to_dict(orient="records")


def get_session_owner(session_id: str) -> int | None:
    """Return the user_id that owns `session_id`, or None when unknown."""
    df = db.query(
        f"SELECT user_id FROM {T.AUTH_SESSIONS} WHERE session_id = %s",
        (session_id,),
    )
    if df.empty:
        return None
    return int(df.iloc[0]["user_id"])


def snapshot_config_row(key: str) -> dict[str, Any] | None:
    """Serialize the app_config_settings row for `key` for before/after audit
    payloads. Non-scalar column types are stringified so the caller can safely
    JSON-serialize the returned mapping.
    """
    df = db.query(f"SELECT * FROM {T.APP_CONFIG_SETTINGS} WHERE key = %s", (key,))
    if df.empty:
        return None
    return {
        k: (v if v is None or isinstance(v, (int, float, str, bool)) else str(v))
        for k, v in df.iloc[0].to_dict().items()
    }
