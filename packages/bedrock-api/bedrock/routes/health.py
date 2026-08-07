"""
Module:  health.py
Layer:   api/routes
Desc:    Infrastructure health checks.

         Three endpoints, and the distinction matters as soon as something
         automated is watching:

         * ``GET /health``       — the rich diagnostic. Always 200, because it
           is a *report*: the caller reads the body to see what is wrong. This
           is what the admin Health page renders.
         * ``GET /health/live``  — the process is running. No dependency
           checks, no database, no allocation worth speaking of.
         * ``GET /health/ready`` — the process can serve traffic, and **503
           when it cannot**. This is the one a container healthcheck, a load
           balancer, or a deploy gate must use.

         The split exists because /health answering 200 with
         ``db_reachable: false`` is right for a dashboard and useless to an
         orchestrator: a healthcheck pointed at it reports healthy while every
         request 500s, so nothing restarts and a rolling deploy promotes a
         broken container over a working one.
"""
import os
import time
import tempfile

from fastapi import APIRouter, Response, status
from bedrock.core.database import db
from bedrock.core.config import config
from bedrock.core.health_metrics import (
    collect_health_counters,
    registered_counter_names,
)
from bedrock.schemas.base import ApiResponse

router = APIRouter()


def _get_version() -> str:
    try:
        val = db.get_config("system_app_version", "")
        if val:
            return str(val)
    except Exception:
        pass
    try:
        import subprocess
        tag = subprocess.check_output(
            ["git", "describe", "--tags", "--abbrev=0"],
            stderr=subprocess.DEVNULL,
            timeout=2,
        ).decode().strip()
        if tag:
            return tag
    except Exception:
        pass
    return "unknown"


@router.get("/health", response_model=ApiResponse[dict])
def health_check():
    """
    Liveness and readiness check.

    Returns structured health data including:
    - API reachability (implicit — this endpoint returning means OK)
    - Database read + write latency
    - Filesystem writability
    - Key data counts (players, inventory cards, pending imports)
    - Application version
    """
    # ── Database read ──────────────────────────────────────────────────────────
    db_read_ok = False
    db_read_ms: float | None = None
    try:
        t0 = time.monotonic()
        result = db.query("SELECT 1 AS ok")
        db_read_ms = round((time.monotonic() - t0) * 1000, 1)
        db_read_ok = bool(result is not None and len(result) > 0)
    except Exception:
        pass

    # ── Database write (temp table round-trip) ─────────────────────────────────
    db_write_ok = False
    db_write_ms: float | None = None
    if db_read_ok:
        try:
            t0 = time.monotonic()
            db.execute(
                "CREATE TEMP TABLE IF NOT EXISTS _health_ping (ts INTEGER)"
            )
            db.execute("INSERT INTO _health_ping VALUES (:ts)", {"ts": int(time.time())})
            db.execute("DELETE FROM _health_ping")
            db_write_ms = round((time.monotonic() - t0) * 1000, 1)
            db_write_ok = True
        except Exception:
            pass

    # ── Storage writability ────────────────────────────────────────────────────
    storage_ok = False
    storage_detail: str | None = None
    db_path = getattr(config, "SQLITE_DB_PATH", "")
    storage_dir = os.path.dirname(db_path) if db_path else ""
    try:
        if storage_dir and os.path.isdir(storage_dir):
            with tempfile.NamedTemporaryFile(dir=storage_dir, delete=True):
                pass
            storage_ok = True
        else:
            storage_detail = "directory not found"
    except Exception as exc:
        storage_detail = str(exc)

    # ── Application data counts ────────────────────────────────────────────────
    # Which counts appear here is application knowledge, not platform
    # knowledge: MLBTracker registers players / collection_cards /
    # pending_imports at startup (api/domain/health_counters.py). Each is
    # invoked defensively inside collect_health_counters(), so a broken count
    # reports null instead of failing the health check — same contract as the
    # per-count try/except blocks this replaced, but now logged rather than
    # silently swallowed.
    counters = collect_health_counters() if db_read_ok else {
        name: None for name in registered_counter_names()
    }

    return ApiResponse(
        status="ok",
        data={
            "version": _get_version(),
            # infrastructure
            "db_reachable": db_read_ok,
            "db_writable": db_write_ok,
            "storage_ok": storage_ok,
            "storage_detail": storage_detail,
            # latency
            "db_read_ms": db_read_ms,
            "db_write_ms": db_write_ms,
            # data (application-registered counters)
            **counters,
        },
    )


@router.get("/health/live", response_model=ApiResponse[dict])
def liveness():
    """Is the process running?

    Deliberately does nothing. A liveness probe that touches the database
    conflates "the app is wedged" with "Postgres is restarting", and an
    orchestrator acting on the second by killing the app makes an outage
    longer rather than shorter.
    """
    return ApiResponse(status="ok", data={"alive": True})


@router.get("/health/ready", response_model=ApiResponse[dict])
def readiness(response: Response):
    """Can the process serve traffic? **503 when it cannot.**

    Checks the database round-trip only. Not the mail relay, not the storage
    backend, not any registered counter: readiness answers "should this
    container receive requests", and every one of those degrades to a logged
    no-op by design. Failing readiness because SMTP is down would take a
    perfectly serviceable site out of rotation.

    A write is included, not just a read. A Postgres replica promoted to
    read-only answers `SELECT 1` happily and fails every login, which is
    exactly the state a readiness probe exists to catch.
    """
    ok = False
    detail: str | None = None
    try:
        result = db.query("SELECT 1 AS ok")
        if not (result is not None and len(result) > 0):
            detail = "database read returned no rows"
        else:
            db.execute("CREATE TEMP TABLE IF NOT EXISTS _health_ping (ts INTEGER)")
            db.execute("INSERT INTO _health_ping VALUES (:ts)", {"ts": int(time.time())})
            db.execute("DELETE FROM _health_ping")
            ok = True
    except Exception as exc:  # noqa: BLE001 — any failure here means not ready.
        detail = str(exc)

    if not ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return ApiResponse(status="error", message=detail or "not ready",
                           data={"ready": False})

    return ApiResponse(status="ok", data={"ready": True})
