"""
Module:  test_oauth_service.py
Layer:   bedrock-api/tests
Desc:    Coverage for the corners of oauth_service.py that test_oauth.py does
         not reach: config resolution (§S004 — env before db.get_config
         before a hard failure), the "not configured" error paths, the
         Google userinfo fetch, and the avatar-on-first-login branch of
         `link_or_create_user`.
"""
from __future__ import annotations

import uuid

import httpx
import pytest

from bedrock.core import database
from bedrock.core.database import db
from bedrock.services import oauth_service as oauth
from bedrock.services import user_service as us


@pytest.fixture(autouse=True)
def clean_config():
    yield
    db.execute(
        "DELETE FROM app_config_settings WHERE key IN "
        "('google_client_id', 'google_client_secret', 'google_redirect_uri')"
    )


def _profile(email: str, sub: str | None = None, name: str = "Test G User", picture: str | None = None) -> dict:
    return {
        "sub": sub if sub is not None else f"sub-{uuid.uuid4().hex[:12]}",
        "email": email,
        "name": name,
        "picture": picture,
    }


def _tokens(access: str = "ya29.dummy") -> dict:
    return {"access_token": access, "refresh_token": "rt-dummy", "expires_at": 1_999_999_999}


# ── _cfg (§S004: env, then db, then default) ────────────────────────────────

def test_cfg_prefers_env_over_db(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "from-env")
    monkeypatch.setattr(
        database.db, "get_config",
        lambda key, default=None: "from-db" if key == "google_client_id" else default,
    )
    assert oauth._cfg("google_client_id") == "from-env"


def test_cfg_falls_back_to_db_when_env_absent(monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.setattr(
        database.db, "get_config",
        lambda key, default=None: "from-db" if key == "google_client_id" else default,
    )
    assert oauth._cfg("google_client_id") == "from-db"


def test_cfg_returns_default_when_neither_set(monkeypatch):
    monkeypatch.delenv("SOME_UNSET_OAUTH_KEY", raising=False)
    monkeypatch.setattr(database.db, "get_config", lambda key, default=None: default)
    assert oauth._cfg("some_unset_oauth_key", "fallback") == "fallback"


# ── _google_client / _redirect_uri error paths ──────────────────────────────

def test_google_client_raises_when_unconfigured(monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("GOOGLE_CLIENT_SECRET", raising=False)
    monkeypatch.setattr(database.db, "get_config", lambda key, default=None: default)
    with pytest.raises(RuntimeError, match="not configured"):
        oauth._google_client()


def test_google_client_builds_when_configured(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client-123")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "secret-456")
    client = oauth._google_client()
    assert client.client_id == "client-123"
    assert client.client_secret == "secret-456"


def test_redirect_uri_raises_when_unconfigured(monkeypatch):
    monkeypatch.delenv("GOOGLE_REDIRECT_URI", raising=False)
    monkeypatch.setattr(database.db, "get_config", lambda key, default=None: default)
    with pytest.raises(RuntimeError, match="google_redirect_uri"):
        oauth._redirect_uri()


def test_redirect_uri_returns_the_configured_value(monkeypatch):
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", "https://app.example.com/callback")
    assert oauth._redirect_uri() == "https://app.example.com/callback"


# ── build_authorize_url / exchange_code delegate to the client ─────────────

class _FakeClient:
    def __init__(self):
        self.authorize_calls = []
        self.token_calls = []

    async def get_authorization_url(self, redirect_uri, state=None):
        self.authorize_calls.append((redirect_uri, state))
        return f"https://accounts.google.com/auth?redirect={redirect_uri}&state={state}"

    async def get_access_token(self, code, redirect_uri):
        self.token_calls.append((code, redirect_uri))
        return {"access_token": "tok", "refresh_token": "rt"}


@pytest.mark.asyncio
async def test_build_authorize_url_delegates_to_the_client(monkeypatch):
    fake = _FakeClient()
    monkeypatch.setattr(oauth, "_google_client", lambda: fake)
    monkeypatch.setattr(oauth, "_redirect_uri", lambda: "https://app.example.com/cb")
    url = await oauth.build_authorize_url(state="xyz")
    assert "state=xyz" in url
    assert fake.authorize_calls == [("https://app.example.com/cb", "xyz")]


@pytest.mark.asyncio
async def test_exchange_code_delegates_to_the_client(monkeypatch):
    fake = _FakeClient()
    monkeypatch.setattr(oauth, "_google_client", lambda: fake)
    monkeypatch.setattr(oauth, "_redirect_uri", lambda: "https://app.example.com/cb")
    tokens = await oauth.exchange_code("auth-code-1")
    assert tokens["access_token"] == "tok"
    assert fake.token_calls == [("auth-code-1", "https://app.example.com/cb")]


# ── fetch_google_profile ─────────────────────────────────────────────────────

class _FakeResponse:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            request = httpx.Request("GET", oauth.GOOGLE_USERINFO_URL)
            raise httpx.HTTPStatusError("boom", request=request, response=httpx.Response(self.status_code, request=request))

    def json(self):
        return self._payload


class _FakeAsyncClient:
    def __init__(self, payload, status=200, **_kwargs):
        self._payload = payload
        self._status = status

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url, headers=None):
        self.requested_url = url
        self.requested_headers = headers
        return _FakeResponse(self._payload, self._status)


@pytest.mark.asyncio
async def test_fetch_google_profile_returns_the_payload(monkeypatch):
    payload = {"sub": "123", "email": "person@example.com", "name": "Person"}
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: _FakeAsyncClient(payload, **kw))
    profile = await oauth.fetch_google_profile("access-token-abc")
    assert profile == payload


@pytest.mark.asyncio
async def test_fetch_google_profile_sends_the_bearer_token(monkeypatch):
    captured = {}

    class Capturing(_FakeAsyncClient):
        async def get(self, url, headers=None):
            captured["headers"] = headers
            return await super().get(url, headers=headers)

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: Capturing({"sub": "1", "email": "a@b.com"}, **kw))
    await oauth.fetch_google_profile("my-token")
    assert captured["headers"] == {"Authorization": "Bearer my-token"}


@pytest.mark.asyncio
async def test_fetch_google_profile_raises_on_http_error(monkeypatch):
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: _FakeAsyncClient({}, status=401, **kw))
    with pytest.raises(httpx.HTTPStatusError):
        await oauth.fetch_google_profile("bad-token")


# ── link_or_create_user: the avatar-on-first-login branch ──────────────────

def test_new_user_gets_the_profile_avatar():
    email = f"g-avatar-{uuid.uuid4().hex[:8]}@test.example.com"
    prof = _profile(email, picture="https://example.com/av.png")
    result = oauth.link_or_create_user(prof, _tokens())
    assert result.created is True
    assert result.user.avatar_url == "https://example.com/av.png"


def test_new_user_with_no_picture_has_no_avatar():
    email = f"g-noavatar-{uuid.uuid4().hex[:8]}@test.example.com"
    prof = _profile(email, picture=None)
    result = oauth.link_or_create_user(prof, _tokens())
    assert result.user.avatar_url is None


def test_link_or_create_rejects_missing_account_id():
    prof = {"sub": "", "email": f"g-{uuid.uuid4().hex[:8]}@test.example.com"}
    with pytest.raises(ValueError):
        oauth.link_or_create_user(prof, _tokens())
