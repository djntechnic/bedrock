"""
Module:  diagnostic_checks.py
Layer:   api/core
Desc:    The platform's own diagnostic checks — the ones that touch only
         platform-owned tables and therefore mean the same thing in any
         application: database read/write, the diagnostics tables themselves,
         the import-run ledger, and the grid/config seed state.

         Registered as a module side-effect. Application checks live alongside
         these in the same registry; see api/core/diagnostics_registry.py.
"""
from __future__ import annotations

import time

from bedrock.core.database import db
from bedrock.core.diagnostics_registry import register_diagnostic_check
from bedrock.core.schema_catalog import Tables as T


def test_db_read() -> str:
    r = db.query("SELECT 1 AS ok")
    assert not r.empty and r.iloc[0]["ok"] == 1
    return "SELECT 1 returned 1"


def test_db_write() -> str:
    db.execute("CREATE TEMP TABLE IF NOT EXISTS _diag_ping (ts INTEGER)")
    db.execute("INSERT INTO _diag_ping VALUES (:ts)", {"ts": int(time.time())})
    r = db.query("SELECT COUNT(*) AS c FROM _diag_ping")
    count = int(r.iloc[0]["c"])
    db.execute("DELETE FROM _diag_ping")
    assert count >= 1
    return f"Temp write/read/delete: {count} rows"


def test_diagnostic_tables_exist() -> str:
    r = db.query("SELECT name FROM sqlite_master WHERE type='table'")
    tables = set(r["name"].tolist())
    required = {T.DIAG_TEST_RUNS, T.DIAG_TEST_RESULTS}
    missing = required - tables
    if missing:
        raise AssertionError(f"Diagnostic tables missing: {missing}")
    return f"{T.DIAG_TEST_RUNS} and {T.DIAG_TEST_RESULTS} present"


def test_recent_sync() -> str:
    r = db.query(
        f"SELECT MAX(completed_ts) AS last_sync FROM {T.IMPORT_RUNS} WHERE status='completed'"
    )
    last = r.iloc[0]["last_sync"] if not r.empty else None
    if not last:
        raise AssertionError("No completed sync runs found in import_runs")
    return f"Last successful sync: {last}"


def test_grid_settings_seeded() -> str:
    r = db.query(f"SELECT COUNT(*) AS c FROM {T.APP_GRID_SETTINGS}")
    count = int(r.iloc[0]["c"])
    if count == 0:
        raise AssertionError("app_grid_settings has no rows — grid config not seeded")
    return f"{count} grid(s) configured"


def test_grid_columns_seeded() -> str:
    r = db.query(f"SELECT COUNT(*) AS c FROM {T.APP_GRID_COLUMN_SETTINGS}")
    count = int(r.iloc[0]["c"])
    if count == 0:
        raise AssertionError("app_grid_column_settings has no rows")
    return f"{count} column config rows"


def test_config_settings_seeded() -> str:
    r = db.query(f"SELECT COUNT(*) AS c FROM {T.APP_CONFIG_SETTINGS}")
    count = int(r.iloc[0]["c"])
    if count == 0:
        raise AssertionError("app_config_settings is empty")
    return f"{count} config keys"


def test_import_runs_schema() -> str:
    r = db.query("PRAGMA table_info(import_runs)")
    cols = set(r["name"].tolist())
    required = {"import_run_id", "status", "source"}
    missing = required - cols
    if missing:
        raise AssertionError(f"import_runs missing columns: {missing}")
    return f"import_runs has {len(cols)} columns"


# ─── Registration ──────────────────────────────────────────────────────────────

register_diagnostic_check(
    "DB Read",
    "Database",
    test_db_read,
    max_retries=1,
    order=10,
)
register_diagnostic_check(
    "DB Write",
    "Database",
    test_db_write,
    max_retries=1,
    order=20,
)
register_diagnostic_check(
    "Diagnostic Tables Present",
    "Database",
    test_diagnostic_tables_exist,
    order=50,
)
register_diagnostic_check(
    "Recent Sync Completed",
    "Data",
    test_recent_sync,
    order=90,
)
register_diagnostic_check(
    "Grid Settings Seeded",
    "Config",
    test_grid_settings_seeded,
    order=100,
)
register_diagnostic_check(
    "Grid Columns Seeded",
    "Config",
    test_grid_columns_seeded,
    order=110,
)
register_diagnostic_check(
    "App Config Seeded",
    "Config",
    test_config_settings_seeded,
    order=120,
)
register_diagnostic_check(
    "import_runs Schema",
    "Schema",
    test_import_runs_schema,
    order=140,
)
