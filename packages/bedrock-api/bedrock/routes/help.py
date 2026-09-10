"""
Module:  help.py
Layer:   bedrock-api/routes
Desc:    Config-driven in-app quick help endpoints:
         - GET /api/v1/help/{topic_key} (public)
         - GET/POST/PATCH/DELETE /api/v1/admin/help (admin)
"""
from __future__ import annotations

from typing import Annotated, Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from bedrock.dependencies import require_permission, require_role
from bedrock.services import auth_activity_service as audit
from bedrock.services import help_service as hs
from bedrock.services import user_service as us

router = APIRouter(tags=["help"])


class HelpEntryCreateModel(BaseModel):
    topic_key: str
    title: str
    body_markdown: str
    doc_url: str | None = None
    doc_label: str | None = None


class HelpEntryUpdateModel(BaseModel):
    title: str | None = None
    body_markdown: str | None = None
    doc_url: str | None = None
    doc_label: str | None = None


# ── Public Endpoint ──────────────────────────────────────────────────────────

@router.get("/help/{topic_key}")
def get_help_entry(topic_key: str) -> dict[str, Any]:
    """Retrieve help topic details by topic_key (public)."""
    entry = hs.get_help_entry(topic_key)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Help topic '{topic_key}' not found",
        )
    return entry


# ── Admin Endpoints ──────────────────────────────────────────────────────────

@router.get("/admin/help", dependencies=[require_role("admin")])
def list_admin_help_entries() -> list[dict[str, Any]]:
    """List all help entries (admin only)."""
    return hs.list_help_entries()


@router.post(
    "/admin/help",
    status_code=status.HTTP_201_CREATED,
    dependencies=[require_role("admin")],
)
def create_admin_help_entry(
    payload: HelpEntryCreateModel,
    current_user: Annotated[us.UserRecord, require_role("admin")],
    request: Request,
) -> dict[str, Any]:
    """Create a new help entry (admin only)."""
    existing = hs.get_help_entry(payload.topic_key)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Help topic '{payload.topic_key}' already exists",
        )
    created = hs.create_help_entry(payload.model_dump(), actor=current_user.email)
    audit.record(
        "help_entry_created",
        user_id=current_user.user_id,
        request=request,
        detail={"topic_key": payload.topic_key},
    )
    return created


@router.patch(
    "/admin/help/{topic_key}",
    dependencies=[require_role("admin")],
)
def update_admin_help_entry(
    topic_key: str,
    payload: HelpEntryUpdateModel,
    current_user: Annotated[us.UserRecord, require_role("admin")],
    request: Request,
) -> dict[str, Any]:
    """Update an existing help entry (admin only)."""
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updated = hs.update_help_entry(topic_key, updates, actor=current_user.email)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Help topic '{topic_key}' not found",
        )
    audit.record(
        "help_entry_updated",
        user_id=current_user.user_id,
        request=request,
        detail={"topic_key": topic_key},
    )
    return updated


@router.delete(
    "/admin/help/{topic_key}",
    dependencies=[require_role("admin")],
)
def delete_admin_help_entry(
    topic_key: str,
    current_user: Annotated[us.UserRecord, require_role("admin")],
    request: Request,
) -> dict[str, Any]:
    """Delete a help entry (admin only)."""
    deleted = hs.delete_help_entry(topic_key, actor=current_user.email)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Help topic '{topic_key}' not found",
        )
    audit.record(
        "help_entry_deleted",
        user_id=current_user.user_id,
        request=request,
        detail={"topic_key": topic_key},
    )
    return {"status": "ok", "deleted": topic_key}
