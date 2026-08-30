"""
Module:  test_routes_security_and_nav.py
Layer:   bedrock-api/tests
Desc:    Endpoint integration tests for /api/v1/security and /api/v1/navigation routes.
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
def api_test_client():
    tmpdir = tempfile.mkdtemp(prefix="bedrock-api-routes-")
    path = os.path.join(tmpdir, "routes_test.db")
    
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
        title="Bedrock Test API",
        version="1.0.0",
        bootstrap=False,
    )
    client = TestClient(app)

    yield client

    db.close_pool()
    db.sqlite_path, db.is_postgres, db.db_url = original
    db.close_pool()


def test_my_permissions_route_anonymous_and_authenticated(api_test_client):
    # Anonymous call
    res_anon = api_test_client.get("/api/v1/security/my-permissions")
    assert res_anon.status_code == 200
    anon_data = res_anon.json()
    assert "health" in anon_data
    assert anon_data["health"]["view"] is True
    assert anon_data["admin"]["view"] is False

    # Authenticated admin user
    admin_user = us.create_user(email="admin_route@example.com", password="Password123!", default_role="admin")
    admin_token = us.create_access_token(admin_user.user_id)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    res_admin = api_test_client.get("/api/v1/security/my-permissions", headers=admin_headers)
    assert res_admin.status_code == 200
    admin_data = res_admin.json()
    assert admin_data["admin"]["view"] is True
    assert admin_data["admin"]["update"] is True


def test_role_crud_and_matrix_routes(api_test_client):
    admin_user = us.create_user(email="admin_crud@example.com", password="Password123!", default_role="admin")
    admin_token = us.create_access_token(admin_user.user_id)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create custom role
    create_res = api_test_client.post(
        "/api/v1/security/roles",
        json={"slug": "curator", "label": "Content Curator", "description": "Curates items"},
        headers=admin_headers,
    )
    assert create_res.status_code == 200
    role_id = create_res.json()["role_id"]

    # 2. List roles
    list_res = api_test_client.get("/api/v1/security/roles", headers=admin_headers)
    assert list_res.status_code == 200
    slugs = [r["slug"] for r in list_res.json()]
    assert "curator" in slugs

    # 3. Update matrix
    admin_mod_id = int(db.query(f"SELECT module_id FROM {T.AUTH_MODULES} WHERE slug = 'admin'").iloc[0]["module_id"])
    matrix_res = api_test_client.put(
        "/api/v1/security/matrix",
        json={
            "updates": [
                {
                    "role_id": role_id,
                    "module_id": admin_mod_id,
                    "can_view": True,
                    "can_update": False,
                    "can_delete": False,
                    "can_execute": False,
                }
            ]
        },
        headers=admin_headers,
    )
    assert matrix_res.status_code == 200

    # 4. Inspect User Profile Inspector Endpoint
    prof_res = api_test_client.get(f"/api/v1/security/users/{admin_user.user_id}/profile", headers=admin_headers)
    assert prof_res.status_code == 200
    prof_data = prof_res.json()
    assert "effective" in prof_data
    assert prof_data["effective"]["admin"]["view"] is True


def test_navigation_settings_routes(api_test_client):
    admin_user = us.create_user(email="admin_nav@example.com", password="Password123!", default_role="admin")
    admin_token = us.create_access_token(admin_user.user_id)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Update navigation settings
    put_res = api_test_client.put(
        "/api/v1/navigation/settings",
        json={
            "settings": [
                {
                    "nav_key": "/inventory",
                    "sort_order": 5,
                    "label_override": "Card Vault",
                    "icon_override": "Archive",
                    "tooltip_override": "Your personal collection",
                    "is_hidden_override": False,
                }
            ]
        },
        headers=admin_headers,
    )
    assert put_res.status_code == 200
    settings = put_res.json()
    assert len(settings) == 1
    assert settings[0]["nav_key"] == "/inventory"
    assert settings[0]["label_override"] == "Card Vault"

    # 2. Get navigation settings (public access)
    get_res = api_test_client.get("/api/v1/navigation/settings")
    assert get_res.status_code == 200
    get_settings = get_res.json()
    assert len(get_settings) == 1
    assert get_settings[0]["icon_override"] == "Archive"


def test_user_overrides_bulk_route(api_test_client):
    admin_user = us.create_user(email="admin_overrides@example.com", password="Password123!", default_role="admin")
    admin_token = us.create_access_token(admin_user.user_id)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    target_user = us.create_user(email="target_overrides@example.com", password="Password123!", default_role="viewer")
    admin_mod_id = int(db.query(f"SELECT module_id FROM {T.AUTH_MODULES} WHERE slug = 'admin'").iloc[0]["module_id"])
    
    put_res = api_test_client.put(
        f"/api/v1/security/users/{target_user.user_id}/overrides",
        json={
            "overrides": [
                {
                    "module_id": admin_mod_id,
                    "can_view": True,
                    "can_update": False,
                    "can_delete": None,
                    "can_execute": None,
                }
            ]
        },
        headers=admin_headers,
    )
    assert put_res.status_code == 200
    
    get_res = api_test_client.get(f"/api/v1/security/users/{target_user.user_id}/overrides", headers=admin_headers)
    assert get_res.status_code == 200
    data = get_res.json()
    
    override = next((item for item in data if item["module_id"] == admin_mod_id), None)
    assert override is not None
    # Depending on pydantic response, true might be serialized to true or 1.
    assert override["can_view"] in (1, True)
    assert override["can_update"] in (0, False)
    assert override["can_delete"] is None

def test_user_security_profile_access(api_test_client):
    admin_user = us.create_user(email="admin_prof@example.com", password="Password123!", default_role="admin")
    admin_token = us.create_access_token(admin_user.user_id)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    member_user = us.create_user(email="member_prof@example.com", password="Password123!", default_role="viewer")
    member_token = us.create_access_token(member_user.user_id)
    member_headers = {"Authorization": f"Bearer {member_token}"}

    # Admin viewing member profile (allowed)
    admin_view_res = api_test_client.get(f"/api/v1/security/users/{member_user.user_id}/profile", headers=admin_headers)
    assert admin_view_res.status_code == 200

    # Member viewing their own profile (allowed)
    member_self_res = api_test_client.get(f"/api/v1/security/users/{member_user.user_id}/profile", headers=member_headers)
    assert member_self_res.status_code == 200

    # Member viewing admin profile (forbidden)
    member_other_res = api_test_client.get(f"/api/v1/security/users/{admin_user.user_id}/profile", headers=member_headers)
    assert member_other_res.status_code == 403
