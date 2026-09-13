"""
Module:  test_user_preferences.py
Layer:   bedrock-api/tests
Desc:    Endpoint integration tests for /api/v1/user-preferences routes:
         - List/get with no saved rows (never 404s)
         - PATCH lazily creates a row and supports partial updates
         - DELETE unpins a single column
         - Unauthenticated calls are rejected
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
def prefs_route_client():
    tmpdir = tempfile.mkdtemp(prefix="bedrock-prefs-routes-")
    path = os.path.join(tmpdir, "prefs_routes_test.db")

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


def _member_headers(client, email="prefs_member@example.com"):
    user = us.create_user(email=email, password="Password123!", default_role="member")
    token = us.create_access_token(user.user_id)
    return {"Authorization": f"Bearer {token}"}, user


def test_list_my_grid_preferences_unauthenticated_rejected(prefs_route_client):
    res = prefs_route_client.get("/api/v1/user-preferences/grids")
    assert res.status_code == 401


def test_list_my_grid_preferences_empty_for_new_user(prefs_route_client):
    headers, _ = _member_headers(prefs_route_client)
    res = prefs_route_client.get("/api/v1/user-preferences/grids", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["data"] == []


def test_get_my_grid_preference_never_404s_for_unsaved_grid(prefs_route_client):
    headers, user = _member_headers(prefs_route_client)
    res = prefs_route_client.get("/api/v1/user-preferences/grids/players", headers=headers)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["user_id"] == user.user_id
    assert data["grid_id"] == "players"
    assert data["dashboard_pin"] is False
    assert data["columns"] == []


def test_patch_my_grid_preference_creates_and_updates(prefs_route_client):
    headers, user = _member_headers(prefs_route_client)

    patch_res = prefs_route_client.patch(
        "/api/v1/user-preferences/grids/players",
        json={"sort_column": "name", "sort_direction": "asc"},
        headers=headers,
    )
    assert patch_res.status_code == 200
    data = patch_res.json()["data"]
    assert data["sort_column"] == "name"
    assert data["sort_direction"] == "asc"

    get_res = prefs_route_client.get("/api/v1/user-preferences/grids/players", headers=headers)
    assert get_res.json()["data"]["sort_column"] == "name"


def test_patch_my_grid_preference_partial_update_with_columns(prefs_route_client):
    headers, _ = _member_headers(prefs_route_client)

    prefs_route_client.patch(
        "/api/v1/user-preferences/grids/players",
        json={"sort_column": "name"},
        headers=headers,
    )
    patch_res = prefs_route_client.patch(
        "/api/v1/user-preferences/grids/players",
        json={"columns": [{"column_id": "name", "visible": True, "column_order": 0}]},
        headers=headers,
    )
    assert patch_res.status_code == 200
    data = patch_res.json()["data"]
    assert data["sort_column"] == "name"
    assert len(data["columns"]) == 1
    assert data["columns"][0]["column_id"] == "name"


def test_patch_my_grid_preference_unauthenticated_rejected(prefs_route_client):
    res = prefs_route_client.patch(
        "/api/v1/user-preferences/grids/players", json={"sort_column": "name"},
    )
    assert res.status_code == 401


def test_unpin_my_grid_column_removes_row(prefs_route_client):
    headers, _ = _member_headers(prefs_route_client)
    prefs_route_client.patch(
        "/api/v1/user-preferences/grids/player_pins",
        json={"columns": [
            {"column_id": "player_1", "visible": True, "column_order": 0},
            {"column_id": "player_2", "visible": True, "column_order": 1},
        ]},
        headers=headers,
    )

    del_res = prefs_route_client.delete(
        "/api/v1/user-preferences/grids/player_pins/columns/player_1", headers=headers,
    )
    assert del_res.status_code == 200
    remaining = [c["column_id"] for c in del_res.json()["data"]["columns"]]
    assert remaining == ["player_2"]


def test_unpin_my_grid_column_missing_column_is_a_noop(prefs_route_client):
    headers, _ = _member_headers(prefs_route_client)
    prefs_route_client.patch(
        "/api/v1/user-preferences/grids/players",
        json={"columns": [{"column_id": "name", "visible": True}]},
        headers=headers,
    )
    res = prefs_route_client.delete(
        "/api/v1/user-preferences/grids/players/columns/does-not-exist", headers=headers,
    )
    assert res.status_code == 200
    assert [c["column_id"] for c in res.json()["data"]["columns"]] == ["name"]


def test_preferences_are_scoped_per_user(prefs_route_client):
    headers_a, _ = _member_headers(prefs_route_client, email="prefs_a@example.com")
    headers_b, _ = _member_headers(prefs_route_client, email="prefs_b@example.com")

    prefs_route_client.patch(
        "/api/v1/user-preferences/grids/players",
        json={"sort_column": "name"},
        headers=headers_a,
    )

    res_b = prefs_route_client.get("/api/v1/user-preferences/grids/players", headers=headers_b)
    assert res_b.json()["data"]["sort_column"] is None
