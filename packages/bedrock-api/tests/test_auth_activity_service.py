"""
Module:  test_auth_activity_service.py
Layer:   bedrock-api/tests
Desc:    Unit coverage for bedrock.services.auth_activity_service that
         test_auth_activity.py (the endpoint-wiring suite) does not
         exercise: the IP/user-agent extraction helpers, query_events'
         filter combinations and bounds, malformed detail_json recovery,
         and the `database` dependency-injection seam.
"""
from __future__ import annotations

import os
import sqlite3
import tempfile

import pytest
from fastapi import Request

from bedrock.core.database import db, DatabaseManager
from bedrock.core.schema_catalog import Tables as T
from bedrock.services import auth_activity_service as audit
from bedrock.services import user_service as us


def _mk_user() -> "us.UserRecord":
    import uuid

    return us.create_user(
        email=f"aas-{uuid.uuid4().hex[:12]}@example.com",
        password="pw-strong-123",
        default_role="member",
    )


def _make_request(headers: dict[str, str] | None = None, client_host: str | None = "10.0.0.5"):
    raw_headers = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    scope = {
        "type": "http",
        "headers": raw_headers,
        "client": (client_host, 54321) if client_host else None,
        "method": "GET",
        "path": "/",
    }
    return Request(scope)


# ── _client_ip ───────────────────────────────────────────────────────────────
class TestClientIp:
    def test_none_request_is_none(self):
        assert audit._client_ip(None) is None

    def test_prefers_x_forwarded_for(self):
        req = _make_request(headers={"x-forwarded-for": "1.2.3.4, 5.6.7.8"}, client_host="9.9.9.9")
        assert audit._client_ip(req) == "1.2.3.4"

    def test_falls_back_to_client_host(self):
        req = _make_request(client_host="192.168.1.1")
        assert audit._client_ip(req) == "192.168.1.1"

    def test_no_client_no_header_is_none(self):
        req = _make_request(client_host=None)
        assert audit._client_ip(req) is None


# ── _user_agent ──────────────────────────────────────────────────────────────
class TestUserAgent:
    def test_none_request_is_none(self):
        assert audit._user_agent(None) is None

    def test_reads_header(self):
        req = _make_request(headers={"user-agent": "pytest-agent/1.0"})
        assert audit._user_agent(req) == "pytest-agent/1.0"

    def test_missing_header_is_none(self):
        req = _make_request()
        assert audit._user_agent(req) is None


# ── record ───────────────────────────────────────────────────────────────────
class TestRecord:
    def test_persists_request_metadata(self):
        req = _make_request(
            headers={"x-forwarded-for": "8.8.8.8", "user-agent": "record-test-ua"},
            client_host="1.1.1.1",
        )
        audit.record("login_success", request=req, detail={"marker": "record-meta"})
        rows = audit.query_events(event_type="login_success", limit=500)
        row = next(r for r in rows if (r.get("detail") or {}).get("marker") == "record-meta")
        assert row["actor_ip"] == "8.8.8.8"
        assert row["user_agent"] == "record-test-ua"

    def test_no_detail_is_none_on_read_back(self):
        audit.record("logout")
        rows = audit.query_events(event_type="logout", limit=500)
        assert any(r["detail"] is None for r in rows)

    def test_target_user_id_is_persisted(self):
        actor = _mk_user()
        target = _mk_user()
        audit.record(
            "role_revoked", user_id=actor.user_id, target_user_id=target.user_id,
            detail={"marker": "target-test"},
        )
        rows = audit.query_events(user_id=target.user_id, limit=500)
        row = next(r for r in rows if (r.get("detail") or {}).get("marker") == "target-test")
        assert row["user_id"] == actor.user_id
        assert row["target_user_id"] == target.user_id

    def test_uses_injected_database(self):
        """A caller-supplied `database` must be the one written to — not the
        module-level `db` singleton."""
        tmpdir = tempfile.mkdtemp(prefix="bedrock-audit-inject-")
        path = os.path.join(tmpdir, "inject.db")
        package_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        baseline = os.path.join(
            os.path.dirname(__file__), "..", "bedrock", "schema", "baseline.sql"
        )
        conn = sqlite3.connect(path)
        conn.executescript(open(baseline, encoding="utf-8").read())
        conn.commit()
        conn.close()

        other = DatabaseManager()
        other.sqlite_path = path
        other.is_postgres = False
        other.db_url = None

        try:
            audit.record("login_success", detail={"marker": "injected-db"}, database=other)
            rows_other = audit.query_events(event_type="login_success", database=other)
            assert any((r.get("detail") or {}).get("marker") == "injected-db" for r in rows_other)

            rows_default = audit.query_events(event_type="login_success", limit=500)
            assert not any((r.get("detail") or {}).get("marker") == "injected-db" for r in rows_default)
        finally:
            other.close_pool()
            for suffix in ("", "-wal", "-shm", "-journal"):
                p = path + suffix
                if os.path.exists(p):
                    try:
                        os.remove(p)
                    except OSError:
                        pass


# ── query_events ─────────────────────────────────────────────────────────────
class TestQueryEvents:
    def test_no_matches_returns_empty_list(self):
        assert audit.query_events(event_type="no-such-event-type-ever") == []

    def test_filters_by_user_id_matches_actor_or_target(self):
        u1, u2, u3 = _mk_user(), _mk_user(), _mk_user()
        audit.record("role_granted", user_id=u1.user_id, target_user_id=u2.user_id,
                     detail={"marker": "actor-probe"})
        audit.record("role_granted", user_id=u3.user_id, target_user_id=u1.user_id,
                     detail={"marker": "target-probe"})
        rows = audit.query_events(user_id=u1.user_id, limit=500)
        markers = {(r.get("detail") or {}).get("marker") for r in rows}
        assert "actor-probe" in markers
        assert "target-probe" in markers

    def test_since_and_until_bound_the_window(self):
        audit.record("session_revoked", detail={"marker": "time-window-probe"})
        far_future = "2999-01-01 00:00:00"
        far_past = "1900-01-01 00:00:00"
        rows_future_only = audit.query_events(event_type="session_revoked", since=far_future, limit=500)
        assert not any((r.get("detail") or {}).get("marker") == "time-window-probe" for r in rows_future_only)

        rows_past_only = audit.query_events(event_type="session_revoked", until=far_past, limit=500)
        assert not any((r.get("detail") or {}).get("marker") == "time-window-probe" for r in rows_past_only)

        rows_inclusive = audit.query_events(
            event_type="session_revoked", since=far_past, until=far_future, limit=500
        )
        assert any((r.get("detail") or {}).get("marker") == "time-window-probe" for r in rows_inclusive)

    def test_limit_is_clamped_to_500_max(self):
        rows = audit.query_events(limit=10_000)
        assert len(rows) <= 500

    def test_limit_has_a_floor_of_one(self):
        rows = audit.query_events(limit=0)
        assert len(rows) <= 1

    def test_negative_offset_is_floored_to_zero(self):
        # Should not raise, and should not skip rows relative to offset=0.
        base = audit.query_events(event_type="logout", limit=5, offset=0)
        negative = audit.query_events(event_type="logout", limit=5, offset=-5)
        assert base == negative

    def test_malformed_detail_json_is_surfaced_as_none(self):
        d = db
        d.execute(
            f"""
            INSERT INTO {T.AUTH_ACTIVITY_LOG} (event_type, detail_json)
            VALUES (%s, %s)
            """,
            ("logout", "{not valid json"),
        )
        rows = audit.query_events(event_type="logout", limit=500)
        assert any(r["detail"] is None and "detail_json" not in r for r in rows)

    def test_response_rows_never_carry_the_raw_detail_json_key(self):
        audit.record("logout", detail={"marker": "no-raw-key"})
        rows = audit.query_events(event_type="logout", limit=500)
        assert all("detail_json" not in r for r in rows)
