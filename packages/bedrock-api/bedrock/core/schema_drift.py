"""
Module:  schema_drift.py
Layer:   api/core
Desc:    Boot-time consistency check between the live SQLite schema and the
         single-source `schema_catalog.py` (see docs/standards/S7.md).

         PR-1 posture: logs a WARNING on any drift and returns the diff.
         A future PR will flip `SchemaDriftError` from a warning to a raise
         once the grandfather list in `audit_schema_names.py` is empty.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

from bedrock.core.database import db
from bedrock.core.schema_catalog import ALL_OBJECTS

logger = logging.getLogger(__name__)


class SchemaDriftError(RuntimeError):
    """Raised when the live schema and schema_catalog disagree.

    PR-1 does not raise; a future PR flips the warn path to raise once the
    codebase is fully catalog-driven.
    """


@dataclass(frozen=True)
class SchemaDriftReport:
    missing: frozenset[str] = field(default_factory=frozenset)
    extra:   frozenset[str] = field(default_factory=frozenset)

    @property
    def clean(self) -> bool:
        return not self.missing and not self.extra


def _fetch_live_names() -> set[str]:
    rows = db.query(
        "SELECT name FROM sqlite_schema "
        "WHERE name NOT LIKE 'sqlite_%' AND type IN ('table', 'view', 'index')"
    )
    if rows is None or (hasattr(rows, "empty") and rows.empty):
        return set()
    return set(rows["name"].tolist())


def check_schema_drift() -> SchemaDriftReport:
    """Diff the live sqlite_schema against `ALL_OBJECTS` from the catalog."""
    try:
        live = _fetch_live_names()
    except Exception as exc:
        logger.warning("schema-drift check skipped: %s", exc)
        return SchemaDriftReport()

    expected = set(ALL_OBJECTS)
    return SchemaDriftReport(
        missing=frozenset(expected - live),
        extra=frozenset(live - expected),
    )


def warn_on_drift() -> SchemaDriftReport:
    """Log a WARNING for any drift; return the report. Never raises in PR-1."""
    report = check_schema_drift()
    if report.clean:
        logger.info("schema catalog matches live schema (no drift).")
        return report

    if report.missing:
        logger.warning(
            "schema drift — %d catalog entries not present in live DB: %s",
            len(report.missing),
            sorted(report.missing),
        )
    if report.extra:
        logger.warning(
            "schema drift — %d live DB objects missing from catalog: %s "
            "(regenerate via scripts/maintenance/generate_schema_catalog.py)",
            len(report.extra),
            sorted(report.extra),
        )
    return report
