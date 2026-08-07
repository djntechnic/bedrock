"""
Module:  rate_limit.py
Layer:   api/core
Desc:    Phase 5.7 — SlowAPI-based rate limiting. Provides a shared
         limiter singleton and a small helper to peel the caller's IP
         out of the request (respecting X-Forwarded-For behind proxies).

         Limits are §S4-driven: read from db.get_config("rate_limit_*")
         with sensible defaults; admins can adjust without a deploy.

         Wire the limiter in api/main.py:
             app.state.limiter = limiter
             app.add_middleware(SlowAPIMiddleware)
             app.add_exception_handler(RateLimitExceeded, ratelimit_handler)

         Decorate hot auth endpoints:
             @router.post("/login")
             @limiter.limit(login_limit())
             def login(request: Request, ...):
"""
from __future__ import annotations

from fastapi import Request
from loguru import logger
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.responses import JSONResponse


def _client_key(request: Request) -> str:
    """Prefer X-Forwarded-For (first hop) when present, else the direct
    peer. Mirrors the auth-log IP extraction so audit + limits stay in
    sync."""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return get_remote_address(request)


# In-memory storage is fine for a single-process app; switching to
# redis://... is a config change if we ever horizontally scale.
limiter = Limiter(key_func=_client_key, default_limits=[])


def login_limit() -> str:
    """SlowAPI limit string for /auth/login (attempts per minute per IP)."""
    from bedrock.core.database import db
    return str(db.get_config("rate_limit_login", "10/minute"))


def register_limit() -> str:
    from bedrock.core.database import db
    return str(db.get_config("rate_limit_register", "5/minute"))


def oauth_callback_limit() -> str:
    from bedrock.core.database import db
    return str(db.get_config("rate_limit_oauth_callback", "10/minute"))


def password_reset_limit() -> str:
    """Limit for the endpoints that send mail to an address on request.

    Per hour rather than per minute, and tighter than login, because the abuse
    this bounds is different: each accepted request costs an outbound email, so
    an unbounded endpoint is a way to mail-bomb someone else's inbox from your
    domain. It also caps how fast the endpoint can be farmed for the timing
    differences its fixed response is designed to hide.
    """
    from bedrock.core.database import db
    return str(db.get_config("rate_limit_password_reset", "5/hour"))


def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """FastAPI exception handler. Records the trip in auth_activity_log
    so admins can spot brute-force attempts in the Security Log tab.
    """
    from bedrock.services import auth_activity_service as _audit

    _audit.record(
        "rate_limit_tripped",
        request=request,
        detail={"path": request.url.path, "limit": str(exc.detail)},
    )
    logger.warning("Rate limit tripped path={} detail={}", request.url.path, exc.detail)
    return JSONResponse(
        status_code=429,
        content={
            "detail": {
                "code": "rate_limit_exceeded",
                "message": "Too many requests. Try again shortly.",
                "limit": str(exc.detail),
            }
        },
        headers={"Retry-After": "60"},
    )
