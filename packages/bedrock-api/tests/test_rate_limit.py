"""
Module:  test_rate_limit.py
Layer:   api/tests
Desc:    Phase 5.7 — verify /auth/login rate limiting kicks in and that
         the 429 handler emits an auth_activity_log rate_limit_tripped
         event.
"""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from bedrock.core.database import db
from bedrock.core.rate_limit import limiter
# The app comes from the package's own test harness (conftest.py): a bare
# FastAPI with only bedrock's routers mounted. There is no equivalent of
# MLBTracker's api.main here, and that is the point — these endpoints have
# to work in an application that registers nothing.
from conftest import build_app  # noqa: E402

app = build_app()
from bedrock.services import auth_activity_service as audit


@pytest.fixture(autouse=True)
def _use_real_auth_guards(real_auth_guards):
    yield


@pytest.fixture(autouse=True)
def _reset_limiter():
    """Rate-limit counters must not leak between tests."""
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture
def client():
    return TestClient(app)


def _bad_login_email() -> str:
    return f"rate-{uuid.uuid4().hex[:8]}@test.example.com"


def test_login_rate_limit_trips_after_configured_attempts(client, monkeypatch):
    # Shrink the /login limit to something we can hit in a couple of calls.
    db.set_config("rate_limit_login", "2/minute")
    try:
        email = _bad_login_email()
        # First two attempts pass through (401 because credentials are wrong).
        for _ in range(2):
            r = client.post("/api/v1/auth/login",
                            json={"email": email, "password": "nope-nope"})
            assert r.status_code == 401, r.text
        # Third attempt should trip the limiter.
        r = client.post("/api/v1/auth/login",
                        json={"email": email, "password": "nope-nope"})
        assert r.status_code == 429, r.text
        body = r.json()
        assert body["detail"]["code"] == "rate_limit_exceeded"

        # And the trip should be logged for the security tab.
        events = audit.query_events(event_type="rate_limit_tripped", limit=50)
        assert any("/api/v1/auth/login" in (e.get("detail") or {}).get("path", "")
                   for e in events)
    finally:
        db.set_config("rate_limit_login", "10/minute")
