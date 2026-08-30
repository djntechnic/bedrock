"""
Module:  modules.py
Layer:   api/routes
Desc:    Phase 5.9 — module registry endpoints.

         Public:
           GET /modules/me      — resolved module slugs for the caller
                                  (anon role defaults when unauthenticated)

         Admin:
           GET  /modules/registry           — full module catalogue
           GET  /modules/users/{user_id}    — role defaults + effective set +
                                              per-user overrides for one user
           PUT  /modules/users/{user_id}    — bulk-write overrides for one user
"""
from __future__ import annotations

from typing import Annotated, Literal, Any

from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from pydantic import BaseModel

from bedrock.dependencies import (
    get_current_active_user,
    oauth2_scheme,
    require_role,
    require_permission,
)
from bedrock.services import module_service as ms
from bedrock.services import user_service as us


router = APIRouter()


@router.get("", dependencies=[require_permission("admin", "view")])
def list_all_modules() -> list[dict[str, Any]]:
    """Return all registered functional modules with boolean is_core."""
    return ms.list_modules_public()

# ── Public: caller's own module set ─────────────────────────────────────────
class MeModulesOut(BaseModel):
    authenticated: bool
    modules: list[str]


@router.get("/me", response_model=MeModulesOut,
            description="Return the module slugs enabled for the caller. Anonymous callers receive the anon role's default set.")
def my_modules(request: Request, token: Annotated[str | None, Depends(oauth2_scheme)] = None) -> MeModulesOut:
    if not token:
        return MeModulesOut(authenticated=False, modules=sorted(ms.get_anon_modules()))
    payload = us.decode_token(token)
    if payload is None or "sub" not in payload or "jti" not in payload:
        return MeModulesOut(authenticated=False, modules=sorted(ms.get_anon_modules()))
    if us.is_session_revoked(payload["jti"]):
        return MeModulesOut(authenticated=False, modules=sorted(ms.get_anon_modules()))
    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        return MeModulesOut(authenticated=False, modules=sorted(ms.get_anon_modules()))
    user = us.get_user_by_id(user_id)
    if user is None or not user.is_active:
        return MeModulesOut(authenticated=False, modules=sorted(ms.get_anon_modules()))
    request.state.jwt_payload = payload
    mods = sorted(ms.get_user_modules(user.user_id))
    return MeModulesOut(authenticated=True, modules=mods)


# ── Admin: registry & override management ────────────────────────────────────
class ModuleOut(BaseModel):
    module_id: int
    slug: str
    label: str
    description: str | None
    sort_order: int
    is_core: bool


class UserModuleDetailOut(BaseModel):
    user_id: int
    role_defaults: list[str]
    overrides: dict[str, bool]
    effective: list[str]


class OverrideIn(BaseModel):
    slug: str
    # true → force enable, false → force disable, null → clear override
    granted: bool | None


class OverridesBulkIn(BaseModel):
    overrides: list[OverrideIn]


@router.get("/registry", response_model=list[ModuleOut],
            description="Admin-only: list every module in the registry with its slug, label, description, and core flag.")
def module_registry(_user=require_role("admin")) -> list[ModuleOut]:
    return [ModuleOut(**m.to_public()) for m in ms.list_modules()]


@router.get("/users/{user_id}", response_model=UserModuleDetailOut,
            description="Admin-only: return the role defaults, per-user overrides, and effective module set for one user.")
def user_modules(user_id: int, _user=require_role("admin")) -> UserModuleDetailOut:
    user = us.get_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    # Role defaults for this user's assigned roles.
    role_map = ms.list_role_module_defaults()
    role_defaults: set[str] = set()
    for slug in us.get_user_roles(user_id):
        role_defaults |= role_map.get(slug, set())
    return UserModuleDetailOut(
        user_id=user_id,
        role_defaults=sorted(role_defaults),
        overrides=ms.list_user_overrides(user_id),
        effective=sorted(ms.get_user_modules(user_id)),
    )


@router.put("/users/{user_id}", response_model=UserModuleDetailOut,
            description="Admin-only: bulk-write per-user module overrides. granted=true/false sets an override; granted=null clears it.")
def set_user_modules(
    user_id: int,
    body: OverridesBulkIn,
    actor: Annotated[us.UserRecord, Depends(get_current_active_user)],
    _admin=require_role("admin"),
) -> UserModuleDetailOut:
    if us.get_user_by_id(user_id) is None:
        raise HTTPException(status_code=404, detail="User not found")
    for entry in body.overrides:
        try:
            ms.set_user_module_override(
                user_id, entry.slug, entry.granted, actor_user_id=actor.user_id
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    return user_modules(user_id, _user=actor)
