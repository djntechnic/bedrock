"""
Module:  test_nav_service.py
Layer:   bedrock-api/tests
Desc:    Unit tests for bedrock.services.nav_service:
         - Empty-state retrieval
         - Bulk insert/upsert of navigation item settings
         - Reset-to-defaults
         - Single-key deletion
"""
from __future__ import annotations

import os
import sqlite3
import tempfile
import pytest

from bedrock.core import migrations
from bedrock.core.database import db
from bedrock.core.schema_catalog import Tables as T
from bedrock.services import nav_service as ns


@pytest.fixture
def nav_db():
    tmpdir = tempfile.mkdtemp(prefix="bedrock-nav-")
    path = os.path.join(tmpdir, "nav_test.db")

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

    yield path

    db.close_pool()
    db.sqlite_path, db.is_postgres, db.db_url = original
    db.close_pool()


def test_get_nav_settings_empty(nav_db):
    assert ns.get_nav_settings() == []


def test_update_nav_settings_inserts_and_returns_sorted(nav_db):
    result = ns.update_nav_settings(
        [
            {"nav_key": "/inventory", "sort_order": 5, "label_override": "Card Vault"},
            {"nav_key": "/dashboard", "sort_order": 1, "icon_override": "Home"},
        ],
        actor="tester@example.com",
    )
    assert [r["nav_key"] for r in result] == ["/dashboard", "/inventory"]
    dashboard = result[0]
    assert dashboard["icon_override"] == "Home"
    assert dashboard["created_by"] == "tester@example.com"
    assert dashboard["modified_by"] == "tester@example.com"


def test_update_nav_settings_upserts_on_conflict(nav_db):
    ns.update_nav_settings(
        [{"nav_key": "/inventory", "sort_order": 5, "label_override": "Card Vault"}],
        actor="first@example.com",
    )
    result = ns.update_nav_settings(
        [{"nav_key": "/inventory", "sort_order": 9, "label_override": "Renamed"}],
        actor="second@example.com",
    )
    assert len(result) == 1
    row = result[0]
    assert row["sort_order"] == 9
    assert row["label_override"] == "Renamed"
    assert row["modified_by"] == "second@example.com"
    # created_by is preserved from the original insert, only modified_by moves.
    assert row["created_by"] == "first@example.com"


def test_update_nav_settings_defaults_missing_optional_fields(nav_db):
    result = ns.update_nav_settings([{"nav_key": "/bare"}])
    assert len(result) == 1
    row = result[0]
    assert row["sort_order"] == 0
    assert row["parent_key"] is None
    assert row["label_override"] is None
    assert row["is_hidden_override"] == 0


def test_update_nav_settings_empty_list_is_noop(nav_db):
    assert ns.update_nav_settings([]) == []


def test_reset_nav_settings_clears_all_rows(nav_db):
    ns.update_nav_settings([{"nav_key": "/a"}, {"nav_key": "/b"}])
    assert len(ns.get_nav_settings()) == 2

    result = ns.reset_nav_settings(actor="admin@example.com")
    assert result == []
    assert ns.get_nav_settings() == []


def test_delete_nav_setting_removes_only_target_key(nav_db):
    ns.update_nav_settings([{"nav_key": "/a"}, {"nav_key": "/b"}])
    result = ns.delete_nav_setting("/a", actor="admin@example.com")
    remaining_keys = [r["nav_key"] for r in result]
    assert remaining_keys == ["/b"]


def test_delete_nav_setting_missing_key_is_a_noop(nav_db):
    ns.update_nav_settings([{"nav_key": "/a"}])
    result = ns.delete_nav_setting("/does-not-exist")
    assert [r["nav_key"] for r in result] == ["/a"]


def test_update_nav_settings_hidden_override_coerced_to_int(nav_db):
    result = ns.update_nav_settings([{"nav_key": "/hidden", "is_hidden_override": True}])
    assert result[0]["is_hidden_override"] == 1
    df_count = db.query(f"SELECT COUNT(*) as n FROM {T.APP_NAV_ITEM_SETTINGS}")
    assert int(df_count.iloc[0]["n"]) == 1
