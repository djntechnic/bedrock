"""
Module:  dependencies.py
Layer:   api/
Desc:    FastAPI dependency injection providers for database, configuration,
         and authenticated-user resolution (Phase 5.2). Also exposes the
         `require_role(slug)` factory (Phase 5.4) so any route can declare
         the minimum role needed to access it.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer

from bedrock.core.database import db
from bedrock.core.config import config
from bedrock.services import auth_activity_service as audit
from bedrock.services import user_service as us
from bedrock.services import module_service as ms


def get_db():
    return db


def get_app_config():
    return config


# ── Auth dependencies (Phase 5.2) ────────────────────────────────────────────
# tokenUrl mirrors the router mount in api/main.py so /docs shows the correct
# login endpoint for interactive testing.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def _unauth(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    request: Request,
    token: Annotated[str | None, Depends(oauth2_scheme)],
) -> us.UserRecord:
    """Resolve the caller from the Bearer token. 401 if invalid, expired, or revoked."""
    if not token:
        raise _unauth()
    payload = us.decode_token(token)
    if payload is None or "sub" not in payload or "jti" not in payload:
        raise _unauth("Invalid or expired token")
    if us.is_session_revoked(payload["jti"]):
        raise _unauth("Session has been revoked")
    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise _unauth("Invalid token subject")
    user = us.get_user_by_id(user_id)
    if user is None:
        raise _unauth("User no longer exists")
    # stash payload for downstream (e.g. /logout to revoke the current jti)
    request.state.jwt_payload = payload
    return user


def get_optional_user(
    request: Request,
    token: Annotated[str | None, Depends(oauth2_scheme)],
) -> us.UserRecord | None:
    """Resolve the caller if a valid Bearer token is present; return None otherwise.

    Never raises. Used by the cross-feature surfaces that stay open to
    anonymous readers — the player profile and the dashboard summary — but must
    omit their collection-derived section/field entirely for callers without
    the `collector` role (decision-v6 §1, RBAC design note §5). Those routes
    cannot use `get_current_user` (401s anonymous callers) or `require_role`
    (403s viewers), because the page itself must still render.
    """
    if not token:
        return None
    payload = us.decode_token(token)
    if payload is None or "sub" not in payload or "jti" not in payload:
        return None
    if us.is_session_revoked(payload["jti"]):
        return None
    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        return None
    user = us.get_user_by_id(user_id)
    if user is None or not user.is_active:
        return None
    request.state.jwt_payload = payload
    return user


def get_current_active_user(
    user: Annotated[us.UserRecord, Depends(get_current_user)],
) -> us.UserRecord:
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive"
        )
    return user


def get_current_admin(
    user: Annotated[us.UserRecord, Depends(get_current_active_user)],
) -> us.UserRecord:
    """Shortcut for endpoints that require the admin role."""
    roles = us.get_user_roles(user.user_id)
    if "admin" not in roles and not user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required"
        )
    return user


# ── Role hierarchy (Phase 5.4) ───────────────────────────────────────────────
# Higher index → more privileged. require_role(slug) admits any role at or
# above the requested level.
_ROLE_HIERARCHY: tuple[str, ...] = ("anon", "viewer", "collector", "admin")


def _max_level(user_slugs: list[str]) -> int:
    """Return the highest privilege level the user's roles map to. Admin
    supersedes everything even when other slugs are absent."""
    if not user_slugs:
        return -1
    best = -1
    for slug in user_slugs:
        try:
            level = _ROLE_HIERARCHY.index(slug)
            if level > best:
                best = level
        except ValueError:
            continue
    return best


def require_role(minimum_slug: str):
    """FastAPI dependency factory: enforce that the caller has at least the
    given role slug. Raises 401 for unauthenticated callers, 403 for
    authenticated-but-under-privileged callers.
    """
    if minimum_slug not in _ROLE_HIERARCHY:
        raise ValueError(f"unknown role slug: {minimum_slug}")
    min_level = _ROLE_HIERARCHY.index(minimum_slug)

    def _check(
        request: Request,
        user: Annotated[us.UserRecord, Depends(get_current_active_user)],
    ) -> us.UserRecord:
        if user.is_superuser:
            return user
        user_roles = us.get_user_roles(user.user_id)
        if _max_level(user_roles) < min_level:
            audit.record(
                "role_access_denied",
                user_id=user.user_id,
                request=request,
                detail={"required": minimum_slug, "path": request.url.path},
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "insufficient_role", "required": minimum_slug},
            )
        return user

    return Depends(_check)


# ── Module gating (Phase 5.9) ────────────────────────────────────────────────
def require_module(slug: str, *, allow_anon: bool = False):
    """FastAPI dependency factory: enforce that the caller has the named
    module enabled. When allow_anon=True, unauthenticated callers pass iff
    the anon role's default set includes the module — used on public
    browse endpoints (players, leaderboards, dashboard) so anonymous
    visitors can read even before login.
    """
    def _check(
        request: Request,
        token: Annotated[str | None, Depends(oauth2_scheme)] = None,
    ) -> us.UserRecord | None:
        # Anonymous branch: allow when the anon role has the module.
        if not token:
            if allow_anon and slug in ms.get_anon_modules():
                return None
            raise _unauth()

        payload = us.decode_token(token)
        if payload is None or "sub" not in payload or "jti" not in payload:
            raise _unauth("Invalid or expired token")
        if us.is_session_revoked(payload["jti"]):
            raise _unauth("Session has been revoked")
        try:
            user_id = int(payload["sub"])
        except (TypeError, ValueError):
            raise _unauth("Invalid token subject")
        user = us.get_user_by_id(user_id)
        if user is None or not user.is_active:
            raise _unauth("User inactive or missing")
        request.state.jwt_payload = payload

        if user.is_superuser:
            return user
        modules = ms.get_user_modules(user.user_id)
        if slug not in modules:
            audit.record(
                "module_access_denied",
                user_id=user.user_id,
                request=request,
                detail={"module": slug, "path": request.url.path},
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "module_disabled", "module": slug},
            )
        return user

    return Depends(_check)
