"""
Module:  test_auth_activity.py
Layer:   api/tests
Desc:    Phase 5.10 — verify events are recorded across the auth code
         paths and that /admin/security/events serves them.
"""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from bedrock.core.database import db
# The app comes from the package's own test harness (conftest.py): a bare
# FastAPI with only bedrock's routers mounted. There is no equivalent of
# MLBTracker's api.main here, and that is the point — these endpoints have
# to work in an application that registers nothing.
from conftest import build_app  # noqa: E402

app = build_app()
from bedrock.services import auth_activity_service as audit
from bedrock.services import module_service as ms
from bedrock.services import user_service as us




# Phase 5.5 — this file exercises the real auth chain; opt out of the
# autouse test-mode bypass installed by api/tests/conftest.py.
@pytest.fixture(autouse=True)
def _use_real_auth_guards(real_auth_guards):
    yield
@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def _events(**filters) -> list[dict]:
    return audit.query_events(**filters, limit=500)


def _mk_admin() -> tuple[us.UserRecord, str]:
    u = us.create_user(
        email=f"aa-admin-{uuid.uuid4().hex[:8]}@test.example.com",
        password="pw-strong-123",
        default_role="admin",
    )
    for other in ("collector", "viewer"):
        us.revoke_role(u.user_id, other)
    return u, us.create_access_token(u.user_id)


# ── Service-level ───────────────────────────────────────────────────────────
def test_record_persists_event():
    before = len(_events(event_type="login_failed"))
    audit.record("login_failed", detail={"attempted_email": "x@y.z"})
    after = len(_events(event_type="login_failed"))
    assert after == before + 1


def test_unknown_event_type_still_records():
    # Vocabulary drift shouldn't drop forensic data.
    audit.record("my_custom_event", detail={"a": 1})
    rows = _events(event_type="my_custom_event")
    assert len(rows) >= 1


# ── Endpoint wiring via real auth flows ─────────────────────────────────────
def test_register_and_login_emit_events(client):
    email = f"aa-reg-{uuid.uuid4().hex[:8]}@test.example.com"
    r = client.post("/api/v1/auth/register",
                    json={"email": email, "password": "pw-strong-123"})
    assert r.status_code == 201, r.text
    uid = r.json()["user"]["user_id"]
    got = {e["event_type"] for e in _events(user_id=uid)}
    assert "register" in got
    assert "login_success" not in got

    r2 = client.post("/api/v1/auth/login",
                     json={"email": email, "password": "pw-strong-123"})
    assert r2.status_code == 200
    got2 = {e["event_type"] for e in _events(user_id=uid)}
    assert "login_success" in got2


def test_failed_login_emits_login_failed_no_user_id(client):
    r = client.post("/api/v1/auth/login",
                    json={"email": "nope@test.example.com", "password": "wrongwrong"})
    assert r.status_code == 401
    events = _events(event_type="login_failed")
    assert any(
        (e.get("detail") or {}).get("attempted_email") == "nope@test.example.com"
        for e in events
    )


def test_module_override_write_records_event(client):
    admin, tok = _mk_admin()
    target = us.create_user(
        email=f"aa-tgt-{uuid.uuid4().hex[:8]}@test.example.com",
        password="pw-strong-123",
    )
    ms.set_user_module_override(target.user_id, "health", False,
                                actor_user_id=admin.user_id)
    events = [e for e in _events(user_id=admin.user_id)
              if e["event_type"] in {"module_granted", "module_revoked"}]
    assert any(
        e["target_user_id"] == target.user_id and (e["detail"] or {}).get("module") == "health"
        for e in events
    )


def test_admin_security_events_endpoint_lists_events(client):
    _admin, tok = _mk_admin()
    # Seed a distinctive event.
    audit.record("session_revoked", detail={"marker": "aa-endpoint-probe"})
    r = client.get(
        "/api/v1/admin/security/events",
        headers={"Authorization": f"Bearer {tok}"},
        params={"event_type": "session_revoked", "limit": 50},
    )
    assert r.status_code == 200, r.text
    body = r.json()["data"]
    assert any((e.get("detail") or {}).get("marker") == "aa-endpoint-probe"
               for e in body["events"])


def test_admin_security_events_requires_admin(client):
    viewer = us.create_user(
        email=f"aa-view-{uuid.uuid4().hex[:8]}@test.example.com",
        password="pw-strong-123",
        default_role="viewer",
    )
    us.revoke_role(viewer.user_id, "collector")
    tok = us.create_access_token(viewer.user_id)
    r = client.get(
        "/api/v1/admin/security/events",
        headers={"Authorization": f"Bearer {tok}"},
    )
    assert r.status_code == 403
    # Denied access should itself be logged.
    denials = _events(event_type="role_access_denied", user_id=viewer.user_id)
    assert any("/api/v1/admin/security/events" in (e.get("detail") or {}).get("path", "")
               for e in denials)


def test_query_events_filters_by_type_and_time():
    audit.record("login_failed", detail={"attempted_email": "filter-test@x.y"})
    rows = audit.query_events(event_type="login_failed", limit=10)
    assert rows
    assert all(r["event_type"] == "login_failed" for r in rows)
