"""
Module:  security.py
Layer:   bedrock-api/routes
Desc:    Granular security, role matrix, and access inspection endpoints.
"""
from __future__ import annotations

from typing import Annotated, Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from bedrock.dependencies import get_optional_user, require_permission, get_current_active_user
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


@router.get("/me/permissions")
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


class UserOverrideItemPayload(BaseModel):
    module_id: int
    can_view: bool | None = None
    can_update: bool | None = None
    can_delete: bool | None = None
    can_execute: bool | None = None


class UserOverridesBulkRequest(BaseModel):
    overrides: list[UserOverrideItemPayload]


@router.get("/users/{user_id}/profile")
def get_user_security_profile_endpoint(
    user_id: int,
    current_user: Annotated[us.UserRecord, Depends(get_current_active_user)],
) -> dict[str, Any]:
    """Return complete compiled security profile for user inspector."""
    if current_user.user_id != user_id:
        roles = us.get_user_roles(current_user.user_id)
        if "admin" not in roles and not current_user.is_superuser:
            raise HTTPException(
                status_code=403,
                detail="Admin permission required to view another user's security profile",
            )
    try:
        prof = ss.get_user_security_profile(user_id)
        user_info = prof["user"]
        roles = [r["slug"] for r in prof.get("roles", [])]
        return {
            "user_id": user_info["user_id"],
            "email": user_info["email"],
            "is_superuser": bool(user_info["is_superuser"]),
            "roles": roles,
            "overrides": prof.get("overrides", {}),
            "effective": prof.get("effective", {}),
            "capabilities": prof.get("effective", {}),
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/users/{user_id}/overrides", dependencies=[require_permission("admin", "view")])
def get_user_overrides_endpoint(
    user_id: int,
) -> list[dict[str, Any]]:
    """Return all modules with granular override states for user."""
    return ss.get_user_overrides_list(user_id)


@router.put("/users/{user_id}/overrides", dependencies=[require_permission("admin", "update")])
def set_user_overrides_bulk_endpoint(
    user_id: int,
    req: UserOverridesBulkRequest,
    current_user: Annotated[us.UserRecord, require_permission("admin", "update")],
    request: Request,
) -> list[dict[str, Any]]:
    """Bulk update user granular capability overrides."""
    raw_overrides = [o.model_dump() for o in req.overrides]
    res = ss.update_user_overrides_bulk(user_id, raw_overrides, actor=current_user.email)
    audit.record(
        "user_overrides_updated",
        user_id=current_user.user_id,
        target_user_id=user_id,
        request=request,
        detail={"count": len(req.overrides)},
    )
    return res
