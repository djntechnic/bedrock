"""
Module:  test_auth.py
Layer:   api/tests
Desc:    Phase 5.2 — end-to-end auth coverage: register creates a user +
         hashes the password, login returns a JWT, /me echoes the profile,
         bad credentials get 401, bad/missing token gets 401, and revoked
         sessions are rejected.
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




# Phase 5.5 — this file exercises the real auth chain; opt out of the
# autouse test-mode bypass installed by api/tests/conftest.py.
@pytest.fixture(autouse=True)
def _use_real_auth_guards(real_auth_guards):
    yield
@pytest.fixture
def client():
    return TestClient(app)


def _fresh_email() -> str:
    return f"auth-{uuid.uuid4().hex[:10]}@test.example.com"


def _register(client: TestClient, *, email: str | None = None, password: str = "correct-horse-battery") -> dict:
    body = {"email": email or _fresh_email(), "password": password, "display_name": "Test User"}
    r = client.post("/api/v1/auth/register", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_register_creates_user_with_hashed_password(client):
    email = _fresh_email()
    payload = _register(client, email=email)

    assert payload["token_type"] == "bearer"
    assert payload["access_token"]
    assert payload["user"]["email"] == email
    assert payload["user"]["roles"] == ["collector"]

    # Password must be hashed (never stored raw); bcrypt hashes start with $2
    user = us.get_user_by_email(email)
    assert user is not None
    raw = us._get_password_hash(user.user_id)
    assert raw is not None and raw.startswith("$2") and "correct-horse-battery" not in raw


def test_register_duplicate_email_returns_409(client):
    email = _fresh_email()
    _register(client, email=email)
    r = client.post("/api/v1/auth/register", json={"email": email, "password": "another-strong-pw"})
    assert r.status_code == 409


def test_login_returns_token_for_valid_credentials(client):
    email = _fresh_email()
    _register(client, email=email, password="p@ssw0rd-longenough")
    r = client.post("/api/v1/auth/login", json={"email": email, "password": "p@ssw0rd-longenough"})
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"]
    assert body["user"]["email"] == email


def test_login_rejects_wrong_password(client):
    email = _fresh_email()
    _register(client, email=email, password="right-password-123")
    r = client.post("/api/v1/auth/login", json={"email": email, "password": "wrong-password-123"})
    assert r.status_code == 401


def test_login_rejects_unknown_email(client):
    r = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody-here@test.example.com", "password": "whatever-123"},
    )
    assert r.status_code == 401


def test_me_requires_token(client):
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401


def test_me_rejects_invalid_token(client):
    r = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-jwt"})
    assert r.status_code == 401


def test_me_returns_profile_with_valid_token(client):
    email = _fresh_email()
    payload = _register(client, email=email)
    token = payload["access_token"]
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == email
    assert body["is_active"] is True
    assert "collector" in body["roles"]


def test_logout_revokes_current_session(client):
    email = _fresh_email()
    payload = _register(client, email=email)
    token = payload["access_token"]

    # baseline: /me works
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 200

    r = client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 204

    # After logout the same jti is revoked → /me now 401
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_change_password_flow(client):
    email = _fresh_email()
    _register(client, email=email, password="orig-password-1")
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "orig-password-1"}).json()
    token = login["access_token"]

    # Wrong current password → 401
    r = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "not-the-real-one", "new_password": "new-password-2"},
    )
    assert r.status_code == 401

    # Correct current password → 204
    r = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "orig-password-1", "new_password": "new-password-2"},
    )
    assert r.status_code == 204

    # Old password no longer works
    assert client.post(
        "/api/v1/auth/login", json={"email": email, "password": "orig-password-1"}
    ).status_code == 401
    # New password does
    assert client.post(
        "/api/v1/auth/login", json={"email": email, "password": "new-password-2"}
    ).status_code == 200
