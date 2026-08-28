"""Tests for the API-docs reconciliation gate (shipped routes vs. the reference doc)."""
import pathlib

from fastapi import APIRouter, FastAPI

from bedrock.tools import audit_api_docs as gate


def _write_doc(tmp_path: pathlib.Path, lines: list[str]) -> pathlib.Path:
    doc = tmp_path / "docs" / "guide" / "api_reference.md"
    doc.parent.mkdir(parents=True, exist_ok=True)
    doc.write_text("\n".join(["# API Reference", *lines, ""]), encoding="utf-8")
    return doc


def test_doc_matching_shipped_routes_produces_no_findings(tmp_path):
    """The baseline: every shipped route is documented and nothing else is."""
    app = FastAPI()

    @app.get("/api/v1/players")
    def list_players():
        return []

    doc = _write_doc(tmp_path, ["GET /api/v1/players"])

    shipped = gate.collect_shipped_routes(app, "/api/v1")
    documented = gate.collect_documented_routes(doc, "/api/v1")

    assert gate.audit(shipped, documented) == []


def test_a_shipped_route_absent_from_the_doc_is_a_finding_naming_the_route(tmp_path):
    """A route the app serves but the doc never mentions must be caught, and
    the finding must name the exact route so a reader knows what to add."""
    app = FastAPI()

    @app.get("/api/v1/players")
    def list_players():
        return []

    @app.post("/api/v1/players")
    def create_player():
        return {}

    doc = _write_doc(tmp_path, ["GET /api/v1/players"])

    shipped = gate.collect_shipped_routes(app, "/api/v1")
    documented = gate.collect_documented_routes(doc, "/api/v1")
    problems = gate.audit(shipped, documented)

    assert any("POST /api/v1/players" in p for p in problems)


def test_a_documented_route_that_is_not_shipped_is_a_finding_naming_the_route(tmp_path):
    """A stale doc line that references a route the app no longer serves must
    be caught, and the finding must name the exact route so a reader knows
    what to remove."""
    app = FastAPI()

    @app.get("/api/v1/players")
    def list_players():
        return []

    doc = _write_doc(tmp_path, ["GET /api/v1/players", "DELETE /api/v1/players/{id}"])

    shipped = gate.collect_shipped_routes(app, "/api/v1")
    documented = gate.collect_documented_routes(doc, "/api/v1")
    problems = gate.audit(shipped, documented)

    assert any("DELETE /api/v1/players/{id}" in p for p in problems)


def test_routes_outside_the_prefix_are_ignored_by_both_halves(tmp_path):
    """A route outside --prefix (e.g. a health check at `/healthz`) must not
    show up as either an undocumented-shipped or a stale-documented finding,
    even when the doc happens to mention it."""
    app = FastAPI()

    @app.get("/api/v1/players")
    def list_players():
        return []

    @app.get("/healthz")
    def health():
        return {"ok": True}

    doc = _write_doc(tmp_path, ["GET /api/v1/players", "GET /healthz"])

    shipped = gate.collect_shipped_routes(app, "/api/v1")
    documented = gate.collect_documented_routes(doc, "/api/v1")

    assert shipped == {("GET", "/api/v1/players")}
    assert documented == {("GET", "/api/v1/players")}
    assert gate.audit(shipped, documented) == []


def test_a_route_reached_only_through_an_included_sub_router_is_still_seen(tmp_path):
    """The regression `iter_route_specs` exists for: modern FastAPI wraps an
    `include_router` call in an `_IncludedRouter` whose child routes carry
    paths relative to the mount prefix. A naive walk of `app.routes` sees
    only the wrapper and must fail this test; `collect_shipped_routes` must
    still find the route underneath.
    """
    app = FastAPI()
    sub = APIRouter(prefix="/api/v1/teams")

    @sub.get("/{team_id}")
    def get_team(team_id: str):
        return {"id": team_id}

    app.include_router(sub)

    doc = _write_doc(tmp_path, ["GET /api/v1/teams/{team_id}"])

    shipped = gate.collect_shipped_routes(app, "/api/v1")
    documented = gate.collect_documented_routes(doc, "/api/v1")

    assert ("GET", "/api/v1/teams/{team_id}") in shipped
    assert gate.audit(shipped, documented) == []


def test_missing_doc_file_is_an_environment_error(tmp_path):
    """A `/api/v1`-shipping app with no reference doc at all has nothing to
    reconcile against - that is an environment problem for this gate, not a
    silent clean pass, unlike the design-tokens gate's "not yet adopted"
    case: every consumer with a shipped surface is expected to maintain one."""
    missing = tmp_path / "docs" / "guide" / "api_reference.md"

    try:
        gate.collect_documented_routes(missing, "/api/v1")
        assert False, "expected EnvironmentProblem"
    except gate.EnvironmentProblem:
        pass


def test_main_returns_2_when_the_doc_file_is_missing(tmp_path):
    """Thin `main()` wiring: a missing doc file maps to exit code 2, not 0 or 1."""
    import sys
    import types

    module_name = "_audit_api_docs_fixture_app"
    fixture_module = types.ModuleType(module_name)
    app = FastAPI()

    @app.get("/api/v1/players")
    def list_players():
        return []

    fixture_module.app = app  # type: ignore[attr-defined]
    sys.modules[module_name] = fixture_module
    try:
        exit_code = gate.main(
            [
                "--repo-root",
                str(tmp_path),
                "--app",
                f"{module_name}:app",
            ]
        )
    finally:
        del sys.modules[module_name]

    assert exit_code == 2


def test_main_returns_1_when_there_are_findings(tmp_path):
    """Thin `main()` wiring: findings map to exit code 1."""
    import sys
    import types

    module_name = "_audit_api_docs_fixture_app2"
    fixture_module = types.ModuleType(module_name)
    app = FastAPI()

    @app.get("/api/v1/players")
    def list_players():
        return []

    fixture_module.app = app  # type: ignore[attr-defined]
    sys.modules[module_name] = fixture_module
    _write_doc(tmp_path, [])
    try:
        exit_code = gate.main(
            [
                "--repo-root",
                str(tmp_path),
                "--app",
                f"{module_name}:app",
            ]
        )
    finally:
        del sys.modules[module_name]

    assert exit_code == 1


def test_main_returns_0_when_clean(tmp_path):
    """Thin `main()` wiring: no findings maps to exit code 0."""
    import sys
    import types

    module_name = "_audit_api_docs_fixture_app3"
    fixture_module = types.ModuleType(module_name)
    app = FastAPI()

    @app.get("/api/v1/players")
    def list_players():
        return []

    fixture_module.app = app  # type: ignore[attr-defined]
    sys.modules[module_name] = fixture_module
    _write_doc(tmp_path, ["GET /api/v1/players"])
    try:
        exit_code = gate.main(
            [
                "--repo-root",
                str(tmp_path),
                "--app",
                f"{module_name}:app",
            ]
        )
    finally:
        del sys.modules[module_name]

    assert exit_code == 0


def test_load_app_raises_environment_problem_for_an_unimportable_module():
    """`load_app` is the environment-error boundary for --app: a module that
    cannot be imported must not raise ImportError past this gate's control."""
    try:
        gate.load_app("this_module_does_not_exist_anywhere:app")
        assert False, "expected EnvironmentProblem"
    except gate.EnvironmentProblem:
        pass
