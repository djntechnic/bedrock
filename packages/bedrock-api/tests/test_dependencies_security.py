"""
Module:  test_dependencies_security.py
Layer:   bedrock-api/tests
Desc:    Unit tests for require_permission FastAPI dependency.
"""
from __future__ import annotations

import os
import sqlite3
import tempfile
import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient

from bedrock.core import migrations
from bedrock.core.database import db
from bedrock.core.schema_catalog import Tables as T
from bedrock.dependencies import require_permission
from bedrock.services import user_service as us
from bedrock.services import security_service as ss


@pytest.fixture
def sec_app_db():
    tmpdir = tempfile.mkdtemp(prefix="bedrock-dep-sec-")
    path = os.path.join(tmpdir, "dep_sec.db")
    
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


def test_require_permission_endpoint(sec_app_db):
    app = FastAPI()

    @app.get("/public-health", dependencies=[require_permission("health", "view", allow_anon=True)])
    def public_health():
        return {"status": "ok"}

    @app.get("/inventory/view", dependencies=[require_permission("inventory", "view", allow_anon=False)])
    def view_inventory():
        return {"data": "cards"}

    @app.post("/inventory/execute", dependencies=[require_permission("inventory", "execute")])
    def execute_import():
        return {"status": "import_started"}

    client = TestClient(app)

    # 1. Anonymous access to public health (anon role has view=1 on health) -> 200
    res = client.get("/public-health")
    assert res.status_code == 200

    # 2. Anonymous access to private inventory view -> 401
    res = client.get("/inventory/view")
    assert res.status_code == 401

    # 3. Create normal viewer user (view=1 on inventory, execute=0)
    viewer_user = us.create_user(email="viewer@example.com", password="Password123!", default_role="viewer")
    inv_mod_id = int(db.query(f"SELECT module_id FROM {T.AUTH_MODULES} WHERE slug = 'inventory'").iloc[0]["module_id"])
    viewer_role_id = int(db.query(f"SELECT role_id FROM {T.AUTH_ROLES} WHERE slug = 'viewer'").iloc[0]["role_id"])
    db.execute(
        f"INSERT INTO {T.AUTH_ROLE_MODULES} (role_id, module_id, can_view, can_update, can_delete, can_execute) "
        f"VALUES (%s, %s, 1, 0, 0, 0)",
        (viewer_role_id, inv_mod_id),
    )
    viewer_token = us.create_access_token(viewer_user.user_id)
    viewer_headers = {"Authorization": f"Bearer {viewer_token}"}

    # Viewer can view inventory -> 200
    res_v = client.get("/inventory/view", headers=viewer_headers)
    assert res_v.status_code == 200

    # Viewer cannot execute import -> 403 Forbidden with structured code
    res_e = client.post("/inventory/execute", headers=viewer_headers)
    assert res_e.status_code == 403
    assert res_e.json()["detail"]["code"] == "permission_denied"
    assert res_e.json()["detail"]["module"] == "inventory"
    assert res_e.json()["detail"]["action"] == "execute"

    # 4. Admin user has full access -> 200
    admin_user = us.create_user(email="admin@example.com", password="Password123!", default_role="admin")
    admin_token = us.create_access_token(admin_user.user_id)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    res_admin = client.post("/inventory/execute", headers=admin_headers)
    assert res_admin.status_code == 200
