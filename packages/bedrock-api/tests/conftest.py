"""
Module:  conftest.py
Layer:   bedrock-api/tests
Desc:    Test harness for the platform package.

         The point of this file is what it does *not* do. MLBTracker's conftest
         copies a real database when one exists and seeds players, sports and
         checklist sets so its integration tests have foreign keys to hang off.
         Bedrock's builds an empty database from baseline.sql and seeds nothing
         beyond the platform's own bootstrap rows.

         That is the actual proof the extraction worked: a platform that can
         only be tested with baseball fixtures has not been extracted from
         baseball. Anything here that needs a player is in the wrong repo.
"""
from __future__ import annotations

import os
import pathlib
import sqlite3
import sys
import tempfile

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

PACKAGE_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PACKAGE_ROOT))

BASELINE = PACKAGE_ROOT / "bedrock" / "schema" / "baseline.sql"
SEED = PACKAGE_ROOT / "bedrock" / "schema" / "seed.sql"

#: Routers the platform mounts, with the prefixes an application is expected
#: to use. Kept here rather than in a fixture so a test can import it.
ROUTER_MOUNTS = {
    "health": "/api/v1",
    "config": "/api/v1/config",
    "auth": "/api/v1/auth",
    "modules": "/api/v1/modules",
    "user_preferences": "/api/v1/user-preferences",
    "admin_platform": "/api/v1/admin",
    "diagnostics": "/api/v1/diagnostics",
}


@pytest.fixture(scope="session", autouse=True)
def platform_db():
    """An empty platform database, built from the baseline schema alone."""
    tmpdir = tempfile.mkdtemp(prefix="bedrock-tests-")
    db_path = os.path.join(tmpdir, "platform.db")

    conn = sqlite3.connect(db_path)
    try:
        conn.executescript(BASELINE.read_text(encoding="utf-8"))
        conn.executescript(SEED.read_text(encoding="utf-8"))
        conn.commit()
    finally:
        conn.close()

    from bedrock.core.database import db

    original = (db.sqlite_path, db.is_postgres, db.db_url)
    db.sqlite_path = db_path
    db.is_postgres = False
    db.db_url = None
    db.close_pool()

    yield db_path

    db.close_pool()
    db.sqlite_path, db.is_postgres, db.db_url = original
    for suffix in ("", "-wal", "-shm", "-journal"):
        p = db_path + suffix
        if os.path.exists(p):
            try:
                os.remove(p)
            except OSError:
                pass


def build_app() -> FastAPI:
    """A bare FastAPI app with only the platform's routers mounted.

    No application routers, no domain registrations — if an endpoint works
    here, it works in an app that has never heard of baseball.

    Exposed as a plain function, not only a fixture, because the ported
    endpoint tests build their client at module scope. Constructing the app
    touches no database, so import order does not matter.
    """
    import importlib

    from slowapi.errors import RateLimitExceeded
    from slowapi.middleware import SlowAPIMiddleware

    from bedrock.core.error_handlers import register_error_handlers
    from bedrock.core.rate_limit import limiter, rate_limit_handler

    application = FastAPI()
    application.state.limiter = limiter
    register_error_handlers(application)
    # bedrock's own handler, not slowapi's default: it records the trip in the
    # auth activity log and returns the platform's error envelope. Wiring the
    # default here would quietly give the package a different 429 body than
    # every app that follows the documented setup.
    application.add_exception_handler(RateLimitExceeded, rate_limit_handler)
    application.add_middleware(SlowAPIMiddleware)
    for name, prefix in ROUTER_MOUNTS.items():
        module = importlib.import_module(f"bedrock.routes.{name}")
        application.include_router(module.router, prefix=prefix, tags=[name])
    return application


@pytest.fixture(scope="session")
def app(platform_db) -> FastAPI:
    return build_app()


@pytest.fixture
def client(app) -> TestClient:
    return TestClient(app)


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Rate limits are per-process state; a leaked counter fails the next test
    with a 429 that has nothing to do with what it is asserting."""
    from bedrock.core.rate_limit import limiter

    yield
    try:
        limiter.reset()
    except Exception:
        pass


@pytest.fixture
def real_auth_guards():
    """No-op, kept so the ported auth suites read unchanged.

    In MLBTracker this opts a test *out* of an autouse fixture that overrides
    `get_current_active_user` with a synthetic superuser — a concession to
    legacy tests that predate the role system. Bedrock has no such bypass:
    the real dependency chain is always in force, so requesting this fixture
    already describes the state of the world.
    """
    return None


@pytest.fixture
def clean_config():
    """Drop every app_config_settings row after the test."""
    from bedrock.core.database import db

    yield
    db.execute(f"DELETE FROM app_config_settings")
