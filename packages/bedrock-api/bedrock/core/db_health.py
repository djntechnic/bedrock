"""
Module:  db_health.py
Layer:   api/core
Desc:    Boot-time health check for the SQLite database. Guards against two
         silent-failure modes:

           1. Corruption — `PRAGMA integrity_check` is the authoritative
              signal that the on-disk pages are internally consistent.
           2. Silent rebuild — a missing or freshly recreated DB file passes
              migrations cleanly but leaves canonical tables empty. In prod
              this means the app boots against an empty dataset and every
              user-visible page renders as a stub.

         Both conditions raise `DatabaseHealthError` from `lifespan()` so
         the app fails fast rather than serving misleading responses.

         Set `MLBTRACKER_ALLOW_EMPTY_DB=1` to downgrade the row-count guard
         to a warning — required for CI seed-fixture runs and fresh dev
         checkouts before the first data import.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass

from bedrock.core.database import db

logger = logging.getLogger(__name__)

# Tables whose emptiness signals a wiped/empty DB rather than a fresh feature.
# Which tables those are is application knowledge — MLBTracker's are bulk
# imported (players) or migration-seeded (teams, mlb_seasons) — so the app
# registers them at startup instead of this module naming them.
#
# An empty registry means "no row-count expectations", which degrades this
# check to integrity-only rather than failing. That is the correct behaviour
# for a brand-new application that has no canonical dataset yet.
_canonical_tables: tuple[str, ...] = ()


def register_canonical_tables(*tables: str) -> None:
    """Declare the tables whose emptiness indicates a wiped database.

    :param tables: Physical table names, ideally via the schema catalog.
    """
    global _canonical_tables
    _canonical_tables = tuple(tables)


def registered_canonical_tables() -> tuple[str, ...]:
    """:returns: The tables currently declared canonical."""
    return _canonical_tables


def __clear_canonical_tables() -> None:
    """Test helper: drops the registration. Not used by application code."""
    global _canonical_tables
    _canonical_tables = ()


class DatabaseHealthError(RuntimeError):
    """Raised on `PRAGMA integrity_check` failure or empty canonical tables."""


@dataclass(frozen=True)
class DatabaseHealthReport:
    integrity_ok: bool
    integrity_detail: str
    empty_tables: tuple[str, ...]


def _integrity_check() -> tuple[bool, str]:
    with db.get_connection() as conn:
        rows = conn.execute("PRAGMA integrity_check").fetchall()
    if not rows:
        return False, "PRAGMA integrity_check returned no rows"
    first = rows[0][0] if isinstance(rows[0], tuple) else rows[0]["integrity_check"]
    ok = str(first).lower() == "ok"
    detail = "ok" if ok else "; ".join(str(r[0] if isinstance(r, tuple) else r["integrity_check"]) for r in rows[:5])
    return ok, detail


def _row_counts() -> dict[str, int]:
    counts: dict[str, int] = {}
    for table in _canonical_tables:
        df = db.query(f'SELECT COUNT(*) AS c FROM "{table}"')
        counts[table] = int(df.iloc[0]["c"]) if df is not None and not df.empty else 0
    return counts


def check_database_health() -> DatabaseHealthReport:
    integrity_ok, integrity_detail = _integrity_check()
    counts = _row_counts()
    empties = tuple(t for t, n in counts.items() if n == 0)
    return DatabaseHealthReport(
        integrity_ok=integrity_ok,
        integrity_detail=integrity_detail,
        empty_tables=empties,
    )


def assert_database_healthy() -> DatabaseHealthReport:
    """Fail-fast wrapper. Called from `lifespan()` after migrations run.

    Raises `DatabaseHealthError` when:
      - `PRAGMA integrity_check` does not return `ok`; OR
      - any table the application registered as canonical is empty AND
        `MLBTRACKER_ALLOW_EMPTY_DB` is not truthy.

    Otherwise returns the report and logs a summary.
    """
    report = check_database_health()

    if not report.integrity_ok:
        raise DatabaseHealthError(
            f"SQLite integrity check FAILED: {report.integrity_detail}. "
            "Restore from the most recent known-good backup before continuing."
        )

    if report.empty_tables:
        allow_empty = os.environ.get("MLBTRACKER_ALLOW_EMPTY_DB", "").lower() in ("1", "true", "yes")
        if not allow_empty:
            raise DatabaseHealthError(
                f"Canonical tables empty: {list(report.empty_tables)}. "
                "The database appears to have been rebuilt without a data restore. "
                "Restore from a backup or set MLBTRACKER_ALLOW_EMPTY_DB=1 to boot anyway."
            )
        logger.warning(
            "canonical tables empty (%s) — allowed via MLBTRACKER_ALLOW_EMPTY_DB.",
            list(report.empty_tables),
        )

    logger.info("database health OK (integrity=ok, canonical tables populated).")
    return report
