"""
Module: tests/test_app_factory
Layer:  bedrock-api/tests
Desc:   `create_app()` assembles what `tests/conftest.py::build_app()` used to
        assemble by hand, and what two consumers each re-derived.

        These tests are the contract a consumer is entitled to rely on: the
        platform mount map, the seo router's deliberate absence from it, the
        error handlers, the rate limiter, and the order of the boot sequence.
        Each one exists because getting it wrong is silent — a missing
        `register_error_handlers()` turns a failed query into an empty grid,
        and a hook run on the wrong side of `apply_migrations()` reads a schema
        that is not there yet.
"""
from __future__ import annotations

import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient
from slowapi.errors import RateLimitExceeded

from bedrock.core.app_factory import (
    DEFAULT_CORS_ORIGINS,
    PLATFORM_ROUTER_MOUNTS,
    RouterMount,
    cors_origins_from_env,
    create_app,
)
from bedrock.core.database import DatabaseQueryError
from bedrock.core.stats import iter_route_specs


def _paths(app) -> set[str]:
    """Every mounted path, fully qualified.

    Through `iter_route_specs` rather than by reading `app.routes` directly:
    since FastAPI 0.139 / Starlette 1.3 an `include_router` call leaves an
    `_IncludedRouter` wrapper in the table whose children carry paths relative
    to their include prefix, so a naive walk of `app.routes` sees the four
    docs routes and nothing else. It reports that as an empty mount map with
    no error — which is exactly the silence these tests exist to break.
    """
    return {path for path, _methods, _name in iter_route_specs(app.routes)}


@pytest.fixture
def bare_app():
    """An app with no lifespan — the factory's assembly, with no database."""
    return create_app(title="Test", version="9.9.9", bootstrap=False)


# --- router mounting -------------------------------------------------------


def test_mounts_every_platform_router_under_its_prefix(bare_app):
    paths = _paths(bare_app)
    for prefix in PLATFORM_ROUTER_MOUNTS.values():
        assert any(
            path.startswith(prefix) for path in paths
        ), f"no route mounted under {prefix}"


def test_mount_map_covers_the_platform_route_modules():
    # A router added to the package but not to the map mounts nowhere, and the
    # only symptom is a 404 in a consumer months later.
    import pkgutil

    import bedrock.routes

    modules = {
        name
        for _, name, _ in pkgutil.iter_modules(bedrock.routes.__path__)
        if not name.startswith("_")
    }
    # `seo` is mounted unprefixed and so cannot live in a prefix map.
    assert modules - {"seo"} == set(PLATFORM_ROUTER_MOUNTS)


def test_seo_mounts_at_the_root_not_under_a_prefix(bare_app):
    paths = _paths(bare_app)
    assert "/robots.txt" in paths
    assert "/sitemap.xml" in paths


def test_seo_can_be_left_off():
    app = create_app(title="Test", bootstrap=False, mount_seo=False)
    assert "/robots.txt" not in _paths(app)


def test_host_routers_mount_with_their_prefix_and_tags():
    router = APIRouter()

    @router.get("/widgets")
    def _widgets() -> list[str]:
        return []

    app = create_app(
        title="Test",
        bootstrap=False,
        routers=[RouterMount(router, prefix="/api/v1/app", tags=["widgets"])],
    )
    assert "/api/v1/app/widgets" in _paths(app)


def test_host_routers_may_declare_absolute_paths():
    router = APIRouter()

    @router.get("/manifest.json")
    def _manifest() -> dict[str, str]:
        return {}

    app = create_app(title="Test", bootstrap=False, routers=[RouterMount(router)])
    assert "/manifest.json" in _paths(app)


# --- error handling and rate limiting --------------------------------------


def test_registers_the_platform_error_handlers(bare_app):
    # Registered, not hand-written per consumer: the handler logs the SQL and
    # keeps it out of the response body.
    assert DatabaseQueryError in bare_app.exception_handlers


def test_registers_bedrocks_own_rate_limit_handler(bare_app):
    assert RateLimitExceeded in bare_app.exception_handlers
    assert bare_app.state.limiter is not None


def test_a_failed_query_answers_with_the_platform_envelope(bare_app):
    router = APIRouter()

    @router.get("/boom")
    def _boom() -> None:
        raise DatabaseQueryError("SELECT secret FROM vault")

    bare_app.include_router(router)
    client = TestClient(bare_app, raise_server_exceptions=False)
    response = client.get("/boom")

    assert response.status_code == 500
    assert "secret" not in response.text  # the SQL goes to the log, never the wire


# --- CORS ------------------------------------------------------------------


def test_cors_origins_default_to_the_dev_server(monkeypatch):
    monkeypatch.delenv("CORS_ALLOWED_ORIGINS", raising=False)
    assert cors_origins_from_env() == list(DEFAULT_CORS_ORIGINS)


def test_cors_origins_read_the_environment(monkeypatch):
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "https://a.test, https://b.test ,")
    assert cors_origins_from_env() == ["https://a.test", "https://b.test"]


def test_cors_preflight_answers_a_configured_origin():
    app = create_app(title="Test", bootstrap=False, cors_origins=["https://a.test"])
    client = TestClient(app)
    response = client.options(
        "/robots.txt",
        headers={
            "Origin": "https://a.test",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.headers.get("access-control-allow-origin") == "https://a.test"


# --- the root probe --------------------------------------------------------


def test_no_root_route_unless_asked_for(bare_app):
    assert "/" not in _paths(bare_app)


def test_root_probe_reports_the_message():
    app = create_app(title="Test", bootstrap=False, root_message="App is running")
    assert TestClient(app).get("/").json() == {"message": "App is running"}


# --- the boot sequence -----------------------------------------------------


@pytest.fixture
def boot_recorder(monkeypatch):
    """Replace every step of the boot sequence with a call recorder."""
    from bedrock.core import database, db_health, migrations, schema_drift

    calls: list[str] = []

    def record(label: str):
        def _recorded(*_args, **_kwargs):
            calls.append(label)

        return _recorded

    monkeypatch.setattr(database.db, "validate_connection", record("validate"))
    monkeypatch.setattr(database.db, "close_pool", record("close"))
    monkeypatch.setattr(migrations, "apply_migrations", record("migrate"))
    monkeypatch.setattr(schema_drift, "warn_on_drift", record("drift"))
    monkeypatch.setattr(db_health, "assert_database_healthy", record("health"))
    return calls


def test_boot_sequence_runs_in_the_documented_order(boot_recorder):
    def before() -> None:
        boot_recorder.append("before")

    def after() -> None:
        boot_recorder.append("after")

    def down() -> None:
        boot_recorder.append("down")

    app = create_app(
        title="Test",
        before_migrations=[before],
        after_bootstrap=[after],
        on_shutdown=[down],
    )
    with TestClient(app):
        assert boot_recorder == ["validate", "before", "migrate", "drift", "health", "after"]

    assert boot_recorder == [
        "validate",
        "before",
        "migrate",
        "drift",
        "health",
        "after",
        "down",
        "close",
    ]


def test_hooks_run_in_the_order_given(boot_recorder):
    app = create_app(
        title="Test",
        before_migrations=[
            lambda: boot_recorder.append("first"),
            lambda: boot_recorder.append("second"),
        ],
    )
    with TestClient(app):
        pass

    assert boot_recorder.index("first") < boot_recorder.index("second") < boot_recorder.index(
        "migrate"
    )


def test_a_failing_hook_aborts_startup(boot_recorder):
    def explode() -> None:
        raise RuntimeError("pin not installed")

    app = create_app(title="Test", before_migrations=[explode])
    with pytest.raises(RuntimeError, match="pin not installed"):
        with TestClient(app):
            pass

    # Migrations must not have run against a host that refused to boot.
    assert "migrate" not in boot_recorder


def test_bootstrap_off_touches_no_database(boot_recorder, bare_app):
    with TestClient(bare_app):
        pass
    assert boot_recorder == []
