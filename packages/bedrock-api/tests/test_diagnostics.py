"""
Module:  test_diagnostics.py
Layer:   api/tests
Desc:    Endpoint tests for bedrock/routes/diagnostics.py — the diagnostic
         run trigger, run history, run detail, and schedule config surface.

         Imports bedrock.core.diagnostic_checks for its module-level
         side-effect registration so `registered_checks()` is non-empty
         regardless of what else has run in this pytest session — the
         platform's own checks operate against real tables (import_runs,
         app_grid_settings, ...) that this suite's seed-only fixture leaves
         empty, which is exactly the "some checks fail" case the run
         endpoints need to survive without raising.
"""
from __future__ import annotations

import time
import uuid

import pytest
from fastapi.testclient import TestClient

from conftest import build_app  # noqa: E402

app = build_app()

import bedrock.core.diagnostic_checks  # noqa: F401  (registers platform checks)
from bedrock.core.database import db
from bedrock.services import user_service as us


@pytest.fixture(autouse=True)
def _use_real_auth_guards(real_auth_guards):
    yield


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def _mint(role: str) -> tuple[us.UserRecord, str]:
    email = f"diag-{role}-{uuid.uuid4().hex[:8]}@test.example.com"
    user = us.create_user(email=email, password="pw-strong-123", default_role=role)
    for other in ("member", "viewer", "admin"):
        if other != role:
            us.revoke_role(user.user_id, other)
    return user, us.create_access_token(user.user_id)


def _admin_headers() -> dict:
    _admin, tok = _mint("admin")
    return {"Authorization": f"Bearer {tok}"}


# ─── Auth guard ───────────────────────────────────────────────────────────────

def test_all_endpoints_require_admin(client):
    _v, tok = _mint("viewer")
    headers = {"Authorization": f"Bearer {tok}"}
    assert client.post("/api/v1/diagnostics/run", headers=headers).status_code == 403
    assert client.get("/api/v1/diagnostics/runs", headers=headers).status_code == 403
    assert client.get("/api/v1/diagnostics/runs/1", headers=headers).status_code == 403
    assert client.get("/api/v1/diagnostics/schedule", headers=headers).status_code == 403
    assert client.patch("/api/v1/diagnostics/schedule", json={}, headers=headers).status_code == 403


def test_endpoints_reject_unauthenticated(client):
    assert client.get("/api/v1/diagnostics/runs").status_code == 401


# ─── /run ────────────────────────────────────────────────────────────────────

def test_trigger_run_queues_and_persists(client):
    headers = _admin_headers()
    r = client.post("/api/v1/diagnostics/run", headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert "run_id" in data
    run_id = data["run_id"]

    # BackgroundTasks execute synchronously in TestClient after the response
    # body is built, so by the time we look the background job has run.
    deadline = time.monotonic() + 5
    status = None
    while time.monotonic() < deadline:
        r_run = client.get(f"/api/v1/diagnostics/runs/{run_id}", headers=headers)
        assert r_run.status_code == 200
        status = r_run.json()["data"]["status"]
        if status != "running":
            break
        time.sleep(0.1)

    assert status in ("passed", "failed")
    detail = r_run.json()["data"]
    assert detail["run_id"] == run_id
    assert isinstance(detail["results"], list)
    assert len(detail["results"]) == detail["total"]
    assert detail["total"] >= 1  # diagnostic_checks.py registers at least one check


def test_trigger_run_returns_existing_run_when_one_is_running(client):
    headers = _admin_headers()
    started_at = "2099-01-01T00:00:00+00:00"  # far future so nothing purges it
    db.execute(
        "INSERT INTO diag_test_runs (triggered_by, status, started_at) "
        "VALUES ('manual', 'running', :ts)",
        params={"ts": started_at},
    )
    df = db.query("SELECT last_insert_rowid() AS run_id")
    stuck_run_id = int(df.iloc[0]["run_id"])
    try:
        r = client.post("/api/v1/diagnostics/run", headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["already_running"] is True
        assert data["run_id"] == stuck_run_id
    finally:
        db.execute("DELETE FROM diag_test_runs WHERE run_id = :rid", params={"rid": stuck_run_id})


# ─── /runs ───────────────────────────────────────────────────────────────────

def test_list_runs_returns_newest_first(client):
    headers = _admin_headers()
    r1 = client.post("/api/v1/diagnostics/run", headers=headers)
    # `started_at` has one-second resolution (isoformat(timespec="seconds")),
    # and the ORDER BY only sorts on it — a gap under a second is a real tie.
    time.sleep(1.1)
    r2 = client.post("/api/v1/diagnostics/run", headers=headers)
    id1, id2 = r1.json()["data"]["run_id"], r2.json()["data"]["run_id"]

    r = client.get("/api/v1/diagnostics/runs", headers=headers)
    assert r.status_code == 200
    rows = r.json()["data"]
    run_ids = [row["run_id"] for row in rows]
    assert id1 in run_ids and id2 in run_ids
    assert run_ids.index(id2) < run_ids.index(id1)


def test_list_runs_respects_limit(client):
    headers = _admin_headers()
    r = client.get("/api/v1/diagnostics/runs", params={"limit": 1}, headers=headers)
    assert r.status_code == 200
    assert len(r.json()["data"]) <= 1


# ─── /runs/{run_id} ──────────────────────────────────────────────────────────

def test_get_run_404_for_missing_run(client):
    r = client.get("/api/v1/diagnostics/runs/999999999", headers=_admin_headers())
    assert r.status_code == 404


# ─── /schedule ───────────────────────────────────────────────────────────────

def test_get_schedule_defaults(client):
    db.execute(
        "DELETE FROM app_config_settings WHERE key IN "
        "('diagnostics_schedule_enabled', 'diagnostics_schedule_time', 'diagnostics_retention_days')"
    )
    db.invalidate_config()  # the route reads via db.get_config's 60s cache
    r = client.get("/api/v1/diagnostics/schedule", headers=_admin_headers())
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data == {"enabled": False, "schedule_time": "02:00", "retention_days": 60}


def test_patch_schedule_updates_and_persists(client):
    headers = _admin_headers()
    # The route writes via raw SQL, bypassing db.set_config's cache eviction —
    # clear the cache ourselves so this test observes what a fresh read (post
    # cache-expiry) actually sees, rather than a previous test's cached value.
    db.invalidate_config()
    r = client.patch(
        "/api/v1/diagnostics/schedule",
        json={"enabled": True, "schedule_time": "03:15", "retention_days": 14},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data == {"enabled": True, "schedule_time": "03:15", "retention_days": 14}

    # A second GET reflects the persisted config, not endpoint-local state.
    r_get = client.get("/api/v1/diagnostics/schedule", headers=headers)
    assert r_get.json()["data"] == data

    # Cleanup so later tests (e.g. defaults) aren't polluted.
    db.execute(
        "DELETE FROM app_config_settings WHERE key IN "
        "('diagnostics_schedule_enabled', 'diagnostics_schedule_time', 'diagnostics_retention_days')"
    )


def test_patch_schedule_partial_update_leaves_other_fields(client):
    headers = _admin_headers()
    db.invalidate_config()
    client.patch("/api/v1/diagnostics/schedule", json={"retention_days": 30}, headers=headers)
    db.invalidate_config()
    r = client.patch("/api/v1/diagnostics/schedule", json={"enabled": True}, headers=headers)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["enabled"] is True
    assert data["retention_days"] == 30

    db.execute(
        "DELETE FROM app_config_settings WHERE key IN "
        "('diagnostics_schedule_enabled', 'diagnostics_schedule_time', 'diagnostics_retention_days')"
    )
