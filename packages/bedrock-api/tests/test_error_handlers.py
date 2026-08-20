"""Cover for the platform's exception handlers.

The regression these guard against is not a crash but a silence: before the
handler existed, a failed SELECT reached the client as an empty result and
`<DataGrid>` rendered it as a grid with no rows.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from bedrock.core.database import DatabaseQueryError
from bedrock.core.error_handlers import register_error_handlers


def _app() -> TestClient:
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/boom")
    def boom():
        raise DatabaseQueryError(
            "no such column: nope",
            sql="SELECT nope FROM items_master WHERE sku = %s",
            original=ValueError("underlying"),
        )

    return TestClient(app, raise_server_exceptions=False)


def test_query_failure_returns_the_documented_envelope():
    resp = _app().get("/boom")
    assert resp.status_code == 500
    assert resp.json()["detail"]["code"] == "GRID_QUERY_FAILED"


def test_the_response_never_carries_the_sql():
    # The statement names tables and columns, and any operator who can see a
    # grid can reach the endpoint that raised. It belongs in the log only.
    body = _app().get("/boom").text
    assert "items_master" not in body
    assert "SELECT" not in body


def test_the_failure_is_logged_with_its_cause():
    # What the response deliberately withholds has to land somewhere, or the
    # handler has traded a silent empty grid for a silent 500.
    from loguru import logger

    captured: list[str] = []
    handler_id = logger.add(captured.append, level="ERROR", format="{message}")
    try:
        _app().get("/boom")
    finally:
        logger.remove(handler_id)

    assert any("items_master" in line for line in captured)
    assert any("underlying" in line for line in captured)


def test_an_unrelated_exception_is_left_alone():
    # Registering a handler for one exception must not swallow the rest;
    # a bug elsewhere should still surface as a bug.
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/other")
    def other():
        raise ValueError("unrelated")

    resp = TestClient(app, raise_server_exceptions=False).get("/other")
    assert resp.status_code == 500
    assert "GRID_QUERY_FAILED" not in resp.text
