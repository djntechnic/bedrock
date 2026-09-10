"""
Module:  test_help.py
Layer:   bedrock-api/tests
Desc:    Endpoint integration tests for public /api/v1/help/{topic_key} and admin /api/v1/admin/help routes.
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
from bedrock.services import user_service as us


@pytest.fixture
def help_test_client():
    tmpdir = tempfile.mkdtemp(prefix="bedrock-help-tests-")
    path = os.path.join(tmpdir, "help_test.db")

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
        title="Bedrock Help Test API",
        version="1.0.0",
        bootstrap=False,
    )
    client = TestClient(app)

    yield client

    db.close_pool()
    db.sqlite_path, db.is_postgres, db.db_url = original
    db.close_pool()


def test_public_help_endpoint_and_admin_crud(help_test_client):
    client = help_test_client

    # 1. 404 for non-existent topic
    res = client.get("/api/v1/help/non_existent_topic")
    assert res.status_code == 404

    # 2. Non-admin cannot create help entry
    create_payload = {
        "topic_key": "grid_editing",
        "title": "Grid Editing Guide",
        "body_markdown": "Double-click a cell to edit its value inline.",
        "doc_url": "https://example.com/docs/grid",
        "doc_label": "Grid Documentation",
    }
    res_unauth = client.post("/api/v1/admin/help", json=create_payload)
    assert res_unauth.status_code in (401, 403)

    # 3. Create admin user & login
    admin_user = us.create_user(
        email="admin_help@example.com",
        password="AdminPassword123!",
        display_name="Admin Help",
        default_role="admin",
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "admin_help@example.com", "password": "AdminPassword123!"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 4. Admin creates help entry
    create_res = client.post("/api/v1/admin/help", json=create_payload, headers=headers)
    assert create_res.status_code in (200, 201)
    created_data = create_res.json()
    assert created_data["topic_key"] == "grid_editing"
    assert created_data["title"] == "Grid Editing Guide"

    # 5. Public GET retrieves the created entry
    get_res = client.get("/api/v1/help/grid_editing")
    assert get_res.status_code == 200
    public_data = get_res.json()
    assert public_data["topic_key"] == "grid_editing"
    assert public_data["title"] == "Grid Editing Guide"
    assert public_data["body_markdown"] == "Double-click a cell to edit its value inline."
    assert public_data["doc_url"] == "https://example.com/docs/grid"
    assert public_data["doc_label"] == "Grid Documentation"

    # 6. Admin lists all help entries
    list_res = client.get("/api/v1/admin/help", headers=headers)
    assert list_res.status_code == 200
    entries = list_res.json()
    assert len(entries) >= 1
    assert any(e["topic_key"] == "grid_editing" for e in entries)

    # 7. Admin patches the help entry
    patch_payload = {
        "title": "Updated Grid Editing Guide",
        "body_markdown": "Updated instructions for editing.",
    }
    patch_res = client.patch("/api/v1/admin/help/grid_editing", json=patch_payload, headers=headers)
    assert patch_res.status_code == 200
    patched_data = patch_res.json()
    assert patched_data["title"] == "Updated Grid Editing Guide"
    assert patched_data["body_markdown"] == "Updated instructions for editing."

    # 8. Admin deletes the help entry
    delete_res = client.delete("/api/v1/admin/help/grid_editing", headers=headers)
    assert delete_res.status_code == 200

    # 9. Public GET now returns 404
    after_del_res = client.get("/api/v1/help/grid_editing")
    assert after_del_res.status_code == 404
