"""
Module:  test_user_preferences_service.py
Layer:   bedrock-api/tests
Desc:    Unit tests for bedrock.services.user_preferences_service:
         - Empty-default shape when nothing has been saved
         - Lazy row creation on first PATCH
         - Partial (sort-only / columns-only / dashboard_pin-only) updates
         - Column unpin behavior
         - Multi-grid listing including synthetic 'dashboard'/'player_pins' ids
"""
from __future__ import annotations

import os
import sqlite3
import tempfile
import pytest

from bedrock.core import migrations
from bedrock.core.database import db
from bedrock.core.schema_catalog import Tables as T
from bedrock.services import user_preferences_service as ups


@pytest.fixture
def prefs_db():
    tmpdir = tempfile.mkdtemp(prefix="bedrock-prefs-")
    path = os.path.join(tmpdir, "prefs_test.db")

    conn = sqlite3.connect(path)
    conn.close()

    original = (db.sqlite_path, db.is_postgres, db.db_url)
    db.sqlite_path, db.is_postgres, db.db_url = path, False, None
    db.close_pool()

    migrations.apply_migrations()

    baseline_seed = os.path.join(os.path.dirname(migrations.PLATFORM_MIGRATIONS_DIR), "seed.sql")
    with open(baseline_seed, "r", encoding="utf-8") as f:
        with db.transaction() as c:
            migrations._run_sql_file(baseline_seed, c)

    db.execute(f"INSERT INTO {T.AUTH_USERS} (user_id, email) VALUES (1, 'prefs1@example.com')")
    db.execute(f"INSERT INTO {T.AUTH_USERS} (user_id, email) VALUES (2, 'prefs2@example.com')")

    yield path

    db.close_pool()
    db.sqlite_path, db.is_postgres, db.db_url = original
    db.close_pool()


def test_get_user_grid_preference_returns_empty_default_when_unsaved(prefs_db):
    result = ups.get_user_grid_preference(user_id=1, grid_id="players")
    assert result == {
        "user_id": 1,
        "grid_id": "players",
        "sort_column": None,
        "sort_direction": None,
        "pinned_filter_set": None,
        "dashboard_pin": 0,
        "columns": [],
    }


def test_list_user_grid_preferences_empty_for_new_user(prefs_db):
    assert ups.list_user_grid_preferences(user_id=1) == []


def test_update_user_grid_preference_lazily_creates_row(prefs_db):
    result = ups.update_user_grid_preference(
        user_id=1, grid_id="players", body={"sort_column": "name", "sort_direction": "asc"},
    )
    assert result["sort_column"] == "name"
    assert result["sort_direction"] == "asc"
    assert result["dashboard_pin"] == 0
    assert result["columns"] == []

    row_count = db.query(
        f"SELECT COUNT(*) as n FROM {T.APP_GRID_SETTINGS_USER} WHERE user_id = 1 AND grid_id = 'players'"
    )
    assert int(row_count.iloc[0]["n"]) == 1


def test_update_user_grid_preference_partial_update_preserves_other_fields(prefs_db):
    ups.update_user_grid_preference(
        user_id=1, grid_id="players", body={"sort_column": "name", "sort_direction": "asc"},
    )
    result = ups.update_user_grid_preference(user_id=1, grid_id="players", body={"dashboard_pin": True})
    assert result["dashboard_pin"] is True or result["dashboard_pin"] == 1
    assert result["sort_column"] == "name"
    assert result["sort_direction"] == "asc"


def test_update_user_grid_preference_dashboard_pin_bool_coercion(prefs_db):
    result = ups.update_user_grid_preference(user_id=1, grid_id="dashboard", body={"dashboard_pin": True})
    assert result["dashboard_pin"] == 1
    result_off = ups.update_user_grid_preference(user_id=1, grid_id="dashboard", body={"dashboard_pin": False})
    assert result_off["dashboard_pin"] == 0


def test_update_user_grid_preference_with_columns_creates_column_rows(prefs_db):
    result = ups.update_user_grid_preference(
        user_id=1,
        grid_id="players",
        body={"columns": [{"column_id": "name", "visible": True, "column_order": 1}]},
    )
    assert len(result["columns"]) == 1
    col = result["columns"][0]
    assert col["column_id"] == "name"
    assert col["visible"] == 1
    assert col["column_order"] == 1


def test_update_user_grid_preference_ignores_column_without_id(prefs_db):
    result = ups.update_user_grid_preference(
        user_id=1,
        grid_id="players",
        body={"columns": [{"visible": True}, {"column_id": "  "}]},
    )
    assert result["columns"] == []


def test_update_user_grid_preference_empty_body_is_noop(prefs_db):
    result = ups.update_user_grid_preference(user_id=1, grid_id="players", body={})
    assert result == ups.get_user_grid_preference(user_id=1, grid_id="players")
    row_count = db.query(
        f"SELECT COUNT(*) as n FROM {T.APP_GRID_SETTINGS_USER} WHERE user_id = 1 AND grid_id = 'players'"
    )
    assert int(row_count.iloc[0]["n"]) == 0


def test_unpin_user_grid_column_removes_only_target_column(prefs_db):
    ups.update_user_grid_preference(
        user_id=1,
        grid_id="player_pins",
        body={"columns": [
            {"column_id": "player_1", "visible": True, "column_order": 0},
            {"column_id": "player_2", "visible": True, "column_order": 1},
        ]},
    )
    result = ups.unpin_user_grid_column(user_id=1, grid_id="player_pins", column_id="player_1")
    remaining = [c["column_id"] for c in result["columns"]]
    assert remaining == ["player_2"]


def test_unpin_user_grid_column_missing_column_is_a_noop(prefs_db):
    ups.update_user_grid_preference(
        user_id=1, grid_id="players", body={"columns": [{"column_id": "name", "visible": True}]},
    )
    result = ups.unpin_user_grid_column(user_id=1, grid_id="players", column_id="does-not-exist")
    assert [c["column_id"] for c in result["columns"]] == ["name"]


def test_list_user_grid_preferences_scopes_by_user_and_includes_synthetic_ids(prefs_db):
    ups.update_user_grid_preference(user_id=1, grid_id="dashboard", body={"dashboard_pin": True})
    ups.update_user_grid_preference(user_id=1, grid_id="players", body={"sort_column": "name"})
    ups.update_user_grid_preference(user_id=2, grid_id="dashboard", body={"dashboard_pin": True})

    rows = ups.list_user_grid_preferences(user_id=1)
    grid_ids = sorted(r["grid_id"] for r in rows)
    assert grid_ids == ["dashboard", "players"]
    assert all(r["user_id"] == 1 for r in rows)
