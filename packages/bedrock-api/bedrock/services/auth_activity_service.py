"""
Module:  auth_activity_service.py
Layer:   api/services
Desc:    Phase 5.10 — persisted, admin-visible audit trail for every
         security-relevant event. Distinct from §S3 application logs:
         this table is what the Admin → Security Log tab queries.

         Callers should use `record(event_type, ...)`; keep the surface
         additive so wiring a new event never requires changing the
         function signature.
"""
from __future__ import annotations

import json
from typing import Any

from fastapi import Request
from loguru import logger

from bedrock.core.database import db, DatabaseManager
from bedrock.core.schema_catalog import Tables as T


# Canonical event vocabulary — keep synced with schema comment on
# auth_activity_log.event_type. Extending is fine; renaming isn't
# (Admin log filters query by these strings).
EVENT_TYPES: frozenset[str] = frozenset({
    "register",
    "login_success",
    "login_failed",
    "logout",
    "oauth_login",
    "oauth_link",
    "oauth_new_user",
    "password_reset_request",
    "password_reset_complete",
    "password_changed",
    "email_verification_request",
    "email_verified",
    "role_granted",
    "role_revoked",
    "role_access_denied",
    "module_granted",
    "module_revoked",
    "module_access_denied",
    "user_deactivated",
    "user_reactivated",
    "user_invited",
    "session_revoked",
    "rate_limit_tripped",
    # ── Phase 5.0.1 (#183) — admin config-write audit coverage ──────────────
    "config_setting_changed",
    "config_setting_created",
    "config_setting_deleted",
    "grid_setting_changed",
    "grid_column_setting_changed",
    "season_updated",
    "alias_updated",
    "alias_deleted",
    "admin_inventory_write",
})


def _client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else None


def _user_agent(request: Request | None) -> str | None:
    if request is None:
        return None
    return request.headers.get("user-agent")


def record(
    event_type: str,
    *,
    user_id: int | None = None,
    target_user_id: int | None = None,
    request: Request | None = None,
    detail: dict[str, Any] | None = None,
    database: DatabaseManager | None = None,
) -> None:
    """Persist one audit-log row. Never raises — logging must not break
    the caller's response.
    """
    if event_type not in EVENT_TYPES:
        # Still record it (audit forensics > vocabulary purity) but warn.
        logger.warning("auth_activity_service.record: unknown event_type={}", event_type)
    d = database or db
    detail_json = json.dumps(detail, default=str) if detail else None
    try:
        d.execute(
            f"""
            INSERT INTO {T.AUTH_ACTIVITY_LOG}
                (event_type, user_id, target_user_id, actor_ip, user_agent, detail_json)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (event_type, user_id, target_user_id,
             _client_ip(request), _user_agent(request), detail_json),
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to write auth_activity_log ({}): {}", event_type, exc)


def query_events(
    *,
    event_type: str | None = None,
    user_id: int | None = None,
    since: str | None = None,
    until: str | None = None,
    limit: int = 100,
    offset: int = 0,
    database: DatabaseManager | None = None,
) -> list[dict[str, Any]]:
    """Return recent events joined to user emails. Used by
    GET /admin/security/events."""
    d = database or db
    where: list[str] = []
    params: list[Any] = []
    if event_type:
        where.append("aal.event_type = %s")
        params.append(event_type)
    if user_id is not None:
        where.append("(aal.user_id = %s OR aal.target_user_id = %s)")
        params.extend([user_id, user_id])
    if since:
        where.append("aal.event_ts >= %s")
        params.append(since)
    if until:
        where.append("aal.event_ts <= %s")
        params.append(until)
    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    limit = max(1, min(int(limit), 500))
    offset = max(0, int(offset))
    params.extend([limit, offset])

    sql = f"""
        SELECT aal.event_id, aal.event_ts, aal.event_type,
               aal.user_id, aal.target_user_id,
               aal.actor_ip, aal.user_agent, aal.detail_json,
               u_actor.email  AS user_email,
               u_target.email AS target_user_email
          FROM {T.AUTH_ACTIVITY_LOG} aal
          LEFT JOIN {T.AUTH_USERS} u_actor  ON u_actor.user_id  = aal.user_id
          LEFT JOIN {T.AUTH_USERS} u_target ON u_target.user_id = aal.target_user_id
          {where_sql}
         ORDER BY aal.event_ts DESC, aal.event_id DESC
         LIMIT %s OFFSET %s
    """
    df = d.query(sql, tuple(params))
    if df.empty:
        return []
    rows = df.to_dict(orient="records")
    # Deserialize detail_json for the frontend.
    for row in rows:
        raw = row.get("detail_json")
        if raw:
            try:
                row["detail"] = json.loads(raw)
            except (ValueError, TypeError):
                row["detail"] = None
        else:
            row["detail"] = None
        row.pop("detail_json", None)
    return rows
