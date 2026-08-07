"""
Module:  test_health_probes.py
Layer:   bedrock-api/tests
Desc:    The liveness and readiness endpoints, and the healthcheck probe that
         calls them (plan F2).

         The load-bearing test in here is the one asserting readiness returns
         **503** when the database is gone. That is the entire reason the
         endpoint exists: `/health` answers 200 in that state, so a container
         healthcheck wired to it marks a broken app healthy, nothing restarts,
         and a rolling deploy promotes it over a working container.
"""
from __future__ import annotations

import json
import sys
import urllib.error
from io import BytesIO

import pytest

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from conftest import build_app  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

from bedrock.core.database import db  # noqa: E402
from bedrock.tools import healthcheck  # noqa: E402

client = TestClient(build_app())


# ── Liveness ─────────────────────────────────────────────────────────────────

def test_liveness_is_200(platform_db):
    resp = client.get("/api/v1/health/live")
    assert resp.status_code == 200
    assert resp.json()["data"]["alive"] is True


def test_liveness_does_not_touch_the_database(platform_db, monkeypatch):
    """A liveness probe that queries the database conflates 'the app is wedged'
    with 'Postgres is restarting'. An orchestrator acting on the second by
    killing the app makes the outage longer."""
    def explode(*_args, **_kwargs):
        raise AssertionError("liveness must not query the database")

    monkeypatch.setattr(db, "query", explode)
    monkeypatch.setattr(db, "execute", explode)

    assert client.get("/api/v1/health/live").status_code == 200


# ── Readiness ────────────────────────────────────────────────────────────────

def test_readiness_is_200_against_a_working_database(platform_db):
    resp = client.get("/api/v1/health/ready")
    assert resp.status_code == 200
    assert resp.json()["data"]["ready"] is True


def test_readiness_is_503_when_the_database_is_unreachable(platform_db, monkeypatch):
    def unreachable(*_args, **_kwargs):
        raise ConnectionError("could not connect to server")

    monkeypatch.setattr(db, "query", unreachable)

    resp = client.get("/api/v1/health/ready")
    assert resp.status_code == 503
    assert resp.json()["data"]["ready"] is False


def test_readiness_names_the_failure(platform_db, monkeypatch):
    """`docker inspect` shows the healthcheck output and nothing else, so a
    bare 503 means an operator gets 'unhealthy' with no cause."""
    def unreachable(*_args, **_kwargs):
        raise ConnectionError("could not connect to server: port 5432")

    monkeypatch.setattr(db, "query", unreachable)

    body = client.get("/api/v1/health/ready").json()
    assert "5432" in (body.get("message") or "")


def test_readiness_is_503_when_the_database_is_read_only(platform_db, monkeypatch):
    """A replica promoted read-only answers SELECT 1 happily and fails every
    login. Checking only the read would call that container ready."""
    def read_only(*_args, **_kwargs):
        raise RuntimeError("cannot execute INSERT in a read-only transaction")

    monkeypatch.setattr(db, "execute", read_only)

    assert client.get("/api/v1/health/ready").status_code == 503


def test_readiness_is_503_when_the_read_returns_nothing(platform_db, monkeypatch):
    monkeypatch.setattr(db, "query", lambda *_a, **_k: [])

    resp = client.get("/api/v1/health/ready")
    assert resp.status_code == 503
    assert "no rows" in (resp.json().get("message") or "")


def test_the_diagnostic_endpoint_still_answers_200_when_the_database_is_down(
    platform_db, monkeypatch
):
    """The split, stated as a test. /health is a report: it must keep answering
    so the admin page can render *what* is broken."""
    def unreachable(*_args, **_kwargs):
        raise ConnectionError("could not connect to server")

    monkeypatch.setattr(db, "query", unreachable)

    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    assert resp.json()["data"]["db_reachable"] is False


# ── The probe binary ─────────────────────────────────────────────────────────

class _FakeResponse:
    def __init__(self, status: int, body: bytes):
        self.status = status
        self._body = BytesIO(body)

    def read(self, n: int = -1) -> bytes:
        return self._body.read(n)

    def __enter__(self):
        return self

    def __exit__(self, *_exc):
        return False


def test_probe_returns_zero_when_ready(monkeypatch):
    monkeypatch.setattr(
        healthcheck.urllib.request, "urlopen",
        lambda *_a, **_k: _FakeResponse(200, b'{"status":"ok"}'),
    )
    assert healthcheck.main(["--url", "http://x/ready"]) == 0


def test_probe_returns_one_on_503(monkeypatch, capsys):
    def raise_503(*_a, **_k):
        raise urllib.error.HTTPError(
            "http://x/ready", 503, "Service Unavailable", {},
            BytesIO(json.dumps({"message": "could not connect: port 5432"}).encode()),
        )

    monkeypatch.setattr(healthcheck.urllib.request, "urlopen", raise_503)

    assert healthcheck.main(["--url", "http://x/ready"]) == 1
    # The reason reaches the operator, not just the exit code.
    assert "5432" in capsys.readouterr().err


def test_probe_returns_one_when_nothing_is_listening(monkeypatch, capsys):
    """The state during a crash loop, and the one a healthcheck most needs to
    survive without raising."""
    def refused(*_a, **_k):
        raise ConnectionRefusedError("connection refused")

    monkeypatch.setattr(healthcheck.urllib.request, "urlopen", refused)

    assert healthcheck.main(["--url", "http://x/ready"]) == 1
    assert "ConnectionRefusedError" in capsys.readouterr().err


def test_probe_returns_one_on_an_unexpected_non_200(monkeypatch):
    monkeypatch.setattr(
        healthcheck.urllib.request, "urlopen",
        lambda *_a, **_k: _FakeResponse(204, b""),
    )
    assert healthcheck.main(["--url", "http://x/ready"]) == 1


@pytest.mark.parametrize("port,expected", [
    (None, "http://127.0.0.1:8000/api/v1/health/ready"),
    ("9001", "http://127.0.0.1:9001/api/v1/health/ready"),
])
def test_default_url_follows_PORT_and_stays_on_loopback(monkeypatch, port, expected):
    """Loopback rather than the published hostname: the probe runs inside the
    container, so depending on DNS or the ingress would report the app
    unhealthy when the load balancer is what broke."""
    monkeypatch.delenv("PORT", raising=False)
    if port is not None:
        monkeypatch.setenv("PORT", port)
    assert healthcheck.default_url() == expected
