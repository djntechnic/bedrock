"""
Module:  auth.py
Layer:   api/routes
Desc:    Phase 5.2 — authentication endpoints (register, login, logout, me,
         password update). JWT is returned to the client on login/register
         and expected as `Authorization: Bearer <token>` on protected
         requests. Token issuance also records the JWT jti in user_sessions
         so P5.11 can revoke it server-side.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from loguru import logger
from pydantic import BaseModel, EmailStr, Field

from bedrock.core.rate_limit import (
    limiter, login_limit, register_limit, oauth_callback_limit,
)
from bedrock.dependencies import get_current_active_user
from bedrock.services import auth_activity_service as audit
from bedrock.services import oauth_service as oauth
from bedrock.services import user_service as us


router = APIRouter()


# ── Request / response models ────────────────────────────────────────────────
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=120)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserOut(BaseModel):
    user_id: int
    email: EmailStr
    display_name: str | None
    avatar_url: str | None
    is_active: bool
    is_verified: bool
    is_superuser: bool
    roles: list[str]
    created_at: str
    last_login_at: str | None


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


# ── Helpers ──────────────────────────────────────────────────────────────────
def _client_ip(request: Request) -> str | None:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else None


def _user_agent(request: Request) -> str | None:
    return request.headers.get("user-agent")


def _user_payload(user: us.UserRecord) -> dict:
    return {
        **user.to_public(),
        "roles": us.get_user_roles(user.user_id),
    }


# ── Endpoints ────────────────────────────────────────────────────────────────
@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED,
             description="Create a new password-based user. Returns a JWT immediately so the SPA can proceed straight to /me.")
@limiter.limit(register_limit)
def register(payload: RegisterIn, request: Request) -> TokenOut:
    """Create a new password-based user and immediately return an access token.

    Newly registered users are assigned the `collector` role by default.
    """
    try:
        user = us.create_user(
            email=payload.email,
            password=payload.password,
            display_name=payload.display_name,
            default_role="collector",
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    token = us.create_access_token(
        user.user_id, ip=_client_ip(request), user_agent=_user_agent(request)
    )
    us.touch_last_login(user.user_id)
    audit.record("register", user_id=user.user_id, request=request,
                 detail={"email": user.email})
    logger.info("Registered user_id={} email={}", user.user_id, user.email)
    return TokenOut(access_token=token, user=_user_payload(user))


@router.post("/login", response_model=TokenOut,
             description="Password login. Returns a JWT access token on success and 401 on invalid credentials.")
@limiter.limit(login_limit)
def login(payload: LoginIn, request: Request) -> TokenOut:
    user = us.authenticate(payload.email, payload.password)
    if user is None:
        audit.record("login_failed", request=request,
                     detail={"attempted_email": payload.email})
        logger.info("Failed login attempt for email={}", payload.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    token = us.create_access_token(
        user.user_id, ip=_client_ip(request), user_agent=_user_agent(request)
    )
    us.touch_last_login(user.user_id)
    audit.record("login_success", user_id=user.user_id, request=request)
    logger.info("Login success user_id={}", user.user_id)
    return TokenOut(access_token=token, user=_user_payload(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, user: Annotated[us.UserRecord, Depends(get_current_active_user)]):
    """Revoke the caller's current session (jti) so the token cannot be reused."""
    # dependency stores the decoded token payload on request.state
    payload = getattr(request.state, "jwt_payload", None) or {}
    jti = payload.get("jti")
    if jti:
        us.revoke_session(jti)
    audit.record("logout", user_id=user.user_id, request=request,
                 detail={"jti": jti})
    logger.info("Logout user_id={} jti={}", user.user_id, jti)
    return None


@router.get("/me", response_model=UserOut,
            description="Return the profile + role list for the caller identified by the Bearer token.")
def me(user: Annotated[us.UserRecord, Depends(get_current_active_user)]) -> UserOut:
    return UserOut(**_user_payload(user))


# ── Google OAuth (Phase 5.3) ─────────────────────────────────────────────────
class GoogleAuthorizeOut(BaseModel):
    authorization_url: str


class GoogleCallbackIn(BaseModel):
    code: str = Field(min_length=1, max_length=2048)
    state: str | None = None


@router.get("/google/authorize", response_model=GoogleAuthorizeOut)
async def google_authorize(state: str | None = None) -> GoogleAuthorizeOut:
    """Return the Google hosted-consent URL for the SPA to redirect to."""
    try:
        url = await oauth.build_authorize_url(state=state)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    return GoogleAuthorizeOut(authorization_url=url)


@router.post("/google/callback", response_model=TokenOut,
             description="Exchange a Google OAuth authorization code for a local JWT. Creates or links a user by email/sub.")
@limiter.limit(oauth_callback_limit)
async def google_callback(payload: GoogleCallbackIn, request: Request) -> TokenOut:
    """Exchange the authorization code for tokens, resolve/create the user,
    and issue a local JWT.
    """
    try:
        tokens = await oauth.exchange_code(payload.code)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    except Exception as exc:  # noqa: BLE001 - provider raised anything
        logger.warning("Google OAuth code exchange failed: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google authorization code exchange failed",
        ) from exc

    access_token = tokens.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google did not return an access_token",
        )
    try:
        profile = await oauth.fetch_google_profile(access_token)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Google userinfo fetch failed: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google userinfo fetch failed",
        ) from exc

    try:
        result = oauth.link_or_create_user(profile, tokens)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    jwt_token = us.create_access_token(
        result.user.user_id, ip=_client_ip(request), user_agent=_user_agent(request)
    )
    us.touch_last_login(result.user.user_id)
    if result.created:
        audit.record("oauth_new_user", user_id=result.user.user_id,
                     request=request, detail={"provider": "google"})
    elif result.linked:
        audit.record("oauth_link", user_id=result.user.user_id,
                     request=request, detail={"provider": "google"})
    audit.record("oauth_login", user_id=result.user.user_id,
                 request=request, detail={"provider": "google"})
    logger.info(
        "Google login user_id={} created={} linked={}",
        result.user.user_id, result.created, result.linked,
    )
    return TokenOut(access_token=jwt_token, user=_user_payload(result.user))


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT,
             description="Rotate the caller's password. Requires the current password and returns 401 on mismatch.")
def change_password(
    payload: ChangePasswordIn,
    request: Request,
    user: Annotated[us.UserRecord, Depends(get_current_active_user)],
):
    if us.authenticate(user.email, payload.current_password) is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect"
        )
    us.set_password(user.user_id, payload.new_password)
    audit.record("password_changed", user_id=user.user_id, request=request)
    logger.info("Password changed user_id={}", user.user_id)
    return None
