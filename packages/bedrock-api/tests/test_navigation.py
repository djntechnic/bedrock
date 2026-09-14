"""
Module:  test_navigation.py
Layer:   bedrock-api/tests
Desc:    Endpoint integration tests for /api/v1/navigation routes:
         - Public GET (anonymous access)
         - Admin-gated PUT/DELETE
         - Permission enforcement for non-admin callers
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
def nav_route_client():
    tmpdir = tempfile.mkdtemp(prefix="bedrock-nav-routes-")
    path = os.path.join(tmpdir, "nav_routes_test.db")

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

    app = create_app(title="Bedrock Test API", version="1.0.0", bootstrap=False)
    client = TestClient(app)

    yield client

    db.close_pool()
    db.sqlite_path, db.is_postgres, db.db_url = original
    db.close_pool()


def _admin_headers(client):
    admin_user = us.create_user(email="nav_admin@example.com", password="Password123!", default_role="admin")
    token = us.create_access_token(admin_user.user_id)
    return {"Authorization": f"Bearer {token}"}, admin_user


def _viewer_headers(client):
    viewer_user = us.create_user(email="nav_viewer@example.com", password="Password123!", default_role="viewer")
    token = us.create_access_token(viewer_user.user_id)
    return {"Authorization": f"Bearer {token}"}, viewer_user


def test_get_navigation_settings_anonymous_returns_empty_list(nav_route_client):
    res = nav_route_client.get("/api/v1/navigation/settings")
    assert res.status_code == 200
    assert res.json() == []


def test_put_navigation_settings_requires_admin_permission(nav_route_client):
    viewer_headers, _ = _viewer_headers(nav_route_client)
    res = nav_route_client.put(
        "/api/v1/navigation/settings",
        json={"settings": [{"nav_key": "/inventory", "sort_order": 1}]},
        headers=viewer_headers,
    )
    assert res.status_code == 403


def test_put_navigation_settings_unauthenticated_is_rejected(nav_route_client):
    res = nav_route_client.put(
        "/api/v1/navigation/settings",
        json={"settings": [{"nav_key": "/inventory", "sort_order": 1}]},
    )
    assert res.status_code in (401, 403)


def test_put_and_get_navigation_settings_roundtrip(nav_route_client):
    admin_headers, _ = _admin_headers(nav_route_client)

    put_res = nav_route_client.put(
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

    get_res = nav_route_client.get("/api/v1/navigation/settings")
    assert get_res.status_code == 200
    get_settings = get_res.json()
    assert len(get_settings) == 1
    assert get_settings[0]["icon_override"] == "Archive"


def test_delete_navigation_setting_by_key(nav_route_client):
    admin_headers, _ = _admin_headers(nav_route_client)
    nav_route_client.put(
        "/api/v1/navigation/settings",
        json={"settings": [{"nav_key": "/a", "sort_order": 1}, {"nav_key": "/b", "sort_order": 2}]},
        headers=admin_headers,
    )

    del_res = nav_route_client.delete("/api/v1/navigation/settings/%2Fa", headers=admin_headers)
    assert del_res.status_code == 200
    remaining = [s["nav_key"] for s in del_res.json()]
    assert remaining == ["/b"]


def test_delete_navigation_setting_requires_admin_permission(nav_route_client):
    admin_headers, _ = _admin_headers(nav_route_client)
    nav_route_client.put(
        "/api/v1/navigation/settings",
        json={"settings": [{"nav_key": "/a", "sort_order": 1}]},
        headers=admin_headers,
    )
    viewer_headers, _ = _viewer_headers(nav_route_client)
    res = nav_route_client.delete("/api/v1/navigation/settings/%2Fa", headers=viewer_headers)
    assert res.status_code == 403


def test_reset_navigation_settings_clears_all(nav_route_client):
    admin_headers, _ = _admin_headers(nav_route_client)
    nav_route_client.put(
        "/api/v1/navigation/settings",
        json={"settings": [{"nav_key": "/a", "sort_order": 1}, {"nav_key": "/b", "sort_order": 2}]},
        headers=admin_headers,
    )

    reset_res = nav_route_client.delete("/api/v1/navigation/settings", headers=admin_headers)
    assert reset_res.status_code == 200
    assert reset_res.json() == []

    get_res = nav_route_client.get("/api/v1/navigation/settings")
    assert get_res.json() == []


def test_reset_navigation_settings_requires_admin_permission(nav_route_client):
    viewer_headers, _ = _viewer_headers(nav_route_client)
    res = nav_route_client.delete("/api/v1/navigation/settings", headers=viewer_headers)
    assert res.status_code == 403
