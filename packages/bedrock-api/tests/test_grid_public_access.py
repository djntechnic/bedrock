import pytest
from fastapi.testclient import TestClient

def test_unauthenticated_user_can_read_grid_settings(client: TestClient):
    response = client.get("/api/v1/admin/grids")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert isinstance(data["data"], list)

def test_unauthenticated_user_can_read_grid_columns(client: TestClient):
    response = client.get("/api/v1/admin/grids/admin_config_settings/columns")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert isinstance(data["data"], list)

def test_unauthenticated_user_cannot_modify_grid_column(client: TestClient):
    response = client.patch(
        "/api/v1/admin/grids/admin_config_settings/columns/key",
        json={"label_override": "Hacked Key"},
    )
    assert response.status_code in (401, 403)
