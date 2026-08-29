"""
Module:  navigation.py
Layer:   bedrock-api/routes
Desc:    Dynamic navigation settings, spacers, and customization endpoints.
"""
from __future__ import annotations

from typing import Annotated, Any
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from bedrock.dependencies import require_permission
from bedrock.services import auth_activity_service as audit
from bedrock.services import nav_service as ns
from bedrock.services import user_service as us

router = APIRouter(tags=["navigation"])


class NavItemSettingModel(BaseModel):
    nav_key: str
    parent_key: str | None = None
    sort_order: int = 0
    label_override: str | None = None
    icon_override: str | None = None
    tooltip_override: str | None = None
    is_hidden_override: bool = False


class UpdateNavSettingsRequest(BaseModel):
    settings: list[NavItemSettingModel]


@router.get("/settings")
def get_navigation_settings() -> list[dict[str, Any]]:
    """Get all navigation item settings (accessible by all users and anonymous)."""
    return ns.get_nav_settings()


@router.put("/settings", dependencies=[require_permission("admin", "update")])
def update_navigation_settings(
    req: UpdateNavSettingsRequest,
    current_user: Annotated[us.UserRecord, require_permission("admin", "update")],
    request: Request,
) -> list[dict[str, Any]]:
    """Bulk update dynamic navigation ordering, labels, icons, tooltips, and visibility."""
    raw_settings = [s.model_dump() for s in req.settings]
    result = ns.update_nav_settings(raw_settings, actor=current_user.email)
    audit.record(
        "nav_settings_updated",
        user_id=current_user.user_id,
        request=request,
        detail={"count": len(req.settings)},
    )
    return result


@router.delete("/settings", dependencies=[require_permission("admin", "update")])
def reset_navigation_settings(
    current_user: Annotated[us.UserRecord, require_permission("admin", "update")],
    request: Request,
) -> list[dict[str, Any]]:
    """Reset all dynamic navigation settings back to application code defaults."""
    result = ns.reset_nav_settings(actor=current_user.email)
    audit.record(
        "nav_settings_reset",
        user_id=current_user.user_id,
        request=request,
        detail={"action": "reset_all"},
    )
    return result


@router.delete("/settings/{nav_key:path}", dependencies=[require_permission("admin", "update")])
def delete_navigation_setting(
    nav_key: str,
    current_user: Annotated[us.UserRecord, require_permission("admin", "update")],
    request: Request,
) -> list[dict[str, Any]]:
    """Delete a specific navigation setting or custom spacer."""
    result = ns.delete_nav_setting(nav_key, actor=current_user.email)
    audit.record(
        "nav_setting_deleted",
        user_id=current_user.user_id,
        request=request,
        detail={"nav_key": nav_key},
    )
    return result
