"""
Module:  test_admin_users.py
Layer:   api/tests
Desc:    Phase 5.8 — admin Users tab endpoints: list, get, patch
         (deactivate/reactivate + role swap), invite, self-protection,
         and 403 for non-admins.
"""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

# The app comes from the package's own test harness (conftest.py): a bare
# FastAPI with only bedrock's routers mounted. There is no equivalent of
# MLBTracker's api.main here, and that is the point — these endpoints have
# to work in an application that registers nothing.
from conftest import build_app  # noqa: E402

app = build_app()
from bedrock.services import user_service as us


@pytest.fixture(autouse=True)
def _use_real_auth_guards(real_auth_guards):
    yield


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def _mint(role: str) -> tuple[us.UserRecord, str]:
    email = f"admusr-{role}-{uuid.uuid4().hex[:8]}@test.example.com"
    user = us.create_user(email=email, password="pw-strong-123", default_role=role)
    for other in ("member", "viewer", "admin"):
        if other != role:
            us.revoke_role(user.user_id, other)
    return user, us.create_access_token(user.user_id)


def test_list_users_requires_admin(client):
    _viewer, tok = _mint("viewer")
    r = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "insufficient_role"


def test_list_users_returns_rows_for_admin(client):
    _admin, tok = _mint("admin")
    r = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200, r.text
    users = r.json()["data"]
    assert isinstance(users, list) and len(users) >= 1
    assert {"user_id", "email", "roles", "is_active"} <= set(users[0].keys())


def test_patch_toggle_active(client):
    _admin, admin_tok = _mint("admin")
    target, _ = _mint("member")
    # deactivate
    r = client.patch(
        f"/api/v1/admin/users/{target.user_id}",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {admin_tok}"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["data"]["is_active"] is False
    # reactivate
    r = client.patch(
        f"/api/v1/admin/users/{target.user_id}",
        json={"is_active": True},
        headers={"Authorization": f"Bearer {admin_tok}"},
    )
    assert r.status_code == 200
    assert r.json()["data"]["is_active"] is True


def test_admin_cannot_deactivate_self(client):
    admin, tok = _mint("admin")
    r = client.patch(
        f"/api/v1/admin/users/{admin.user_id}",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {tok}"},
    )
    assert r.status_code == 409


def test_admin_cannot_remove_own_admin_role(client):
    admin, tok = _mint("admin")
    r = client.patch(
        f"/api/v1/admin/users/{admin.user_id}",
        json={"roles": ["member"]},
        headers={"Authorization": f"Bearer {tok}"},
    )
    assert r.status_code == 409


def test_patch_replaces_role_set(client):
    _admin, admin_tok = _mint("admin")
    target, _ = _mint("member")
    r = client.patch(
        f"/api/v1/admin/users/{target.user_id}",
        json={"roles": ["viewer"]},
        headers={"Authorization": f"Bearer {admin_tok}"},
    )
    assert r.status_code == 200
    assert set(r.json()["data"]["roles"]) == {"viewer"}


def test_invite_new_user(client):
    _admin, admin_tok = _mint("admin")
    email = f"invited-{uuid.uuid4().hex[:8]}@test.example.com"
    r = client.post(
        "/api/v1/admin/users/invite",
        json={"email": email, "display_name": "Invited", "role": "member",
              "password": "invited-strong-123"},
        headers={"Authorization": f"Bearer {admin_tok}"},
    )
    assert r.status_code == 201, r.text
    body = r.json()["data"]
    assert body["email"] == email
    assert "member" in body["roles"]


def test_invite_duplicate_email_409(client):
    _admin, admin_tok = _mint("admin")
    existing, _ = _mint("member")
    r = client.post(
        "/api/v1/admin/users/invite",
        json={"email": existing.email, "role": "member",
              "password": "another-strong-1"},
        headers={"Authorization": f"Bearer {admin_tok}"},
    )
    assert r.status_code == 409


def test_get_user_404(client):
    _admin, admin_tok = _mint("admin")
    r = client.get(
        "/api/v1/admin/users/9999999",
        headers={"Authorization": f"Bearer {admin_tok}"},
    )
    assert r.status_code == 404


def test_sessions_list_and_revoke(client):
    _admin, admin_tok = _mint("admin")
    victim, victim_tok = _mint("member")
    # victim's login above already created a session; grab it.
    r = client.get("/api/v1/admin/sessions",
                   headers={"Authorization": f"Bearer {admin_tok}"})
    assert r.status_code == 200
    sessions = r.json()["data"]
    mine = [s for s in sessions if s["user_id"] == victim.user_id]
    assert mine, "expected at least one session for the victim user"
    session_id = mine[0]["session_id"]

    r = client.delete(f"/api/v1/admin/sessions/{session_id}",
                      headers={"Authorization": f"Bearer {admin_tok}"})
    assert r.status_code == 204

    # Victim's token should now be revoked
    r2 = client.get("/api/v1/auth/me",
                    headers={"Authorization": f"Bearer {victim_tok}"})
    assert r2.status_code == 401


def test_security_events_admin_only(client):
    _v, viewer_tok = _mint("viewer")
    r = client.get("/api/v1/admin/security/events",
                   headers={"Authorization": f"Bearer {viewer_tok}"})
    assert r.status_code == 403
    _a, admin_tok = _mint("admin")
    r = client.get("/api/v1/admin/security/events",
                   headers={"Authorization": f"Bearer {admin_tok}"})
    assert r.status_code == 200
    data = r.json()["data"]
    assert "events" in data and isinstance(data["events"], list)
