"""
Module:  test_admin_service.py
Layer:   api/tests
Desc:    §S005 coverage for the non-config-CRUD surface of admin_service.py:
         grid settings/columns, export history, sync state, audit runs,
         database summary, the unified log feed, sync schedule/status, and
         UI query config. The config-settings CRUD slice is already covered
         by test_admin_config_service.py and is not duplicated here.
"""
import uuid

import pytest

from bedrock.core.database import db
from bedrock.services.admin_service import (
    AdminConflictError,
    AdminNotFoundError,
    AdminValidationError,
    count_running_syncs_service,
    create_grid_column_service,
    delete_grid_column_service,
    get_audit_run_service,
    get_database_summary_service,
    get_sync_schedule_service,
    get_sync_state_service,
    get_sync_status_service,
    list_audit_history_service,
    list_config_settings_service,
    list_export_history_service,
    list_grid_columns_service,
    list_grid_pages_service,
    list_grid_settings_service,
    list_system_logs_service,
    list_ui_query_config_service,
    log_export_service,
    update_grid_column_service,
    update_grid_setting_service,
    update_ui_query_config_service,
)


def _make_grid(grid_id: str, *, page: str = "test_page") -> None:
    db.execute(
        "INSERT INTO app_grid_settings (grid_id, grid_label, page) "
        "VALUES (%s, %s, %s)",
        (grid_id, grid_id, page),
    )


@pytest.fixture
def grid_id():
    gid = f"grid_{uuid.uuid4().hex[:8]}"
    _make_grid(gid)
    yield gid
    db.execute(
        "DELETE FROM app_grid_column_settings WHERE grid_setting_id IN "
        "(SELECT grid_setting_id FROM app_grid_settings WHERE grid_id = %s)",
        (gid,),
    )
    db.execute("DELETE FROM app_grid_settings WHERE grid_id = %s", (gid,))


# ── grid settings / pages ─────────────────────────────────────────────────────

def test_list_grid_settings_service_includes_created_grid(grid_id):
    rows = list_grid_settings_service()
    assert any(r["grid_id"] == grid_id for r in rows)


def test_list_grid_pages_service_includes_seeded_page(grid_id):
    pages = list_grid_pages_service()
    assert "test_page" in pages


def test_update_grid_setting_service_updates_whitelisted_field(grid_id):
    result = update_grid_setting_service(
        grid_id=grid_id, body={"title": "New Title", "not_a_field": "x"},
    )
    assert result == {"message": f"Grid {grid_id} updated"}

    df = db.query(
        "SELECT title FROM app_grid_settings WHERE grid_id = %s", (grid_id,),
    )
    assert df.iloc[0]["title"] == "New Title"


def test_update_grid_setting_service_raises_on_no_valid_fields(grid_id):
    with pytest.raises(AdminValidationError, match="No valid fields"):
        update_grid_setting_service(grid_id=grid_id, body={"not_a_field": "x"})


# ── grid columns ───────────────────────────────────────────────────────────

def test_create_grid_column_service_appends_column(grid_id):
    result = create_grid_column_service(
        grid_id=grid_id, body={"column_id": "col_a", "label_override": "Col A"},
    )
    assert result == {"message": "Column col_a created"}

    cols = list_grid_columns_service(grid_id=grid_id)
    assert len(cols) == 1
    assert cols[0]["column_id"] == "col_a"
    assert cols[0]["column_order"] == 1


def test_create_grid_column_service_requires_column_id(grid_id):
    with pytest.raises(AdminValidationError, match="column_id is required"):
        create_grid_column_service(grid_id=grid_id, body={})


def test_create_grid_column_service_raises_notfound_for_missing_grid():
    with pytest.raises(AdminNotFoundError, match="not found"):
        create_grid_column_service(
            grid_id="__no_such_grid__", body={"column_id": "col_a"},
        )


def test_create_grid_column_service_raises_conflict_on_duplicate(grid_id):
    create_grid_column_service(grid_id=grid_id, body={"column_id": "dup_col"})
    with pytest.raises(AdminConflictError, match="already exists"):
        create_grid_column_service(grid_id=grid_id, body={"column_id": "dup_col"})


def test_list_grid_columns_service_empty_for_unknown_grid():
    assert list_grid_columns_service(grid_id="__no_such_grid__") == []


def test_update_grid_column_service_updates_field(grid_id):
    create_grid_column_service(grid_id=grid_id, body={"column_id": "col_b"})
    result = update_grid_column_service(
        grid_id=grid_id, column_id="col_b", body={"label_override": "Updated"},
    )
    assert result == {"message": "Column updated"}

    cols = list_grid_columns_service(grid_id=grid_id)
    assert cols[0]["label_override"] == "Updated"


def test_update_grid_column_service_raises_on_no_valid_fields(grid_id):
    create_grid_column_service(grid_id=grid_id, body={"column_id": "col_c"})
    with pytest.raises(AdminValidationError, match="No valid fields"):
        update_grid_column_service(grid_id=grid_id, column_id="col_c", body={"nope": 1})


def test_delete_grid_column_service_removes_column(grid_id):
    create_grid_column_service(grid_id=grid_id, body={"column_id": "col_d"})
    result = delete_grid_column_service(grid_id=grid_id, column_id="col_d")
    assert result == {"message": "Column col_d deleted"}
    assert list_grid_columns_service(grid_id=grid_id) == []


def test_delete_grid_column_service_raises_notfound_when_missing(grid_id):
    with pytest.raises(AdminNotFoundError, match="not found"):
        delete_grid_column_service(grid_id=grid_id, column_id="__no_such_col__")


# ── export history ─────────────────────────────────────────────────────────

def test_log_export_service_and_list_export_history_service():
    log_export_service(
        export_type="csv", page="admin", row_count=10, user_note="test export",
    )
    rows = list_export_history_service(limit=5)
    assert rows
    assert rows[0]["export_type"] == "csv"
    assert rows[0]["page"] == "admin"


def test_list_export_history_service_respects_limit():
    for _ in range(3):
        log_export_service(export_type="pdf", page="admin", row_count=1, user_note=None)
    rows = list_export_history_service(limit=1)
    assert len(rows) == 1


# ── sync state / audit runs ────────────────────────────────────────────────

def test_get_sync_state_service_empty_when_no_rows():
    db.execute("DELETE FROM sys_state")
    assert get_sync_state_service() == {}


def test_get_sync_state_service_returns_known_keys():
    db.execute("DELETE FROM sys_state")
    db.execute("INSERT INTO sys_state (key, value) VALUES ('last_sync_ts', '2024-01-01')")
    db.execute("INSERT INTO sys_state (key, value) VALUES ('last_sync_error', 'boom')")
    state = get_sync_state_service()
    assert state == {"last_sync_ts": "2024-01-01", "last_sync_error": "boom"}


def test_get_audit_run_service_returns_none_when_missing():
    assert get_audit_run_service(run_id=999999) is None


def test_get_audit_run_service_returns_row():
    db.execute(
        "INSERT INTO sys_audit_runs (run_at, triggered_by, total) "
        "VALUES (datetime('now'), 'manual', 3)"
    )
    df = db.query("SELECT id FROM sys_audit_runs ORDER BY id DESC LIMIT 1")
    run_id = int(df.iloc[0]["id"])
    row = get_audit_run_service(run_id=run_id)
    assert row is not None
    assert row["triggered_by"] == "manual"
    assert row["total"] == 3


# ── database summary ───────────────────────────────────────────────────────

def test_get_database_summary_service_returns_tables_and_size():
    summary = get_database_summary_service()
    assert "overall_size" in summary
    assert "tables" in summary
    table_names = [t["table_name"] for t in summary["tables"]]
    assert "auth_users" in table_names
    for t in summary["tables"]:
        assert t["row_count"] >= 0
        assert t["table_size"] >= 0


# ── unified log feed ───────────────────────────────────────────────────────

def test_list_system_logs_service_merges_activity_and_export():
    db.log_activity("test_event", "Something happened", "detail here")
    log_export_service(export_type="csv", page="admin", row_count=5, user_note=None)

    rows = list_system_logs_service(limit=50)
    sources = {r["source"] for r in rows}
    assert "activity" in sources
    assert "export" in sources
    for r in rows:
        assert "display_type" in r


def test_list_system_logs_service_filters_by_source():
    db.log_activity("filter_probe", "probe description", None)
    rows = list_system_logs_service(source="activity", limit=50)
    assert rows
    assert all(r["source"] == "activity" for r in rows)


def test_list_system_logs_service_empty_source_returns_no_rows_for_that_stream():
    db.execute("DELETE FROM sys_export_runs")
    rows = list_system_logs_service(source="export", limit=50)
    assert rows == []


# ── sync schedule / status ─────────────────────────────────────────────────

def test_count_running_syncs_service_counts_running_rows():
    db.execute("DELETE FROM import_runs")
    db.execute(
        "INSERT INTO import_runs (import_run_id, source, status) "
        "VALUES (%s, 'test', 'running')",
        (uuid.uuid4().hex,),
    )
    db.execute(
        "INSERT INTO import_runs (import_run_id, source, status) "
        "VALUES (%s, 'test', 'completed')",
        (uuid.uuid4().hex,),
    )
    assert count_running_syncs_service() == 1


def test_get_sync_schedule_service_flags_orphaned_runs():
    db.execute("DELETE FROM import_runs")
    orphan_id = uuid.uuid4().hex
    db.execute(
        "INSERT INTO import_runs (import_run_id, source, status, started_ts) "
        "VALUES (%s, 'test', 'running', datetime('now', '-2 hours'))",
        (orphan_id,),
    )
    result = get_sync_schedule_service(limit=10)
    assert "history" in result
    assert "orphaned_runs" in result
    orphan_ids = [r["import_run_id"] for r in result["orphaned_runs"]]
    assert orphan_id in orphan_ids


def test_get_sync_status_service_reports_running_state():
    db.execute("DELETE FROM import_runs")
    db.execute("DELETE FROM sys_state")
    db.execute(
        "INSERT INTO import_runs (import_run_id, source, status) "
        "VALUES (%s, 'test', 'running')",
        (uuid.uuid4().hex,),
    )
    status = get_sync_status_service()
    assert status["is_running"] is True
    assert status["last_sync_ts"] is None
    assert isinstance(status["recent_runs"], list)


# ── UI query config ────────────────────────────────────────────────────────

def test_update_ui_query_config_service_raises_on_empty_body():
    with pytest.raises(AdminValidationError, match="No valid fields"):
        update_ui_query_config_service(hook_name="__no_such_hook__", body={})


def test_list_ui_query_config_service_returns_list():
    rows = list_ui_query_config_service()
    assert isinstance(rows, list)


def test_update_ui_query_config_service_updates_existing_hook():
    hook_name = f"useProbe{uuid.uuid4().hex[:6]}"
    db.execute(
        "INSERT INTO app_ui_query_config (hook_name, stale_time_ms) "
        "VALUES (%s, 1000)",
        (hook_name,),
    )
    result = update_ui_query_config_service(
        hook_name=hook_name, body={"stale_time_ms": 5000},
    )
    assert result == {"message": "Config updated"}
    df = db.query(
        "SELECT stale_time_ms FROM app_ui_query_config WHERE hook_name = %s",
        (hook_name,),
    )
    assert int(df.iloc[0]["stale_time_ms"]) == 5000
    db.execute("DELETE FROM app_ui_query_config WHERE hook_name = %s", (hook_name,))


# ── audit history ──────────────────────────────────────────────────────────

def test_list_audit_history_service_decodes_checks_run_json():
    db.execute(
        "INSERT INTO sys_audit_runs (run_at, triggered_by, checks_run, total) "
        "VALUES (datetime('now'), 'manual', '[\"s001\", \"s002\"]', 2)"
    )
    rows = list_audit_history_service(limit=5)
    assert rows
    assert rows[0]["checks_run"] == ["s001", "s002"]


def test_list_audit_history_service_degrades_on_malformed_json():
    db.execute(
        "INSERT INTO sys_audit_runs (run_at, triggered_by, checks_run, total) "
        "VALUES (datetime('now'), 'manual', 'not-json', 0)"
    )
    rows = list_audit_history_service(limit=1)
    assert rows[0]["checks_run"] == []


def test_list_audit_history_service_empty_when_no_runs():
    db.execute("DELETE FROM sys_audit_runs")
    assert list_audit_history_service(limit=5) == []
