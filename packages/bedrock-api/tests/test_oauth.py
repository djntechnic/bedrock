"""
Module:  test_oauth.py
Layer:   api/tests
Desc:    Phase 5.3 — Google OAuth service + endpoints. Uses monkeypatched
         async helpers so no real HTTP calls are issued.
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
from bedrock.services import oauth_service as oauth
from bedrock.services import user_service as us




# Phase 5.5 — this file exercises the real auth chain; opt out of the
# autouse test-mode bypass installed by api/tests/conftest.py.
@pytest.fixture(autouse=True)
def _use_real_auth_guards(real_auth_guards):
    yield
@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def _profile(email: str, sub: str | None = None, name: str = "Test G User") -> dict:
    return {
        "sub": sub or f"sub-{uuid.uuid4().hex[:12]}",
        "email": email,
        "name": name,
        "picture": "https://example.com/av.png",
    }


def _tokens(access: str = "ya29.dummy", refresh: str | None = "rt-dummy") -> dict:
    return {"access_token": access, "refresh_token": refresh, "expires_at": 1_999_999_999}


# ── Service-level tests ─────────────────────────────────────────────────────
def test_link_or_create_new_user_creates_and_links():
    email = f"g-new-{uuid.uuid4().hex[:8]}@test.example.com"
    prof = _profile(email)
    result = oauth.link_or_create_user(prof, _tokens())
    assert result.created is True
    assert result.linked is True
    assert result.user.email == email
    assert result.user.is_verified is True
    assert "member" in us.get_user_roles(result.user.user_id)


def test_link_or_create_existing_email_links_only():
    email = f"g-existing-{uuid.uuid4().hex[:8]}@test.example.com"
    existing = us.create_user(email=email, password="pw-strong-123")
    prof = _profile(email)
    result = oauth.link_or_create_user(prof, _tokens())
    assert result.created is False
    assert result.linked is True
    assert result.user.user_id == existing.user_id


def test_link_or_create_existing_oauth_link_returns_same_user_no_new_row():
    email = f"g-repeat-{uuid.uuid4().hex[:8]}@test.example.com"
    sub = f"sub-{uuid.uuid4().hex[:12]}"
    prof = _profile(email, sub=sub)
    first = oauth.link_or_create_user(prof, _tokens())
    second = oauth.link_or_create_user(prof, _tokens(access="ya29.refreshed"))
    assert second.created is False
    assert second.linked is False
    assert second.user.user_id == first.user.user_id


def test_link_or_create_rejects_missing_email():
    prof = {"sub": "abc", "email": ""}
    with pytest.raises(ValueError):
        oauth.link_or_create_user(prof, _tokens())


# ── Endpoint tests ──────────────────────────────────────────────────────────
def test_authorize_endpoint_returns_url(client, monkeypatch):
    async def fake_url(state=None):
        return f"https://accounts.google.com/o/oauth2/v2/auth?state={state or ''}"

    monkeypatch.setattr(oauth, "build_authorize_url", fake_url)
    r = client.get("/api/v1/auth/google/authorize", params={"state": "xyz"})
    assert r.status_code == 200
    assert "accounts.google.com" in r.json()["authorization_url"]


def test_authorize_endpoint_503_when_not_configured(client, monkeypatch):
    async def unconfigured(state=None):
        raise RuntimeError("Google OAuth is not configured")

    monkeypatch.setattr(oauth, "build_authorize_url", unconfigured)
    r = client.get("/api/v1/auth/google/authorize")
    assert r.status_code == 503


def test_callback_creates_user_and_returns_jwt(client, monkeypatch):
    email = f"g-cb-{uuid.uuid4().hex[:8]}@test.example.com"

    async def fake_exchange(code):
        return _tokens()

    async def fake_profile(access_token):
        return _profile(email)

    monkeypatch.setattr(oauth, "exchange_code", fake_exchange)
    monkeypatch.setattr(oauth, "fetch_google_profile", fake_profile)

    r = client.post("/api/v1/auth/google/callback", json={"code": "test-auth-code"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["email"] == email
    assert body["user"]["is_verified"] is True


def test_callback_code_exchange_failure_returns_400(client, monkeypatch):
    async def fake_exchange(code):
        raise ValueError("bad code")

    monkeypatch.setattr(oauth, "exchange_code", fake_exchange)
    r = client.post("/api/v1/auth/google/callback", json={"code": "bogus"})
    assert r.status_code == 400
