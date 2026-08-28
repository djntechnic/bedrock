"""
Module:  security.py
Layer:   bedrock-api/routes
Desc:    Granular security, role matrix, and access inspection endpoints.
"""
from __future__ import annotations

from typing import Annotated, Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from bedrock.dependencies import get_optional_user, require_permission
from bedrock.services import auth_activity_service as audit
from bedrock.services import security_service as ss
from bedrock.services import user_service as us

router = APIRouter(tags=["security"])


class CreateRoleRequest(BaseModel):
    slug: str = Field(..., min_length=2, max_length=50)
    label: str = Field(..., min_length=2, max_length=100)
    description: str | None = None


class UpdateRoleRequest(BaseModel):
    label: str | None = None
    description: str | None = None


class MatrixCellUpdate(BaseModel):
    role_id: int
    module_id: int
    can_view: bool = False
    can_update: bool = False
    can_delete: bool = False
    can_execute: bool = False


class UpdateMatrixRequest(BaseModel):
    updates: list[MatrixCellUpdate]


class UserOverrideRequest(BaseModel):
    module_slug: str
    capabilities: dict[str, bool | None]  # e.g. {"view": True, "update": False, "delete": None, "execute": None}


@router.get("/my-permissions")
def get_my_permissions(
    user: Annotated[us.UserRecord | None, Depends(get_optional_user)],
) -> dict[str, dict[str, bool]]:
    """Return effective permissions dictionary for current caller (or anonymous)."""
    user_id = user.user_id if user else None
    is_su = user.is_superuser if user else False
    return ss.resolve_user_permissions(user_id, is_superuser=is_su)


@router.get("/roles", dependencies=[require_permission("admin", "view")])
def list_all_roles() -> list[dict[str, Any]]:
    """List all available roles with user counts."""
    return ss.list_roles()


@router.post("/roles", dependencies=[require_permission("admin", "update")])
def create_role(
    req: CreateRoleRequest,
    current_user: Annotated[us.UserRecord, require_permission("admin", "update")],
    request: Request,
) -> dict[str, Any]:
    """Create a new custom application role."""
    try:
        role = ss.create_custom_role(
            slug=req.slug,
            label=req.label,
            description=req.description,
            created_by=current_user.email,
        )
        audit.record(
            "role_granted",
            user_id=current_user.user_id,
            request=request,
            detail={"role": req.slug, "action": "create_role"},
        )
        return role
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/roles/{role_id}", dependencies=[require_permission("admin", "update")])
def update_role_endpoint(
    role_id: int,
    req: UpdateRoleRequest,
    current_user: Annotated[us.UserRecord, require_permission("admin", "update")],
) -> dict[str, Any]:
    """Update custom role metadata."""
    try:
        return ss.update_role(
            role_id=role_id,
            label=req.label,
            description=req.description,
            modified_by=current_user.email,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/roles/{role_id}", dependencies=[require_permission("admin", "delete")])
def delete_role_endpoint(
    role_id: int,
    current_user: Annotated[us.UserRecord, require_permission("admin", "delete")],
) -> dict[str, bool]:
    """Delete a custom role."""
    try:
        ss.delete_custom_role(role_id, actor=current_user.email)
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/matrix", dependencies=[require_permission("admin", "view")])
def get_matrix() -> list[dict[str, Any]]:
    """Return full permissions matrix across all roles and modules."""
    return ss.get_role_permissions_matrix()


@router.put("/matrix", dependencies=[require_permission("admin", "update")])
def update_matrix_endpoint(
    req: UpdateMatrixRequest,
    current_user: Annotated[us.UserRecord, require_permission("admin", "update")],
    request: Request,
) -> dict[str, bool]:
    """Bulk update role capability flags."""
    raw_updates = [u.model_dump() for u in req.updates]
    ss.update_role_matrix(raw_updates, modified_by=current_user.email)
    audit.record(
        "role_matrix_updated",
        user_id=current_user.user_id,
        request=request,
        detail={"count": len(req.updates)},
    )
    return {"ok": True}


@router.get("/users/{user_id}/profile", dependencies=[require_permission("admin", "view")])
def get_user_security_profile_endpoint(
    user_id: int,
) -> dict[str, Any]:
    """Return complete compiled security profile for user inspector."""
    try:
        return ss.get_user_security_profile(user_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/users/{user_id}/overrides", dependencies=[require_permission("admin", "update")])
def set_user_override_endpoint(
    user_id: int,
    req: UserOverrideRequest,
    current_user: Annotated[us.UserRecord, require_permission("admin", "update")],
    request: Request,
) -> dict[str, bool]:
    """Set or clear tri-state granular overrides for a user on a module."""
    try:
        ss.set_user_granular_override(
            user_id=user_id,
            module_slug=req.module_slug,
            capabilities=req.capabilities,
            actor=current_user.email,
        )
        audit.record(
            "user_override_changed",
            user_id=current_user.user_id,
            target_user_id=user_id,
            request=request,
            detail={"module": req.module_slug, "capabilities": req.capabilities},
        )
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
