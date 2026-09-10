"""
Module:  test_grid_kpi_gradient.py
Layer:   bedrock-api/tests
Desc:    Endpoint integration test for column-level enable_kpi_gradient persistence (#67).
"""
from __future__ import annotations

import os
import sqlite3
import tempfile
import pytest
from fastapi.testclient import TestClient

from bedrock.core import migrations
from bedrock.core.app_factory import create_app
from bedrock.core.database import db
from bedrock.core.schema_catalog import Tables as T
from bedrock.services import user_service as us


@pytest.fixture
def grid_test_client():
    tmpdir = tempfile.mkdtemp(prefix="bedrock-grid-tests-")
    path = os.path.join(tmpdir, "grid_test.db")

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

    app = create_app(
        title="Bedrock Grid Test API",
        version="1.0.0",
        bootstrap=False,
    )
    client = TestClient(app)

    yield client

    db.close_pool()
    db.sqlite_path, db.is_postgres, db.db_url = original
    db.close_pool()


def test_grid_column_enable_kpi_gradient_patch(grid_test_client):
    client = grid_test_client

    # 1. Create an admin user & login
    admin_user = us.create_user(
        email="admin_grid@example.com",
        password="AdminPassword123!",
        display_name="Admin Grid",
        default_role="admin",
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "admin_grid@example.com", "password": "AdminPassword123!"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Insert test grid and column in DB
    db.execute(
        f"""
        INSERT INTO {T.APP_GRID_SETTINGS}
            (grid_id, grid_label, title)
        VALUES (%s, %s, %s)
        """,
        ("test_kpi_grid", "Test KPI Grid", "Test KPI Grid"),
    )
    grid_df = db.query(f"SELECT grid_setting_id FROM {T.APP_GRID_SETTINGS} WHERE grid_id = %s", ("test_kpi_grid",))
    grid_setting_id = int(grid_df.iloc[0]["grid_setting_id"])

    db.execute(
        f"""
        INSERT INTO {T.APP_GRID_COLUMN_SETTINGS}
            (grid_setting_id, column_id, label_override, cell_type, enable_kpi_gradient)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (grid_setting_id, "kpi_score", "KPI Score", "number", 0),
    )

    # 3. Patch enable_kpi_gradient to true
    patch_res = client.patch(
        "/api/v1/admin/grids/test_kpi_grid/columns/kpi_score",
        json={"enable_kpi_gradient": True},
        headers=headers,
    )
    assert patch_res.status_code == 200

    # 4. Get columns and verify enable_kpi_gradient is True
    get_res = client.get("/api/v1/admin/grids/test_kpi_grid/columns")
    assert get_res.status_code == 200
    cols = get_res.json()["data"]
    kpi_col = next((c for c in cols if c["column_id"] == "kpi_score"), None)
    assert kpi_col is not None
    assert kpi_col["enable_kpi_gradient"] is True
