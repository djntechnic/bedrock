"""
Module:  test_migration_005.py
Layer:   bedrock-api/tests
Desc:    Tests for migration 005_granular_security_and_nav_model.sql:
         - Verifies granular capability columns on auth_role_modules (can_view, can_update, can_delete, can_execute)
         - Verifies nullable tri-state capability columns on auth_user_module_overrides
         - Verifies audit columns (created_at, created_by, modified_at, modified_by) on in-scope tables
         - Verifies app_nav_item_settings table and structure
"""
from __future__ import annotations

import os
import sqlite3
import tempfile
import pytest

from bedrock.core import migrations
from bedrock.core.database import db
from bedrock.core.schema_catalog import Tables as T


@pytest.fixture
def clean_migration_db():
    tmpdir = tempfile.mkdtemp(prefix="bedrock-mig005-")
    path = os.path.join(tmpdir, "test_005.db")
    
    # Initialize empty db
    conn = sqlite3.connect(path)
    conn.close()

    original = (db.sqlite_path, db.is_postgres, db.db_url)
    db.sqlite_path, db.is_postgres, db.db_url = path, False, None
    db.close_pool()

    # Apply all migrations including baseline and 005
    migrations.apply_migrations()

    yield path

    db.close_pool()
    db.sqlite_path, db.is_postgres, db.db_url = original
    db.close_pool()


def test_auth_role_modules_has_granular_and_audit_columns(clean_migration_db):
    cols = {r["name"]: r for r in db.query(f"PRAGMA table_info({T.AUTH_ROLE_MODULES})").to_dict(orient="records")}
    assert "can_view" in cols
    assert "can_update" in cols
    assert "can_delete" in cols
    assert "can_execute" in cols
    assert "created_at" in cols
    assert "created_by" in cols
    assert "modified_at" in cols
    assert "modified_by" in cols


def test_auth_user_module_overrides_has_granular_and_audit_columns(clean_migration_db):
    cols = {r["name"]: r for r in db.query(f"PRAGMA table_info({T.AUTH_USER_MODULE_OVERRIDES})").to_dict(orient="records")}
    assert "can_view" in cols
    assert "can_update" in cols
    assert "can_delete" in cols
    assert "can_execute" in cols
    assert "created_at" in cols
    assert "created_by" in cols
    assert "modified_at" in cols
    assert "modified_by" in cols


def test_app_nav_item_settings_table_structure(clean_migration_db):
    cols = {r["name"]: r for r in db.query(f"PRAGMA table_info({T.APP_NAV_ITEM_SETTINGS})").to_dict(orient="records")}
    assert "nav_key" in cols
    assert "parent_key" in cols
    assert "sort_order" in cols
    assert "label_override" in cols
    assert "icon_override" in cols
    assert "tooltip_override" in cols
    assert "is_hidden_override" in cols
    assert "created_at" in cols
    assert "created_by" in cols
    assert "modified_at" in cols
    assert "modified_by" in cols


def test_auth_roles_and_modules_have_audit_columns(clean_migration_db):
    roles_cols = {r["name"]: r for r in db.query(f"PRAGMA table_info({T.AUTH_ROLES})").to_dict(orient="records")}
    assert "description" in roles_cols
    assert "created_by" in roles_cols
    assert "modified_at" in roles_cols
    assert "modified_by" in roles_cols

    mods_cols = {r["name"]: r for r in db.query(f"PRAGMA table_info({T.AUTH_MODULES})").to_dict(orient="records")}
    assert "created_by" in mods_cols
    assert "modified_at" in mods_cols
    assert "modified_by" in mods_cols
