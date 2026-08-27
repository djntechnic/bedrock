"""
Module:  app_factory.py
Layer:   bedrock-api/core
Desc:    `create_app()` — the platform's application assembly, as a function
         instead of as a fixture consumers copy.

         Until now the authoritative reference for how to stand a bedrock app
         up was `tests/conftest.py::build_app()`. A test fixture is not a
         public contract: it can be reordered, renamed or narrowed by a change
         that is green in this repo's own CI, and every consumer that copied it
         drifts silently. The knowledge it carried is exactly the knowledge a
         consumer gets wrong once and never notices —

           - which platform routers mount, in what order, under which prefixes;
           - that `bedrock.routes.seo` is **absent** from that map on purpose,
             because it declares absolute paths (`/robots.txt`, `/sitemap.xml`)
             and mounts with no prefix at all;
           - that `register_error_handlers()` must be called, or a failed grid
             query returns a silent empty array and the frontend renders an
             empty grid instead of an error state;
           - that the 429 handler is bedrock's, not slowapi's default, so the
             trip is recorded in the auth activity log and the body matches the
             platform envelope;
           - the order of the boot sequence, where `apply_migrations()` must
             follow whatever the host does to guarantee a schema exists.

         None of that is discoverable from the package. All of it is now one
         call, and this repo's own conftest makes that call, so the reference
         and the implementation cannot diverge.

         What stays with the host: its own routers, its static mounts, its
         middleware, and the eager side-effect imports that register its
         contributions to the platform's extension points. Registration must
         remain an import side effect — never a startup hook — because ASGI
         test transports do not run lifespan, and anything registered there is
         invisible to every endpoint test.

Usage:
        from bedrock.core.app_factory import create_app

        app = create_app(
            title="CollectIt API",
            version="0.1.0",
            routers=[RouterMount(r, prefix="/api/v1/collectit") for r in ROUTERS],
            before_migrations=[assert_pin_installed, lambda: ensure_baseline(db)],
            root_message="CollectIt API is running",
        )
"""
from __future__ import annotations

import importlib
import os
from collections.abc import Callable, Sequence
from contextlib import asynccontextmanager
from dataclasses import dataclass, field

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

#: Platform routers and the prefix each is expected to mount under, in mount
#: order. `seo` is deliberately not here — see `mount_seo` below.
PLATFORM_ROUTER_MOUNTS: dict[str, str] = {
    "health": "/api/v1",
    "config": "/api/v1/config",
    "auth": "/api/v1/auth",
    "modules": "/api/v1/modules",
    "user_preferences": "/api/v1/user-preferences",
    "admin_platform": "/api/v1/admin",
    "diagnostics": "/api/v1/diagnostics",
}

#: Where the browser is when nobody configured anything: the Vite dev server.
DEFAULT_CORS_ORIGINS = ("http://localhost:5173",)

_DEFAULT_CORS_METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
_DEFAULT_CORS_HEADERS = ("Authorization", "Content-Type", "X-Requested-With")


@dataclass(frozen=True)
class RouterMount:
    """One application router and where it hangs.

    :param router: The router to include.
    :param prefix: URL prefix, or `""` for a router declaring absolute paths.
    :param tags: OpenAPI tags. Empty means the router's own tags stand.
    """

    router: APIRouter
    prefix: str = ""
    tags: Sequence[str] = field(default_factory=tuple)


def cors_origins_from_env() -> list[str]:
    """CORS origins from `CORS_ALLOWED_ORIGINS`, comma-separated.

    Read from the environment rather than from `app_config_settings` because
    this runs at import time, and a config read here would trigger the
    database's lazy init before a test fixture has repointed it at an
    ephemeral database.

    :returns: The configured origins, or the dev-server default.
    """
    raw = os.environ.get("CORS_ALLOWED_ORIGINS", "")
    origins = [o.strip() for o in str(raw).split(",") if o.strip()]
    return origins or list(DEFAULT_CORS_ORIGINS)


def _run_hooks(hooks: Sequence[Callable[[], None]], phase: str) -> None:
    for hook in hooks:
        name = getattr(hook, "__name__", repr(hook))
        logger.debug("bedrock boot: {} hook {}", phase, name)
        hook()


def create_app(
    *,
    title: str,
    version: str = "0.1.0",
    description: str = "",
    routers: Sequence[RouterMount] = (),
    before_migrations: Sequence[Callable[[], None]] = (),
    after_bootstrap: Sequence[Callable[[], None]] = (),
    on_shutdown: Sequence[Callable[[], None]] = (),
    cors_origins: Sequence[str] | None = None,
    mount_seo: bool = True,
    bootstrap: bool = True,
    root_message: str | None = None,
) -> FastAPI:
    """Assemble a FastAPI application with the platform already wired.

    Mounts every platform router, registers the platform's exception handlers
    and rate limiter, installs CORS, and — unless `bootstrap` is off — runs the
    database boot sequence in lifespan.

    :param title: OpenAPI title.
    :param version: Application version, reported by `/docs` and the health route.
    :param description: OpenAPI description.
    :param routers: The host's own routers. Mounted after the platform's, so a
        platform router added in a later release cannot be shadowed by one of
        the host's without the collision being visible in the route table.
    :param before_migrations: Callables run after the connection is validated
        and before `apply_migrations()` — where a host puts anything that has to
        guarantee a schema exists first.
    :param after_bootstrap: Callables run once the database is up and healthy:
        schedulers, warm caches, background workers.
    :param on_shutdown: Callables run on the way down, before the pool closes.
    :param cors_origins: Explicit origins. `None` reads the environment.
    :param mount_seo: Mount `bedrock.routes.seo` at the root. It declares
        absolute paths, so it takes no prefix and cannot go in the mount map.
        Off for an application with no public face.
    :param bootstrap: Install the lifespan boot sequence. `False` builds the
        app without touching a database, which is what a test harness wants.
    :param root_message: When set, serve `GET /` returning `{"message": ...}` —
        a liveness probe for a browser hitting the bare origin.
    :returns: The assembled application.
    """
    from slowapi.errors import RateLimitExceeded
    from slowapi.middleware import SlowAPIMiddleware

    from bedrock.core.error_handlers import register_error_handlers
    from bedrock.core.rate_limit import limiter, rate_limit_handler

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        from bedrock.core import database, db_health, migrations, schema_drift

        database.db.validate_connection()
        _run_hooks(before_migrations, "before_migrations")
        # Since v0.2.1 a failing migration raises and aborts startup rather
        # than logging and skipping — a half-migrated schema is worse than a
        # process that refuses to serve.
        migrations.apply_migrations()
        # Advisory only: logs WARNING on drift, never raises.
        schema_drift.warn_on_drift()
        # Fail fast if the database is corrupt or was silently rebuilt empty.
        # Set BEDROCK_ALLOW_EMPTY_DB=1 on a fresh checkout.
        db_health.assert_database_healthy()
        _run_hooks(after_bootstrap, "after_bootstrap")
        yield
        _run_hooks(on_shutdown, "on_shutdown")
        database.db.close_pool()

    app = FastAPI(
        title=title,
        version=version,
        description=description,
        lifespan=lifespan if bootstrap else None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(cors_origins) if cors_origins is not None else cors_origins_from_env(),
        allow_credentials=True,
        allow_methods=list(_DEFAULT_CORS_METHODS),
        allow_headers=list(_DEFAULT_CORS_HEADERS),
    )

    register_error_handlers(app)

    # bedrock's 429 handler, not slowapi's default: it records the trip in the
    # auth activity log and returns the platform's error envelope. Wiring the
    # default gives an app a different 429 body than every app that followed
    # the documented setup.
    app.state.limiter = limiter
    # Starlette types every handler's second parameter as bare `Exception`, so a
    # correctly narrowed handler never satisfies it — slowapi's own documented
    # registration has the same complaint.
    app.add_exception_handler(RateLimitExceeded, rate_limit_handler)  # type: ignore[arg-type]
    app.add_middleware(SlowAPIMiddleware)

    for name, prefix in PLATFORM_ROUTER_MOUNTS.items():
        module = importlib.import_module(f"bedrock.routes.{name}")
        app.include_router(module.router, prefix=prefix, tags=[name])

    if mount_seo:
        seo = importlib.import_module("bedrock.routes.seo")
        app.include_router(seo.router, tags=["seo"])

    for mount in routers:
        kwargs: dict[str, object] = {"prefix": mount.prefix}
        if mount.tags:
            kwargs["tags"] = list(mount.tags)
        app.include_router(mount.router, **kwargs)  # type: ignore[arg-type]

    if root_message is not None:

        @app.get("/")
        def root() -> dict[str, str]:
            """Liveness probe for a browser hitting the bare origin."""
            return {"message": root_message}

    return app
