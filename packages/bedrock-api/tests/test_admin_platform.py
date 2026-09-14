"""
Module:  test_admin_platform.py
Layer:   api/tests
Desc:    Endpoint tests for bedrock/routes/admin_platform.py — the config,
         grid-settings, exports, logs/sync, ui-query-config and audit-history
         surfaces of the admin console.

         Users/sessions/security-events coverage for this same router already
         lives in test_admin_users.py; this file covers the remaining ground
         so the whole module has a paired, non-vacuous test suite.
"""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from conftest import build_app  # noqa: E402

app = build_app()
from bedrock.core.database import db
from bedrock.services import user_service as us


@pytest.fixture(autouse=True)
def _use_real_auth_guards(real_auth_guards):
    yield


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def _mint(role: str) -> tuple[us.UserRecord, str]:
    email = f"adplat-{role}-{uuid.uuid4().hex[:8]}@test.example.com"
    user = us.create_user(email=email, password="pw-strong-123", default_role=role)
    for other in ("member", "viewer", "admin"):
        if other != role:
            us.revoke_role(user.user_id, other)
    return user, us.create_access_token(user.user_id)


def _admin_headers() -> dict:
    _admin, tok = _mint("admin")
    return {"Authorization": f"Bearer {tok}"}


def _insert_grid(grid_id: str) -> int:
    db.execute(
        "INSERT INTO app_grid_settings (grid_id, grid_label) VALUES (:gid, :label)",
        params={"gid": grid_id, "label": f"Label {grid_id}"},
    )
    df = db.query(
        "SELECT grid_setting_id FROM app_grid_settings WHERE grid_id = :gid",
        params={"gid": grid_id},
    )
    return int(df.iloc[0]["grid_setting_id"])


def _delete_grid(grid_id: str) -> None:
    db.execute("DELETE FROM app_grid_column_settings WHERE grid_setting_id IN "
               "(SELECT grid_setting_id FROM app_grid_settings WHERE grid_id = :gid)",
               params={"gid": grid_id})
    db.execute("DELETE FROM app_grid_settings WHERE grid_id = :gid", params={"gid": grid_id})


# ─── Grid settings (public) ──────────────────────────────────────────────────

def test_get_grid_settings_lists_seeded_grid(client):
    grid_id = f"probe-grid-{uuid.uuid4().hex[:8]}"
    _insert_grid(grid_id)
    try:
        r = client.get("/api/v1/admin/grids")
        assert r.status_code == 200
        ids = [g["grid_id"] for g in r.json()["data"]]
        assert grid_id in ids
    finally:
        _delete_grid(grid_id)


def test_get_grid_pages_returns_list(client):
    r = client.get("/api/v1/admin/grids/pages")
    assert r.status_code == 200
    assert isinstance(r.json()["data"], list)


def test_get_grid_columns_unknown_grid_returns_empty_list(client):
    r = client.get(f"/api/v1/admin/grids/unknown-{uuid.uuid4().hex[:8]}/columns")
    assert r.status_code == 200
    assert r.json()["data"] == []


def test_get_grid_columns_returns_inserted_column(client):
    grid_id = f"probe-grid-cols-{uuid.uuid4().hex[:8]}"
    grid_setting_id = _insert_grid(grid_id)
    db.execute(
        "INSERT INTO app_grid_column_settings (grid_setting_id, column_id) "
        "VALUES (:gsid, :cid)",
        params={"gsid": grid_setting_id, "cid": "name"},
    )
    try:
        r = client.get(f"/api/v1/admin/grids/{grid_id}/columns")
        assert r.status_code == 200
        cols = r.json()["data"]
        assert len(cols) == 1
        assert cols[0]["column_id"] == "name"
    finally:
        _delete_grid(grid_id)


# ─── Grid settings (admin-only mutation) ─────────────────────────────────────

def test_update_grid_setting_requires_admin(client):
    _v, tok = _mint("viewer")
    r = client.patch(
        "/api/v1/admin/grids/anything",
        json={"title": "x"},
        headers={"Authorization": f"Bearer {tok}"},
    )
    assert r.status_code == 403


def test_update_grid_setting_no_valid_fields_422(client):
    r = client.patch(
        "/api/v1/admin/grids/anything",
        json={"not_a_real_field": "x"},
        headers=_admin_headers(),
    )
    assert r.status_code == 422


def test_update_grid_setting_applies_change(client):
    grid_id = f"probe-grid-upd-{uuid.uuid4().hex[:8]}"
    _insert_grid(grid_id)
    try:
        r = client.patch(
            f"/api/v1/admin/grids/{grid_id}",
            json={"title": "New Title"},
            headers=_admin_headers(),
        )
        assert r.status_code == 200, r.text
        df = db.query(
            "SELECT title FROM app_grid_settings WHERE grid_id = :gid",
            params={"gid": grid_id},
        )
        assert df.iloc[0]["title"] == "New Title"
    finally:
        _delete_grid(grid_id)


def test_create_update_delete_grid_column_lifecycle(client):
    grid_id = f"probe-grid-col-crud-{uuid.uuid4().hex[:8]}"
    _insert_grid(grid_id)
    headers = _admin_headers()
    try:
        # Create
        r = client.post(
            f"/api/v1/admin/grids/{grid_id}/columns",
            json={"column_id": "email", "label_override": "Email"},
            headers=headers,
        )
        assert r.status_code == 200, r.text

        # Duplicate create -> 409
        r_dup = client.post(
            f"/api/v1/admin/grids/{grid_id}/columns",
            json={"column_id": "email"},
            headers=headers,
        )
        assert r_dup.status_code == 409

        # Missing column_id -> 422
        r_missing = client.post(
            f"/api/v1/admin/grids/{grid_id}/columns",
            json={"label_override": "no id"},
            headers=headers,
        )
        assert r_missing.status_code == 422

        # Create against unknown grid -> 404
        r_404 = client.post(
            f"/api/v1/admin/grids/unknown-{uuid.uuid4().hex[:8]}/columns",
            json={"column_id": "x"},
            headers=headers,
        )
        assert r_404.status_code == 404

        # Update
        r_upd = client.patch(
            f"/api/v1/admin/grids/{grid_id}/columns/email",
            json={"label_override": "Email Address"},
            headers=headers,
        )
        assert r_upd.status_code == 200
        df = db.query(
            "SELECT label_override FROM app_grid_column_settings agcs "
            "JOIN app_grid_settings ags ON agcs.grid_setting_id = ags.grid_setting_id "
            "WHERE ags.grid_id = :gid AND agcs.column_id = 'email'",
            params={"gid": grid_id},
        )
        assert df.iloc[0]["label_override"] == "Email Address"

        # Delete
        r_del = client.delete(
            f"/api/v1/admin/grids/{grid_id}/columns/email",
            headers=headers,
        )
        assert r_del.status_code == 200

        # Delete again -> 404 (already gone)
        r_del_again = client.delete(
            f"/api/v1/admin/grids/{grid_id}/columns/email",
            headers=headers,
        )
        assert r_del_again.status_code == 404
    finally:
        _delete_grid(grid_id)


# ─── Config settings ──────────────────────────────────────────────────────────

def _random_key(prefix: str) -> str:
    return f"system_{prefix}_{uuid.uuid4().hex[:8]}"


def test_config_settings_requires_admin(client):
    _v, tok = _mint("viewer")
    r = client.get("/api/v1/admin/config", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 403


def test_config_create_get_update_delete_lifecycle(client, clean_config):
    headers = _admin_headers()
    key = _random_key("lifecycle")

    r = client.post(
        "/api/v1/admin/config",
        json={"key": key, "value": "1", "value_type": "integer", "category": "system"},
        headers=headers,
    )
    assert r.status_code == 200, r.text

    r_dup = client.post(
        "/api/v1/admin/config",
        json={"key": key, "value": "2", "value_type": "integer", "category": "system"},
        headers=headers,
    )
    assert r_dup.status_code == 409

    r_list = client.get("/api/v1/admin/config", params={"category": "system"}, headers=headers)
    assert r_list.status_code == 200
    assert any(row["key"] == key for row in r_list.json()["data"])

    r_upd = client.patch(
        f"/api/v1/admin/config/{key}",
        json={"value": "42"},
        headers=headers,
    )
    assert r_upd.status_code == 200

    r_upd_missing = client.patch(
        f"/api/v1/admin/config/__does_not_exist__{uuid.uuid4().hex[:6]}",
        json={"value": "x"},
        headers=headers,
    )
    assert r_upd_missing.status_code == 404

    r_del = client.delete(f"/api/v1/admin/config/{key}", headers=headers)
    assert r_del.status_code == 200

    r_del_missing = client.delete(f"/api/v1/admin/config/{key}", headers=headers)
    assert r_del_missing.status_code == 404


# ─── KPI / database summary / api-health ─────────────────────────────────────

def test_database_summary_requires_admin(client):
    _v, tok = _mint("viewer")
    r = client.get("/api/v1/admin/database/summary", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 403


def test_database_summary_returns_table_inventory(client):
    r = client.get("/api/v1/admin/database/summary", headers=_admin_headers())
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert "overall_size" in data and "tables" in data
    names = [t["table_name"] for t in data["tables"]]
    assert "app_config_settings" in names


def test_api_health_lists_routes_with_stats(client):
    r = client.get("/api/v1/admin/api-health", headers=_admin_headers())
    assert r.status_code == 200, r.text
    rows = r.json()["data"]
    assert isinstance(rows, list) and len(rows) > 0
    grid_rows = [row for row in rows if row["path"] == "/api/v1/admin/grids" and row["method"] == "GET"]
    assert grid_rows, "expected the /admin/grids GET route to be listed"
    assert {"hits", "errors", "status", "last_accessed"} <= set(grid_rows[0].keys())


# ─── Exports ──────────────────────────────────────────────────────────────────

def test_log_export_requires_admin(client):
    _v, tok = _mint("viewer")
    r = client.post(
        "/api/v1/admin/exports/log",
        json={"export_type": "csv", "page": "users"},
        headers={"Authorization": f"Bearer {tok}"},
    )
    assert r.status_code == 403


def test_log_export_invalid_type_422(client):
    r = client.post(
        "/api/v1/admin/exports/log",
        json={"export_type": "xlsx", "page": "users"},
        headers=_admin_headers(),
    )
    assert r.status_code == 422


def test_log_export_and_history_roundtrip(client):
    headers = _admin_headers()
    r = client.post(
        "/api/v1/admin/exports/log",
        json={"export_type": "csv", "page": "users-probe", "row_count": 3},
        headers=headers,
    )
    assert r.status_code == 200, r.text

    r_hist = client.get("/api/v1/admin/exports", headers=headers)
    assert r_hist.status_code == 200
    pages = [row["page"] for row in r_hist.json()["data"]]
    assert "users-probe" in pages


# ─── Logs & sync ─────────────────────────────────────────────────────────────

def test_get_logs_requires_admin(client):
    _v, tok = _mint("viewer")
    r = client.get("/api/v1/admin/logs", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 403


def test_get_logs_returns_list(client):
    r = client.get("/api/v1/admin/logs", headers=_admin_headers())
    assert r.status_code == 200
    assert isinstance(r.json()["data"], list)


def test_get_logs_rejects_out_of_range_limit(client):
    r = client.get("/api/v1/admin/logs", params={"limit": 5000}, headers=_admin_headers())
    assert r.status_code == 422


def test_sync_schedule_shape(client):
    r = client.get("/api/v1/admin/sync/schedule", headers=_admin_headers())
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert {"history", "orphaned_runs", "next_scheduled"} <= set(data.keys())


def test_sync_status_shape(client):
    r = client.get("/api/v1/admin/sync/status", headers=_admin_headers())
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert "is_running" in data and "recent_runs" in data


# ─── UI query config ──────────────────────────────────────────────────────────

def test_ui_query_config_list_and_update(client):
    headers = _admin_headers()
    r = client.get("/api/v1/admin/lookup/ui-query-config", headers=headers)
    assert r.status_code == 200
    assert isinstance(r.json()["data"], list)

    r_bad = client.patch(
        "/api/v1/admin/lookup/ui-query-config/whatever",
        json={"not_a_field": 1},
        headers=headers,
    )
    assert r_bad.status_code == 422


def test_ui_query_config_update_requires_admin(client):
    _v, tok = _mint("viewer")
    r = client.patch(
        "/api/v1/admin/lookup/ui-query-config/whatever",
        json={"stale_time_ms": 1000},
        headers={"Authorization": f"Bearer {tok}"},
    )
    assert r.status_code == 403


# ─── Audit ────────────────────────────────────────────────────────────────────

def test_run_audit_requires_admin(client):
    """Only checks the auth guard — the audit subprocess itself is out of
    scope for an endpoint test (it shells out to scripts/audit_project.py)."""
    _v, tok = _mint("viewer")
    r = client.get("/api/v1/admin/audit", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 403


def test_audit_history_requires_admin(client):
    _v, tok = _mint("viewer")
    r = client.get("/api/v1/admin/audit/history", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 403


def test_audit_history_returns_list(client):
    r = client.get("/api/v1/admin/audit/history", headers=_admin_headers())
    assert r.status_code == 200
    assert isinstance(r.json()["data"], list)


def test_audit_run_detail_404_for_missing_run(client):
    r = client.get("/api/v1/admin/audit/history/999999999", headers=_admin_headers())
    assert r.status_code == 404


def test_audit_run_detail_returns_findings_for_seeded_run(client):
    from datetime import datetime, timezone
    db.execute(
        "INSERT INTO sys_audit_runs "
        "(run_at, triggered_by, checks_run, findings, summary_p1, summary_p2, summary_p3, total, duration_ms) "
        "VALUES (:run_at, 'test', '[\"check_a\"]', '[{\"id\": 1}]', 1, 0, 0, 1, 42)",
        params={"run_at": datetime.now(timezone.utc).isoformat(timespec="seconds")},
    )
    df = db.query("SELECT id FROM sys_audit_runs ORDER BY id DESC LIMIT 1")
    run_id = int(df.iloc[0]["id"])
    try:
        r = client.get(f"/api/v1/admin/audit/history/{run_id}", headers=_admin_headers())
        assert r.status_code == 200, r.text
        data = r.json()["data"]
        assert data["id"] == run_id
        assert data["checks_run"] == ["check_a"]
        assert data["summary"]["P1"] == 1
    finally:
        db.execute("DELETE FROM sys_audit_runs WHERE id = :id", params={"id": run_id})
