"""
Module:  test_security_service.py
Layer:   bedrock-api/tests
Desc:    Unit tests for bedrock.services.security_service:
         - Multi-role union resolution (OR logic across assigned roles)
         - Tri-state user overrides (NULL=inherit, 1=grant, 0=deny)
         - Superuser and Admin role full bypass
         - Anonymous user resolution (anon role)
         - Role matrix CRUD and custom role protection
"""
from __future__ import annotations

import os
import sqlite3
import tempfile
import pytest

from bedrock.core import migrations
from bedrock.core.database import db
from bedrock.core.schema_catalog import Tables as T
from bedrock.services import security_service as ss


@pytest.fixture
def sec_db():
    tmpdir = tempfile.mkdtemp(prefix="bedrock-sec-")
    path = os.path.join(tmpdir, "sec_test.db")
    
    conn = sqlite3.connect(path)
    conn.close()

    original = (db.sqlite_path, db.is_postgres, db.db_url)
    db.sqlite_path, db.is_postgres, db.db_url = path, False, None
    db.close_pool()

    migrations.apply_migrations()

    # Seed baseline platform data
    baseline_seed = os.path.join(os.path.dirname(migrations.PLATFORM_MIGRATIONS_DIR), "seed.sql")
    with open(baseline_seed, "r", encoding="utf-8") as f:
        with db.transaction() as c:
            migrations._run_sql_file(baseline_seed, c)

    # Insert test domain module: inventory
    db.execute(
        f"INSERT INTO {T.AUTH_MODULES} (slug, label, description, sort_order) VALUES (%s, %s, %s, %s)",
        ("inventory", "Inventory", "Card Inventory Domain", 10),
    )

    yield path

    db.close_pool()
    db.sqlite_path, db.is_postgres, db.db_url = original
    db.close_pool()


def test_resolve_user_permissions_anonymous(sec_db):
    perms = ss.resolve_user_permissions(None)
    assert "health" in perms
    assert perms["health"]["view"] is True
    assert perms["health"]["update"] is False
    assert "inventory" in perms
    assert perms["inventory"]["view"] is False


def test_resolve_user_permissions_admin_and_superuser(sec_db):
    # Test superuser flag
    perms_su = ss.resolve_user_permissions(999, is_superuser=True)
    assert perms_su["admin"]["view"] is True
    assert perms_su["admin"]["execute"] is True
    assert perms_su["inventory"]["delete"] is True

    # Test admin role
    db.execute(f"INSERT INTO {T.AUTH_USERS} (user_id, email) VALUES (1, 'admin@example.com')")
    admin_role_id = int(db.query(f"SELECT role_id FROM {T.AUTH_ROLES} WHERE slug = 'admin'").iloc[0]["role_id"])
    db.execute(f"INSERT INTO {T.AUTH_USER_ROLES} (user_id, role_id) VALUES (1, %s)", (admin_role_id,))
    
    perms_admin = ss.resolve_user_permissions(1)
    assert perms_admin["admin"]["view"] is True
    assert perms_admin["inventory"]["execute"] is True


def test_resolve_user_permissions_multi_role_union(sec_db):
    db.execute(f"INSERT INTO {T.AUTH_USERS} (user_id, email) VALUES (2, 'user2@example.com')")
    viewer_role_id = int(db.query(f"SELECT role_id FROM {T.AUTH_ROLES} WHERE slug = 'viewer'").iloc[0]["role_id"])
    
    # Create custom role 'importer' with execute=1 on inventory
    importer_role = ss.create_custom_role("importer", "Data Importer", "Can run imports")
    inv_mod_id = int(db.query(f"SELECT module_id FROM {T.AUTH_MODULES} WHERE slug = 'inventory'").iloc[0]["module_id"])
    
    # Set viewer: view=1 on inventory
    db.execute(
        f"INSERT INTO {T.AUTH_ROLE_MODULES} (role_id, module_id, can_view, can_update, can_delete, can_execute) "
        f"VALUES (%s, %s, 1, 0, 0, 0)",
        (viewer_role_id, inv_mod_id),
    )
    # Set importer: view=0, execute=1 on inventory
    db.execute(
        f"INSERT INTO {T.AUTH_ROLE_MODULES} (role_id, module_id, can_view, can_update, can_delete, can_execute) "
        f"VALUES (%s, %s, 0, 0, 0, 1)",
        (importer_role["role_id"], inv_mod_id),
    )

    # Assign both roles to user 2
    db.execute(f"INSERT INTO {T.AUTH_USER_ROLES} (user_id, role_id) VALUES (2, %s)", (viewer_role_id,))
    db.execute(f"INSERT INTO {T.AUTH_USER_ROLES} (user_id, role_id) VALUES (2, %s)", (importer_role["role_id"],))

    perms = ss.resolve_user_permissions(2)
    # Bitwise OR: view=1 (from viewer), execute=1 (from importer), update=0, delete=0
    assert perms["inventory"]["view"] is True
    assert perms["inventory"]["execute"] is True
    assert perms["inventory"]["update"] is False
    assert perms["inventory"]["delete"] is False


def test_resolve_user_permissions_tri_state_overrides(sec_db):
    db.execute(f"INSERT INTO {T.AUTH_USERS} (user_id, email) VALUES (3, 'user3@example.com')")
    viewer_role_id = int(db.query(f"SELECT role_id FROM {T.AUTH_ROLES} WHERE slug = 'viewer'").iloc[0]["role_id"])
    inv_mod_id = int(db.query(f"SELECT module_id FROM {T.AUTH_MODULES} WHERE slug = 'inventory'").iloc[0]["module_id"])
    
    db.execute(
        f"INSERT INTO {T.AUTH_ROLE_MODULES} (role_id, module_id, can_view, can_update, can_delete, can_execute) "
        f"VALUES (%s, %s, 1, 0, 0, 0)",
        (viewer_role_id, inv_mod_id),
    )
    db.execute(f"INSERT INTO {T.AUTH_USER_ROLES} (user_id, role_id) VALUES (3, %s)", (viewer_role_id,))

    # Apply override: force deny view (can_view=0), force grant update (can_update=1), inherit delete & execute (NULL)
    ss.set_user_granular_override(
        user_id=3,
        module_slug="inventory",
        capabilities={"view": False, "update": True, "delete": None, "execute": None},
    )

    perms = ss.resolve_user_permissions(3)
    assert perms["inventory"]["view"] is False      # Overridden to False
    assert perms["inventory"]["update"] is True     # Overridden to True
    assert perms["inventory"]["delete"] is False    # Inherited False
    assert perms["inventory"]["execute"] is False   # Inherited False


def test_role_crud_and_protection(sec_db):
    # Core roles cannot be deleted
    with pytest.raises(ValueError, match="Cannot delete protected core role"):
        admin_id = int(db.query(f"SELECT role_id FROM {T.AUTH_ROLES} WHERE slug = 'admin'").iloc[0]["role_id"])
        ss.delete_custom_role(admin_id)

    # Custom role creation, update, deletion
    role = ss.create_custom_role("analyst", "Analyst", "Data analyst role")
    assert role["slug"] == "analyst"

    updated = ss.update_role(role["role_id"], label="Senior Analyst", description="Updated description")
    assert updated["label"] == "Senior Analyst"

    ss.delete_custom_role(role["role_id"])
    assert db.query(f"SELECT * FROM {T.AUTH_ROLES} WHERE slug = 'analyst'").empty
