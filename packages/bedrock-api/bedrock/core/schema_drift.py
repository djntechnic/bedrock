"""
Module:  schema_drift.py
Layer:   bedrock/core
Desc:    Boot-time consistency check between the live schema and the catalog
         of objects that are supposed to exist (see docs/standards/S7.md).

         That catalog is two halves. The platform's own objects come from
         `bedrock.core.schema_catalog`; the application's come from
         `register_schema_objects()`, called at boot from the app's generated
         catalog. Both halves are required — an app that registers nothing
         gets its every table reported as unexpected, which is drift detection
         inverted into noise.

         Posture: logs a WARNING on any drift and returns the diff. A future
         change flips `SchemaDriftError` from a warning to a raise once every
         consumer is fully catalog-driven.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

from bedrock.core.database import db
from bedrock.core.schema_catalog import ALL_OBJECTS

logger = logging.getLogger(__name__)

# ── Application-owned schema objects (framework boundary) ────────────────────
# The platform knows its own 25-odd tables and nothing about the application's.
# Registration is a module side-effect at boot, the same seam
# `db_health.register_canonical_tables` uses.
#
# Empty is a valid state, not an error: a brand-new application has no tables
# of its own yet, and the platform half is still worth checking.
_app_objects: frozenset[str] = frozenset()


def register_schema_objects(*names: str) -> None:
    """Declare the application's tables, views and indexes.

    :param names: Object names the app's schema catalog says should exist.
    """
    global _app_objects
    _app_objects = frozenset(names)


def registered_schema_objects() -> frozenset[str]:
    """:returns: The application objects currently registered."""
    return _app_objects


def expected_objects() -> frozenset[str]:
    """:returns: Every object that should exist — platform plus application."""
    return frozenset(ALL_OBJECTS) | _app_objects


def __clear_schema_objects() -> None:
    """Test hook: drop every registration."""
    global _app_objects
    _app_objects = frozenset()


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
    """Diff the live schema against the platform + application catalogs."""
    try:
        live = _fetch_live_names()
    except Exception as exc:
        logger.warning("schema-drift check skipped: %s", exc)
        return SchemaDriftReport()

    expected = set(expected_objects())
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
            "(regenerate the application's schema catalog)",
            len(report.extra),
            sorted(report.extra),
        )
    return report
