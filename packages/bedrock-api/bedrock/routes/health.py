"""
Module:  health.py
Layer:   api/routes
Desc:    Infrastructure health checks. Verifies API liveness, database
         read/write, filesystem writability, and key data counts.
"""
import os
import time
import tempfile

from fastapi import APIRouter
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
