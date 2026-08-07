from fastapi import APIRouter, Body, Depends, HTTPException, Query, BackgroundTasks, Request
from typing import Annotated, List, Optional
from pydantic import BaseModel, EmailStr, Field
from bedrock.core.database import db as _db
from bedrock.core.schema_catalog import Tables as T
from bedrock.dependencies import require_role
from bedrock.mail import service as _mailer
from bedrock.services import user_service as _us
from bedrock.services import auth_activity_service as _audit
from bedrock.services import admin_users_service as _admin_users
from bedrock.schemas.admin import (
    DatabaseTableSchema, DatabaseSummarySchema,
    ConfigSettingSchema, ConfigCreateSchema, GridSettingSchema, GridColumnSettingSchema,
    ExportLogSchema, ExportRunSchema,
    ActivityLogSchema, SyncRunSchema, SyncStatusSchema
)
from bedrock.schemas.base import ApiResponse
from bedrock.services.admin_service import (
    list_config_settings_service,
    create_config_setting_service,
    update_config_setting_service,
    delete_config_setting_service,
    list_grid_settings_service,
    list_grid_pages_service,
    list_grid_columns_service,
    update_grid_setting_service,
    update_grid_column_service,
    create_grid_column_service,
    delete_grid_column_service,
    log_export_service,
    list_export_history_service,
    get_sync_state_service,
    get_audit_run_service,
    get_database_summary_service,
    list_system_logs_service,
    get_sync_schedule_service,
    get_sync_status_service,
    count_running_syncs_service,
    list_ui_query_config_service,
    update_ui_query_config_service,
    list_audit_history_service,
    AdminValidationError,
    AdminNotFoundError,
    AdminConflictError,
    AdminForbiddenError,
)
import subprocess
import sys
import os

router = APIRouter(dependencies=[require_role("admin")])

# ─── Users (Phase 5.8) ──────────────────────────────────────────────────────

class AdminUserRow(BaseModel):
    user_id: int
    email: str
    display_name: str | None
    is_active: bool
    is_verified: bool
    is_superuser: bool
    roles: list[str]
    created_at: str
    last_login_at: str | None

class UserUpdatePayload(BaseModel):
    is_active: bool | None = None
    roles: list[str] | None = None

class UserInvitePayload(BaseModel):
    email: EmailStr
    display_name: str | None = Field(default=None, max_length=120)
    role: str = Field(default="collector")
    #: Set a password directly instead of letting the invitee choose one. This
    #: predates the invitation email and is kept for the case where an admin is
    #: provisioning an account out of band; the normal path is to omit it.
    password: str | None = Field(default=None, min_length=8, max_length=128)
    #: Send the invitation email. Off means the admin will deliver access some
    #: other way — useful when creating a service account nobody reads mail for.
    send_email: bool = True

def _row_to_admin_user(row: dict) -> AdminUserRow:
    roles = _us.get_user_roles(int(row["user_id"]))
    return AdminUserRow(
        user_id=int(row["user_id"]),
        email=str(row["email"]),
        display_name=row.get("display_name"),
        is_active=bool(row.get("is_active", 1)),
        is_verified=bool(row.get("is_verified", 0)),
        is_superuser=bool(row.get("is_superuser", 0)),
        roles=roles,
        created_at=str(row.get("created_at") or ""),
        last_login_at=(str(row["last_login_at"]) if row.get("last_login_at") else None),
    )


@router.get("/users/summary", response_model=ApiResponse[dict],
            description="Aggregate active/inactive user counts for the Admin dashboard KPI tile. Admin only.")

def get_users_summary(_admin: Annotated[_us.UserRecord, require_role("admin")]):
    """Aggregate counts for the Admin dashboard KPI tile."""
    return ApiResponse(status="ok", data=_admin_users.get_admin_users_counts())


@router.get("/users", response_model=ApiResponse[list[AdminUserRow]],
            description="List every user with role slugs and status for the Admin Users tab. Admin only.")

def list_users(_admin: Annotated[_us.UserRecord, require_role("admin")]):
    """Full user list with role slugs for the P5.8 Users tab."""
    rows = _admin_users.list_admin_user_rows()
    return ApiResponse(status="ok", data=[_row_to_admin_user(r) for r in rows])


@router.get("/users/{user_id}", response_model=ApiResponse[AdminUserRow],
            description="Fetch a single user by id with roles + status. Returns 404 if the user does not exist. Admin only.")

def get_user(
    user_id: int,
    _admin: Annotated[_us.UserRecord, require_role("admin")],
):
    row = _admin_users.get_admin_user_row(user_id)
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    return ApiResponse(status="ok", data=_row_to_admin_user(row))


@router.patch("/users/{user_id}", response_model=ApiResponse[AdminUserRow],
              description="Toggle is_active and/or replace the role set for one user. Admins cannot deactivate themselves or remove their own admin role (409). Admin only.")

def update_user(
    user_id: int,
    payload: UserUpdatePayload,
    request: Request,
    admin: Annotated[_us.UserRecord, require_role("admin")],
):
    """Toggle active state and/or replace the role set for one user.

    Admin self-protection:
    - cannot deactivate own account.
    - cannot remove the `admin` role from their own account.
    """
    target = _us.get_user_by_id(user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.is_active is not None:
        if target.user_id == admin.user_id and not payload.is_active:
            raise HTTPException(status_code=409,
                                detail="Admins cannot deactivate their own account")
        _us.set_active(target.user_id, payload.is_active)
        _audit.record(
            "user_deactivated" if not payload.is_active else "user_reactivated",
            user_id=admin.user_id, target_user_id=target.user_id, request=request,
            detail={"is_active": payload.is_active},
        )

    if payload.roles is not None:
        new_roles = set(payload.roles)
        if target.user_id == admin.user_id and "admin" not in new_roles:
            raise HTTPException(status_code=409,
                                detail="Admins cannot remove the admin role from their own account")
        current = set(_us.get_user_roles(target.user_id))
        for slug in current - new_roles:
            if _us.revoke_role(target.user_id, slug):
                _audit.record("role_revoked", user_id=admin.user_id,
                              target_user_id=target.user_id, request=request,
                              detail={"role": slug})
        for slug in new_roles - current:
            if _us.assign_role(target.user_id, slug):
                _audit.record("role_granted", user_id=admin.user_id,
                              target_user_id=target.user_id, request=request,
                              detail={"role": slug})

    fresh = _admin_users.get_admin_user_row(target.user_id)
    assert fresh is not None, "user vanished immediately after update"
    return ApiResponse(status="ok", data=_row_to_admin_user(fresh))


@router.post("/users/invite", response_model=ApiResponse[AdminUserRow], status_code=201,
             description="Create a new user with the given role. `password` is optional — omit to create an OAuth-only account. Admin only.")

def invite_user(
    payload: UserInvitePayload,
    request: Request,
    admin: Annotated[_us.UserRecord, require_role("admin")],
):
    """Create a new user and email them a link to set their password.

    Until F1 this endpoint created an account and stopped — there was no way to
    tell the invitee it existed, so "invite" meant "an admin now reads the
    password out over some other channel". The email is what makes the name
    accurate.

    `password` is still honoured for out-of-band provisioning, and
    `send_email: false` skips the mail entirely. The response `message` says
    which of those happened, because an admin who thinks an email went out and
    is wrong will wait for a reply that never comes.
    """
    try:
        provisional = payload.password or None
        new_user = _us.create_user(
            email=payload.email,
            password=provisional,
            display_name=payload.display_name,
            default_role=payload.role,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    invite_sent = False
    if payload.send_email:
        invite_sent = _mailer.send_invite(
            user_id=new_user.user_id,
            email=new_user.email,
            display_name=new_user.display_name,
            invited_by=admin.email,
        )

    _audit.record("user_invited", user_id=admin.user_id,
                  target_user_id=new_user.user_id, request=request,
                  detail={"email": new_user.email, "role": payload.role,
                          "invite_email_sent": invite_sent})
    fresh = _admin_users.get_admin_user_row(new_user.user_id)
    assert fresh is not None, "user vanished immediately after invite"

    if invite_sent:
        message = f"Invitation sent to {new_user.email}."
    elif payload.send_email:
        message = (
            f"User created, but the invitation email to {new_user.email} was "
            "not sent — no mail provider is configured, or delivery failed. "
            "Check the server log."
        )
    else:
        message = f"User created. No invitation email was sent to {new_user.email}."
    return ApiResponse(status="ok", message=message, data=_row_to_admin_user(fresh))


# ─── Sessions (Phase 5.11 backend) ──────────────────────────────────────────

class AdminSessionRow(BaseModel):
    """A user_sessions row. `session_id` is the JWT jti."""
    session_id: str
    user_id: int
    email: str
    ip_address: str | None
    user_agent: str | None
    created_at: str
    expires_at: str | None
    revoked_at: str | None


@router.get("/sessions", response_model=ApiResponse[list[AdminSessionRow]],
            description="Return the 500 most recent auth sessions with user email joined. Powers the Admin Sessions tab. Admin only.")

def list_sessions(_admin: Annotated[_us.UserRecord, require_role("admin")]):
    """Return recent auth sessions joined to users for the Sessions tab."""
    rows = _admin_users.list_admin_sessions()
    out = [
        AdminSessionRow(
            session_id=str(r["session_id"]),
            user_id=int(r["user_id"]),
            email=str(r["email"]),
            ip_address=(str(r["ip_address"]) if r.get("ip_address") else None),
            user_agent=(str(r["user_agent"]) if r.get("user_agent") else None),
            created_at=str(r["created_at"]),
            expires_at=(str(r["expires_at"]) if r.get("expires_at") else None),
            revoked_at=(str(r["revoked_at"]) if r.get("revoked_at") else None),
        )
        for r in rows
    ]
    return ApiResponse(status="ok", data=out)


@router.delete("/sessions/{session_id}", status_code=204,
               description="Revoke a session by its session_id (JWT jti). Subsequent requests with that token return 401. Admin only.")

def revoke_session(
    session_id: str,
    request: Request,
    admin: Annotated[_us.UserRecord, require_role("admin")],
):
    target_user_id = _admin_users.get_session_owner(session_id)
    if target_user_id is None:
        raise HTTPException(status_code=404, detail="Session not found")
    _us.revoke_session(session_id)
    _audit.record("session_revoked", user_id=admin.user_id,
                  target_user_id=target_user_id, request=request,
                  detail={"session_id": session_id})
    return None


# ─── Security events viewer (Phase 5.12 backend) ────────────────────────────

class SecurityEventRow(BaseModel):
    event_id: int
    event_ts: str
    event_type: str
    user_id: int | None
    user_email: str | None
    target_user_id: int | None
    target_user_email: str | None
    actor_ip: str | None
    user_agent: str | None
    detail: dict | None


@router.get("/security/events", response_model=ApiResponse[dict],
            description="Paginated auth_activity_log query with optional event_type and user_id filters. Powers the Admin Security Log tab. Admin only.")

def security_events(
    _admin: Annotated[_us.UserRecord, require_role("admin")],
    event_type: str | None = None,
    user_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
):
    from bedrock.services.auth_activity_service import query_events
    limit = max(1, min(500, limit))
    offset = max(0, offset)
    events = query_events(event_type=event_type, user_id=user_id,
                          limit=limit, offset=offset)
    rows = [
        SecurityEventRow(
            event_id=int(e["event_id"]),
            event_ts=str(e["event_ts"]),
            event_type=str(e["event_type"]),
            user_id=(int(e["user_id"]) if e.get("user_id") is not None else None),
            user_email=(str(e["user_email"]) if e.get("user_email") else None),
            target_user_id=(int(e["target_user_id"]) if e.get("target_user_id") is not None else None),
            target_user_email=(str(e["target_user_email"]) if e.get("target_user_email") else None),
            actor_ip=(str(e["actor_ip"]) if e.get("actor_ip") else None),
            user_agent=(str(e["user_agent"]) if e.get("user_agent") else None),
            detail=e.get("detail"),
        ).model_dump()
        for e in events
    ]
    return ApiResponse(status="ok", data={"events": rows, "limit": limit, "offset": offset})

# ─── KPI ─────────────────────────────────────────────────────────────────────

@router.get("/database/summary", response_model=ApiResponse[DatabaseSummarySchema])
def get_database_summary():
    """
    Overview of database size, tables, and their row counts & sizes.
    """
    try:
        return ApiResponse(status="ok", data=get_database_summary_service())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api-health", response_model=ApiResponse[list])
def get_api_health(request: Request):
    """
    Retrieve listing of versioned API routes with call statistics and inline documentation
    extracted from the OpenAPI schema (docstrings, parameters, response models, examples).
    """
    from bedrock.core.stats import api_stats, iter_route_specs
    from datetime import datetime, timedelta

    now = datetime.now()
    cutoff = now - timedelta(hours=24)

    # Build OpenAPI doc lookup keyed by (method, path)
    openapi_schema = request.app.openapi()
    paths = openapi_schema.get("paths", {})
    doc_lookup: dict[tuple[str, str], dict] = {}
    for path_str, path_item in paths.items():
        for method_str, op in path_item.items():
            if method_str.upper() not in ("GET", "POST", "PUT", "PATCH", "DELETE"):
                continue
            params = []
            for p in op.get("parameters", []):
                params.append({
                    "name": p.get("name"),
                    "in": p.get("in"),
                    "required": p.get("required", False),
                    "type": p.get("schema", {}).get("type", "string"),
                    "description": p.get("description", ""),
                    "default": p.get("schema", {}).get("default"),
                })
            # Extract request body fields if present
            body_fields = []
            rb = op.get("requestBody", {})
            if rb:
                content = rb.get("content", {})
                schema_ref = (
                    content.get("application/json", {})
                    .get("schema", {})
                )
                # Resolve $ref if needed
                if "$ref" in schema_ref:
                    ref_name = schema_ref["$ref"].split("/")[-1]
                    schema_ref = openapi_schema.get("components", {}).get("schemas", {}).get(ref_name, {})
                for fname, fschema in schema_ref.get("properties", {}).items():
                    required_fields = schema_ref.get("required", [])
                    body_fields.append({
                        "name": fname,
                        "type": fschema.get("type", "any"),
                        "required": fname in required_fields,
                        "description": fschema.get("description", ""),
                        "default": fschema.get("default"),
                    })

            # Extract response schema name
            responses = op.get("responses", {})
            response_schema = None
            for status_code, resp in responses.items():
                if str(status_code).startswith("2"):
                    ref = (
                        resp.get("content", {})
                        .get("application/json", {})
                        .get("schema", {})
                        .get("$ref", "")
                    )
                    if ref:
                        response_schema = ref.split("/")[-1]
                    break

            doc_lookup[(method_str.upper(), path_str)] = {
                "summary": op.get("summary", ""),
                "description": op.get("description", ""),
                "parameters": params,
                "body_fields": body_fields,
                "response_schema": response_schema,
                "tags": op.get("tags", []),
            }

    routes_info = []
    for full_path, methods, name in iter_route_specs(request.app.routes):
        if not full_path.startswith("/api/v1"):
            continue
        for method in methods:
            key = (method, full_path)
            stats = api_stats.get(key, {"hits": 0, "errors": 0, "last_accessed": None, "timestamps": []})
            active_timestamps = [t for t in stats.get("timestamps", []) if t > cutoff]
            if key in api_stats:
                api_stats[key]["timestamps"] = active_timestamps

            docs = doc_lookup.get(key, {})
            routes_info.append({
                "method": method,
                "path": full_path,
                "name": name,
                "hits": stats["hits"],
                "hits_24h": len(active_timestamps),
                "errors": stats["errors"],
                "last_accessed": stats["last_accessed"],
                "status": "Error" if stats["errors"] > 0 else "Healthy",
                # documentation
                "summary": docs.get("summary", ""),
                "description": docs.get("description", ""),
                "parameters": docs.get("parameters", []),
                "body_fields": docs.get("body_fields", []),
                "response_schema": docs.get("response_schema"),
                "tags": docs.get("tags", []),
                "documented": bool(docs.get("description", "").strip()),
            })

    return ApiResponse(status="ok", data=routes_info)

# ─── Config Settings ─────────────────────────────────────────────────────────

@router.get("/config", response_model=ApiResponse[List[ConfigSettingSchema]])
def get_config_settings(category: Optional[str] = Query(default=None)):
    """List app config settings, optionally filtered by category."""
    return ApiResponse(status="ok", data=list_config_settings_service(category=category))

@router.post("/config", response_model=ApiResponse[dict])
def create_config_setting(body: ConfigCreateSchema, request: Request):
    """Create a new app config setting. Audited to auth_activity_log."""
    try:
        result = create_config_setting_service(
            key=body.key,
            value=body.value,
            value_type=body.value_type,
            description=body.description,
            category=body.category,
        )
    except AdminConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    _audit.record("config_setting_created", request=request,
                  detail={"table": "app_config_settings", "key": body.key,
                          "action": "insert",
                          "value": {"value": body.value, "value_type": body.value_type,
                                    "category": body.category}})
    return ApiResponse(status="ok", data=result)

@router.patch("/config/{key:path}", response_model=ApiResponse[dict])
def update_config_setting(key: str, body: dict, request: Request):
    """Update whitelisted fields on an app config setting. Audited (before/after)."""
    before = _admin_users.snapshot_config_row(key)
    try:
        result = update_config_setting_service(key=key, body=body)
    except AdminValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except AdminNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    after = _admin_users.snapshot_config_row(key)
    _audit.record("config_setting_changed", request=request,
                  detail={"table": "app_config_settings", "key": key,
                          "before": before, "after": after})
    return ApiResponse(status="ok", data=result)

@router.delete("/config/{key:path}", response_model=ApiResponse[dict])
def delete_config_setting(key: str, request: Request):
    """Delete an app config setting by key. Audited."""
    before = _admin_users.snapshot_config_row(key)
    try:
        result = delete_config_setting_service(key=key)
    except AdminNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    _audit.record("config_setting_deleted", request=request,
                  detail={"table": "app_config_settings", "key": key,
                          "action": "delete", "value": before})
    return ApiResponse(status="ok", data=result)

# ─── Grid Settings ────────────────────────────────────────────────────────────

@router.get("/grids", response_model=ApiResponse[List[GridSettingSchema]])
def get_grid_settings():
    """List all grid-level UI settings."""
    return ApiResponse(status="ok", data=list_grid_settings_service())

@router.get("/grids/pages", response_model=ApiResponse[List[str]])
def get_grid_pages():
    """Distinct set of page names for the admin Grid Editor's Screen dropdown."""
    return ApiResponse(status="ok", data=list_grid_pages_service())

@router.get("/grids/{grid_id}/columns", response_model=ApiResponse[List[GridColumnSettingSchema]])
def get_grid_columns(grid_id: str):
    """Ordered list of column configurations for `grid_id`."""
    return ApiResponse(status="ok", data=list_grid_columns_service(grid_id=grid_id))

@router.patch("/grids/{grid_id}/columns/{column_id}", response_model=ApiResponse[dict])
def update_grid_column(grid_id: str, column_id: str, body: dict, request: Request):
    """Update whitelisted column-level settings. Audited."""
    try:
        result = update_grid_column_service(grid_id=grid_id, column_id=column_id, body=body)
    except AdminValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    _audit.record("grid_column_setting_changed", request=request,
                  detail={"table": "app_grid_column_settings",
                          "grid_id": grid_id, "column_id": column_id,
                          "body": body})
    return ApiResponse(status="ok", data=result)

@router.post("/grids/{grid_id}/columns", response_model=ApiResponse[dict])
def create_grid_column(grid_id: str, body: dict):
    """Insert a new column into `app_grid_column_settings`.

    Body must include a non-empty `column_id`. All other fields are
    filtered through the shared `_GRID_COLUMN_UPDATE_ALLOWED` whitelist.
    """
    try:
        result = create_grid_column_service(grid_id=grid_id, body=body)
    except AdminValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except AdminNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except AdminConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return ApiResponse(status="ok", data=result)

@router.delete("/grids/{grid_id}/columns/{column_id}", response_model=ApiResponse[dict])
def delete_grid_column(grid_id: str, column_id: str):
    """Delete a column row from `app_grid_column_settings`."""
    try:
        result = delete_grid_column_service(grid_id=grid_id, column_id=column_id)
    except AdminNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return ApiResponse(status="ok", data=result)

@router.patch("/grids/{grid_id}", response_model=ApiResponse[dict])
def update_grid_setting(grid_id: str, body: dict, request: Request):
    """Update whitelisted grid-level settings. Audited."""
    try:
        result = update_grid_setting_service(grid_id=grid_id, body=body)
    except AdminValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    _audit.record("grid_setting_changed", request=request,
                  detail={"table": "app_grid_settings", "grid_id": grid_id,
                          "body": body})
    return ApiResponse(status="ok", data=result)

# ─── Exports ──────────────────────────────────────────────────────────────────

@router.post("/exports/log", response_model=ApiResponse[dict])
def log_export(payload: ExportLogSchema):
    """
    Log a CSV or PDF export event.

    Args:
        payload: Metadata about the export.

    Returns:
        ApiResponse: Success message.
    """
    try:
        # Record export activity for auditing and usage analysis.
        log_export_service(
            export_type=payload.export_type,
            page=payload.page,
            row_count=payload.row_count,
            user_note=payload.user_note,
        )
        return ApiResponse(status="ok", data={"message": "Export logged"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/exports", response_model=ApiResponse[List[ExportRunSchema]])
def get_export_history():
    """
    Retrieve recent export history.

    Returns:
        ApiResponse: List of recent export records.
    """
    try:
        # Fetch last 100 export events.
        rows = list_export_history_service(limit=100)
        return ApiResponse(status="ok", data=rows)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── Logs & Sync ─────────────────────────────────────────────────────────────

@router.get("/logs", response_model=ApiResponse[list])
def get_logs(
    source: Optional[str] = Query(default=None),
    # source: activity | import | export | all (default)
    event_type: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None),  # ISO date string
    date_to: Optional[str] = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
):
    """
    Unified log view. Merges log_activity, import_runs events, and
    sys_export_runs into a single chronological list.

    Args:
        source: Filter by log source.
        event_type: Filter by category of event.
        date_from: Start of date range.
        date_to: End of date range.
        limit: Max number of log entries to return.

    Returns:
        ApiResponse: Combined list of system, import, and export logs.
    """
    try:
        rows = list_system_logs_service(
            source=source, event_type=event_type,
            date_from=date_from, date_to=date_to, limit=limit,
        )
        return ApiResponse(status="ok", data=rows)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sync/schedule", response_model=ApiResponse[dict])
def get_sync_schedule(limit: int = Query(default=50, ge=1, le=200)):
    """
    Sync run history from import_runs.
    Returns recent runs with source, status, trigger, duration, row counts.

    Args:
        limit: Max number of history entries to return.

    Returns:
        ApiResponse: Recent sync history and upcoming scheduled tasks.
    """
    try:
        schedule = get_sync_schedule_service(limit=limit)
        return ApiResponse(
            status="ok",
            data={
                "history": schedule["history"],
                "orphaned_runs": schedule["orphaned_runs"],
                "next_scheduled": [
                    {
                        "label": "MLB API Sync",
                        "time": "06:30 CT daily",
                        "note": "Windows Task Scheduler — local machine",
                    },
                    {
                        "label": "MLB API Sync",
                        "time": "10:30 CT daily",
                        "note": "Windows Task Scheduler — local machine",
                    },
                ],
                "next_scheduled_note": (
                    "Exact next run time not available — scheduled via Windows Task Scheduler on local machine. "
                    "MLB API sync runs are now logged to import_runs as of Phase 12.07.05. "
                    "Historical MLB API runs prior to this fix will not appear in the run history."
                ),
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sync/status", response_model=ApiResponse[SyncStatusSchema])
def get_sync_status():
    """
    Retrieve sync history and current status.

    Returns:
        ApiResponse: Current system status, last sync timestamp, and errors.
    """
    try:
        status = get_sync_status_service()
        return ApiResponse(
            status="ok",
            data=SyncStatusSchema(
                last_sync_ts=status["last_sync_ts"],
                last_sync_error=status["last_sync_error"],
                is_running=status["is_running"],
                recent_runs=status["recent_runs"],
            )
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/lookup/ui-query-config", response_model=ApiResponse[list])
def get_ui_query_config():
    """Return all UI hook query configuration rows."""
    return ApiResponse(status="ok", data=list_ui_query_config_service())


@router.patch("/lookup/ui-query-config/{hook_name}",
              response_model=ApiResponse[dict])

def update_ui_query_config(hook_name: str, body: dict):
    """Update stale time or refetch interval for a hook.
    Path parameters: hook_name (path).
    Request body: JSON payload with the fields to apply for this operation.
    """
    try:
        return ApiResponse(
            status="ok",
            data=update_ui_query_config_service(hook_name=hook_name, body=body),
        )
    except AdminValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Player Aliases ───────────────────────────────────────────────────────────

@router.get("/audit", response_model=ApiResponse[dict])
def run_audit(skip_db: bool = Query(default=False)):
    """
    Run the project audit toolkit and return findings as structured JSON.
    Saves results to sys_audit_runs table for history tracking.
    """
    import json as _json
    cmd = [sys.executable, "scripts/audit_project.py", "--json",
           "--triggered-by", "api"]
    if skip_db:
        cmd.append("--no-db")
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
            cwd=os.path.join(os.path.dirname(__file__), "..", ".."),
        )
        if result.returncode != 0 and not result.stdout:
            raise HTTPException(status_code=500, detail=result.stderr[:500])
        findings = _json.loads(result.stdout)
        return ApiResponse(status="ok", data=findings)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Audit timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/audit/history", response_model=ApiResponse)
def get_audit_history(limit: int = Query(20, ge=1, le=100)):
    """Return past audit runs from the sys_audit_runs table."""
    return ApiResponse(status="ok", data=list_audit_history_service(limit=limit))

@router.get("/audit/history/{run_id}", response_model=ApiResponse)
def get_audit_run(run_id: int):
    """Return findings for a specific audit run.
    Path parameters: run_id (path).
    """
    import math as _math, json as _j
    row = get_audit_run_service(run_id=run_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Audit run {run_id} not found")
    def _nv(v):
        return None if (v is None or (isinstance(v, float) and _math.isnan(v))) else v
    findings = []
    try:
        raw = _nv(row.get("findings"))
        if raw:
            findings = _j.loads(raw)
    except Exception:
        pass
    checks = []
    try:
        raw = _nv(row.get("checks_run"))
        if raw:
            checks = _j.loads(raw)
    except Exception:
        pass
    return ApiResponse(status="ok", data={
        "id": int(row["id"]),
        "run_at": _nv(row.get("run_at")),
        "triggered_by": _nv(row.get("triggered_by")) or "unknown",
        "checks_run": checks,
        "findings": findings,
        "summary": {
            "P1": int(row.get("summary_p1") or 0),
            "P2": int(row.get("summary_p2") or 0),
            "P3": int(row.get("summary_p3") or 0),
            "total": int(row.get("total") or 0),
        },
        "duration_ms": int(row["duration_ms"]) if _nv(row.get("duration_ms")) is not None else None,
    })


# ── Security log (Phase 5.10) ────────────────────────────────────────────────
from bedrock.dependencies import require_role as _require_role  # noqa: E402
from bedrock.services import auth_activity_service as _audit    # noqa: E402

@router.get("/security/events")
def list_security_events(
    event_type: Optional[str] = Query(default=None),
    user_id: Optional[int] = Query(default=None),
    since: Optional[str] = Query(default=None, description="ISO timestamp lower bound"),
    until: Optional[str] = Query(default=None, description="ISO timestamp upper bound"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _admin=_require_role("admin"),
):
    """Paginated, filterable view over auth_activity_log for the Admin
    Security Log tab. Admin-only.
    """
    events = _audit.query_events(
        event_type=event_type,
        user_id=user_id,
        since=since,
        until=until,
        limit=limit,
        offset=offset,
    )
    return ApiResponse(status="ok", data={
        "events": events,
        "limit": limit,
        "offset": offset,
        "count": len(events),
    })
