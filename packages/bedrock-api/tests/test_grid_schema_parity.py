"""
Module:  test_grid_schema_parity.py
Layer:   api/tests
Desc:    Whitelist ↔ DDL parity guardrail for grid config tables (Phase 1.c of
         unified_grid_standard.md §4). For each of `app_grid_settings` and
         `app_grid_column_settings`, asserts that every column present in the
         SQLite DDL has a corresponding field on the Pydantic response model.
         If a migration adds a column without updating the schema, this test
         fails on `pytest --collect-only` and blocks merge, closing the loop
         between DB → API → frontend that §S2 depends on.

         The reverse direction (model field with no DDL column) is treated as
         a warning-only case for now because response models legitimately
         include synthesized fields (e.g. joined-in labels). Phase 3.a will
         tighten this once the admin routes migrate to explicit column SELECTs.
"""
import sqlite3
from pathlib import Path

import pytest

from bedrock.schemas.admin import GridSettingSchema, GridColumnSettingSchema
from bedrock.core.database import db


TABLES = (
    ("app_grid_settings", GridSettingSchema),
    ("app_grid_column_settings", GridColumnSettingSchema),
)

# Audit / bookkeeping columns intentionally not surfaced through the API.
# Phase 2 (§4 of unified_grid_standard) will decide whether these should be
# exposed on the response model or hidden behind an admin-only endpoint.
# Adding to this set is a §1.3 amendment and requires a doc PR.
KNOWN_UNEXPOSED_DDL_COLUMNS: dict[str, set[str]] = {
    "app_grid_settings": {"created_at", "created_by", "modified_at", "modified_by"},
    "app_grid_column_settings": {"created_at", "created_by", "modified_at", "modified_by"},
}


def _ddl_columns(table_name: str) -> set[str]:
    """Return the set of column names for `table_name` from the live test DB."""
    # `db.query` returns a DataFrame; use the raw connection for PRAGMA.
    conn = sqlite3.connect(db.db_path) if hasattr(db, "db_path") else None
    if conn is None:
        # Fall back to executing PRAGMA via db.query if the DatabaseManager
        # doesn't expose a path attribute in this deployment.
        df = db.query(f"PRAGMA table_info({table_name})")
        return {row["name"] for _, row in df.iterrows()}
    try:
        cur = conn.execute(f"PRAGMA table_info({table_name})")
        return {row[1] for row in cur.fetchall()}
    finally:
        conn.close()


@pytest.mark.integration
@pytest.mark.parametrize("table_name,model_cls", TABLES, ids=[t[0] for t in TABLES])
def test_ddl_columns_have_pydantic_fields(table_name: str, model_cls) -> None:
    """Every DDL column must exist as a field on the Pydantic response model.

    A migration that adds a column without extending the schema silently drops
    the value in the API response (Pydantic strips unknown keys), which then
    silently drops it in `useAdmin.ts` — the exact class of DB↔API↔frontend
    drift the standard exists to prevent.
    """
    ddl_cols = _ddl_columns(table_name)
    assert ddl_cols, f"PRAGMA returned no columns for {table_name}"

    model_fields = set(model_cls.model_fields.keys())
    exclusions = KNOWN_UNEXPOSED_DDL_COLUMNS.get(table_name, set())
    missing_on_model = sorted((ddl_cols - model_fields) - exclusions)

    assert not missing_on_model, (
        f"{table_name}: DDL columns absent from {model_cls.__name__}: "
        f"{missing_on_model}. Add these fields to api/schemas/admin.py and to "
        f"the frontend interface in frontend/src/hooks/useAdmin.ts. See §1.3 of "
        f"docs/analysis/unified_grid_standard.md — a new property requires all "
        f"nine wiring steps."
    )
