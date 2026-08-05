"""
Module:  diagnostics.py
Layer:   api/routes
Desc:    Live database diagnostic test suite. Provides endpoints to trigger
         test runs, retrieve results, and manage the daily schedule.
         Each test is atomic and records pass/fail/error + duration + retry
         metadata into diag_test_runs / diag_test_results tables.
"""
import time
import threading
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from bedrock.core.database import db
from bedrock.core.schema_catalog import Tables as T, Views as V
from bedrock.core.diagnostics_registry import registered_checks
from bedrock.schemas.base import ApiResponse
from bedrock.dependencies import require_role

router = APIRouter(dependencies=[require_role("admin")])
logger = logging.getLogger(__name__)

# ── Scheduler singleton ───────────────────────────────────────────────────────

_scheduler_thread: Optional[threading.Thread] = None
_scheduler_stop = threading.Event()


def _get_config(key: str, default: str = "") -> str:
    try:
        val = db.get_config(key, default)
        return str(val) if val is not None else default
    except Exception:
        return default


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _retention_days() -> int:
    try:
        return int(_get_config("diagnostics_retention_days", "60"))
    except (ValueError, TypeError):
        return 60


# ── Test definitions ──────────────────────────────────────────────────────────

class TestResult:
    def __init__(self, name: str, group: str):
        self.name = name
        self.group = group
        self.status = "passed"
        self.error_message: Optional[str] = None
        self.detail: Optional[str] = None
        self.duration_ms: int = 0
        self.attempt: int = 1


def _run_test(fn, name: str, group: str, max_retries: int = 1) -> TestResult:
    result = TestResult(name, group)
    for attempt in range(1, max_retries + 2):
        result.attempt = attempt
        t0 = time.monotonic()
        try:
            detail = fn()
            result.duration_ms = round((time.monotonic() - t0) * 1000)
            result.status = "passed"
            result.error_message = None
            result.detail = detail
            return result
        except Exception as exc:
            result.duration_ms = round((time.monotonic() - t0) * 1000)
            result.status = "failed"
            result.error_message = str(exc)
            if attempt <= max_retries:
                time.sleep(0.5)
    return result


def _all_tests() -> list[tuple[str, str, callable, int]]:
    """Return (name, group, fn, max_retries) tuples in execution order.

    The checks themselves are registered — the platform's in
    api/core/diagnostic_checks.py, MLBTracker's in
    api/domain/diagnostic_checks.py — so this runner holds no knowledge of
    what a healthy dataset looks like. See api/core/diagnostics_registry.py.
    """
    return [
        (c.name, c.group, c.fn, c.max_retries) for c in registered_checks()
    ]


# ── Run execution ─────────────────────────────────────────────────────────────

def _execute_run(triggered_by: str = "manual") -> int:
    """
    Run all diagnostic tests, persisting results to DB.
    Returns the new run_id.
    """
    started_at = _utcnow_iso()

    # Insert the run header (status=running)
    df = db.query(
        f"INSERT INTO {T.DIAG_TEST_RUNS} (triggered_by, status, started_at) "
        "VALUES (:by, 'running', :ts) RETURNING run_id",
        params={"by": triggered_by, "ts": started_at},
    )
    if df.empty:
        # SQLite <3.35 fallback: INSERT then SELECT last_insert_rowid
        db.execute(
            f"INSERT INTO {T.DIAG_TEST_RUNS} (triggered_by, status, started_at) "
            "VALUES (:by, 'running', :ts)",
            params={"by": triggered_by, "ts": started_at},
        )
        df = db.query("SELECT last_insert_rowid() AS run_id")

    run_id = int(df.iloc[0]["run_id"])

    tests = _all_tests()
    results: list[TestResult] = []

    for name, group, fn, max_retries in tests:
        r = _run_test(fn, name, group, max_retries)
        results.append(r)
        db.execute(
            f"INSERT INTO {T.DIAG_TEST_RESULTS} "
            "(run_id, test_name, test_group, status, duration_ms, message, error_detail, retries) "
            "VALUES (:run_id, :name, :group, :status, :dur, :msg, :err, :retries)",
            params={
                "run_id":  run_id,
                "name":    r.name,
                "group":   r.group,
                "status":  r.status,
                "dur":     r.duration_ms,
                "msg":     r.detail,
                "err":     r.error_message,
                "retries": r.attempt - 1,
            },
        )

    total     = len(results)
    passed    = sum(1 for r in results if r.status == "passed")
    failed    = total - passed
    run_status = "passed" if failed == 0 else "failed"
    finished_at = _utcnow_iso()

    # Parse ISO timestamps manually to compute duration
    try:
        t_start = datetime.fromisoformat(started_at)
        t_end   = datetime.fromisoformat(finished_at)
        duration_ms = int((t_end - t_start).total_seconds() * 1000)
    except Exception:
        duration_ms = sum(r.duration_ms for r in results)

    db.execute(
        f"UPDATE {T.DIAG_TEST_RUNS} "
        "SET status=:status, finished_at=:finished, duration_ms=:dur, "
        "    total=:total, passed=:passed, failed=:failed "
        "WHERE run_id=:run_id",
        params={
            "run_id":   run_id,
            "status":   run_status,
            "finished": finished_at,
            "dur":      duration_ms,
            "total":    total,
            "passed":   passed,
            "failed":   failed,
        },
    )

    # Purge old runs beyond retention window
    try:
        days = _retention_days()
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat(timespec="seconds")
        db.execute(
            f"DELETE FROM {T.DIAG_TEST_RESULTS} WHERE run_id IN ("
            f"  SELECT run_id FROM {T.DIAG_TEST_RUNS} WHERE started_at < :cutoff"
            ")",
            params={"cutoff": cutoff},
        )
        db.execute(
            f"DELETE FROM {T.DIAG_TEST_RUNS} WHERE started_at < :cutoff",
            params={"cutoff": cutoff},
        )
    except Exception as exc:
        logger.warning("Diagnostic retention purge failed: %s", exc)

    logger.info(
        "Diagnostic run %d complete: %d/%d passed in %dms",
        run_id, passed, total, duration_ms,
    )
    return run_id


# ── Scheduler ─────────────────────────────────────────────────────────────────

def _scheduler_loop():
    """Background thread: fire a daily run at the configured time."""
    last_run_date: Optional[str] = None
    while not _scheduler_stop.is_set():
        try:
            enabled = _get_config("diagnostics_schedule_enabled", "false").lower()
            if enabled in ("1", "true", "yes"):
                sched_time = _get_config("diagnostics_schedule_time", "02:00")
                now = datetime.now()
                today = now.strftime("%Y-%m-%d")
                hhmm = now.strftime("%H:%M")
                if hhmm == sched_time and today != last_run_date:
                    last_run_date = today
                    logger.info("Scheduled diagnostic run triggered at %s", hhmm)
                    try:
                        _execute_run("scheduled")
                    except Exception as exc:
                        logger.error("Scheduled diagnostic run failed: %s", exc)
        except Exception as exc:
            logger.warning("Scheduler loop error: %s", exc)
        _scheduler_stop.wait(60)  # check every minute


def start_scheduler():
    global _scheduler_thread
    if _scheduler_thread is None or not _scheduler_thread.is_alive():
        _scheduler_stop.clear()
        _scheduler_thread = threading.Thread(
            target=_scheduler_loop, daemon=True, name="diag-scheduler"
        )
        _scheduler_thread.start()
        logger.info("Diagnostic scheduler started")


def stop_scheduler():
    _scheduler_stop.set()


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ScheduleConfig(BaseModel):
    enabled: bool
    schedule_time: str  # "HH:MM"
    retention_days: int


class ScheduleUpdate(BaseModel):
    enabled: Optional[bool] = None
    schedule_time: Optional[str] = None
    retention_days: Optional[int] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/run", response_model=ApiResponse[dict])
def trigger_run(background_tasks: BackgroundTasks):
    """Trigger a diagnostic test run in the background. Returns run_id immediately."""
    # Check if a run is already in progress
    try:
        running = db.query(
            f"SELECT run_id FROM {T.DIAG_TEST_RUNS} WHERE status='running' LIMIT 1"
        )
        if not running.empty:
            return ApiResponse(
                status="ok",
                data={"run_id": int(running.iloc[0]["run_id"]), "queued": False, "already_running": True},
            )
    except Exception:
        pass

    # Insert placeholder and return immediately; test execution happens in background
    started_at = _utcnow_iso()
    db.execute(
        f"INSERT INTO {T.DIAG_TEST_RUNS} (triggered_by, status, started_at) "
        "VALUES ('manual', 'running', :ts)",
        params={"ts": started_at},
    )
    df = db.query("SELECT last_insert_rowid() AS run_id")
    run_id = int(df.iloc[0]["run_id"])

    def _run_in_bg(rid: int):
        tests = _all_tests()
        results: list[TestResult] = []
        for name, group, fn, max_retries in tests:
            r = _run_test(fn, name, group, max_retries)
            results.append(r)
            try:
                db.execute(
                    f"INSERT INTO {T.DIAG_TEST_RESULTS} "
                    "(run_id, test_name, test_group, status, duration_ms, message, error_detail, retries) "
                    "VALUES (:run_id, :name, :group, :status, :dur, :msg, :err, :retries)",
                    params={
                        "run_id":  rid,
                        "name":    r.name,
                        "group":   r.group,
                        "status":  r.status,
                        "dur":     r.duration_ms,
                        "msg":     r.detail,
                        "err":     r.error_message,
                        "retries": r.attempt - 1,
                    },
                )
            except Exception as exc:
                logger.error("Failed to persist test result %s: %s", r.name, exc)

        total     = len(results)
        passed    = sum(1 for r in results if r.status == "passed")
        failed    = total - passed
        finished_at = _utcnow_iso()
        duration_ms = sum(r.duration_ms for r in results)

        db.execute(
            f"UPDATE {T.DIAG_TEST_RUNS} "
            "SET status=:status, finished_at=:finished, duration_ms=:dur, "
            "    total=:total, passed=:passed, failed=:failed "
            "WHERE run_id=:run_id",
            params={
                "run_id":   rid,
                "status":   "passed" if failed == 0 else "failed",
                "finished": finished_at,
                "dur":      duration_ms,
                "total":    total,
                "passed":   passed,
                "failed":   failed,
            },
        )

        # Purge old runs
        try:
            days = _retention_days()
            cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat(timespec="seconds")
            db.execute(
                f"DELETE FROM {T.DIAG_TEST_RESULTS} WHERE run_id IN ("
                f"  SELECT run_id FROM {T.DIAG_TEST_RUNS} WHERE started_at < :cutoff"
                ")",
                params={"cutoff": cutoff},
            )
            db.execute(
                f"DELETE FROM {T.DIAG_TEST_RUNS} WHERE started_at < :cutoff",
                params={"cutoff": cutoff},
            )
        except Exception as exc:
            logger.warning("Retention purge error: %s", exc)

    background_tasks.add_task(_run_in_bg, run_id)
    return ApiResponse(status="ok", data={"run_id": run_id, "queued": True, "already_running": False})


@router.get("/runs", response_model=ApiResponse[list])
def list_runs(limit: int = 30):
    """Return recent diagnostic runs (newest first), without per-test details."""
    try:
        df = db.query(
            "SELECT run_id, triggered_by, status, started_at, finished_at, "
            "       duration_ms, total, passed, failed "
            f"FROM {T.DIAG_TEST_RUNS} "
            "ORDER BY started_at DESC LIMIT :limit",
            params={"limit": limit},
        )
        rows = df.to_dict(orient="records") if not df.empty else []
        return ApiResponse(status="ok", data=rows)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/runs/{run_id}", response_model=ApiResponse[dict])
def get_run(run_id: int):
    """Return a single run with all test results.
    Path parameters: run_id (path).
    """
    try:
        run_df = db.query(
            "SELECT run_id, triggered_by, status, started_at, finished_at, "
            "       duration_ms, total, passed, failed "
            f"FROM {T.DIAG_TEST_RUNS} WHERE run_id=:rid",
            params={"rid": run_id},
        )
        if run_df.empty:
            raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

        results_df = db.query(
            "SELECT result_id, test_name, test_group, status, duration_ms, "
            "       message, error_detail, retries "
            f"FROM {T.DIAG_TEST_RESULTS} WHERE run_id=:rid ORDER BY result_id",
            params={"rid": run_id},
        )
        run = run_df.iloc[0].to_dict()
        run["results"] = results_df.to_dict(orient="records") if not results_df.empty else []
        return ApiResponse(status="ok", data=run)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/schedule", response_model=ApiResponse[ScheduleConfig])
def get_schedule():
    """Return the current diagnostic schedule configuration."""
    enabled = _get_config("diagnostics_schedule_enabled", "false").lower() in ("1", "true", "yes")
    schedule_time = _get_config("diagnostics_schedule_time", "02:00")
    retention_days = _retention_days()
    return ApiResponse(
        status="ok",
        data=ScheduleConfig(
            enabled=enabled,
            schedule_time=schedule_time,
            retention_days=retention_days,
        ),
    )


@router.patch("/schedule", response_model=ApiResponse[ScheduleConfig])
def update_schedule(body: ScheduleUpdate):
    """Update diagnostic schedule configuration.
    Request body: JSON payload with the fields to apply for this operation.
    """
    if body.enabled is not None:
        db.execute(
            f"INSERT INTO {T.APP_CONFIG_SETTINGS} (key, value, value_type, category) "
            "VALUES ('diagnostics_schedule_enabled', :v, 'bool', 'diagnostics') "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            params={"v": "true" if body.enabled else "false"},
        )
    if body.schedule_time is not None:
        db.execute(
            f"INSERT INTO {T.APP_CONFIG_SETTINGS} (key, value, value_type, category) "
            "VALUES ('diagnostics_schedule_time', :v, 'string', 'diagnostics') "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            params={"v": body.schedule_time},
        )
    if body.retention_days is not None:
        db.execute(
            f"INSERT INTO {T.APP_CONFIG_SETTINGS} (key, value, value_type, category) "
            "VALUES ('diagnostics_retention_days', :v, 'integer', 'diagnostics') "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            params={"v": str(body.retention_days)},
        )
    return get_schedule()
