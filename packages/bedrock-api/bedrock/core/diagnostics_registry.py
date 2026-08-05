"""
Module:  diagnostics_registry.py
Layer:   api/core
Desc:    Extension point for the diagnostics runner.

         The runner owns the machinery — retry policy, timing, the run ledger,
         result persistence, the schedule and the API surface. It owns none of
         the checks: what constitutes a healthy dataset is application
         knowledge, and MLBTracker's checks assert things like "players exist"
         and "batting stats are populated" that mean nothing to another app.

         Both sides register through here. The platform contributes checks that
         touch only platform tables (database read/write, grid and config seeds,
         the import-run ledger); the application contributes the rest.

         `order` fixes execution and display sequence across both sets, so the
         interleaved ordering the runner had when the checks were one hardcoded
         list is preserved exactly. Ties break on registration order.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

#: A check returns a human-readable success detail, or raises to fail. Raising
#: `AssertionError` is the idiomatic failure; any exception is caught by the
#: runner and recorded as a failed result.
CheckFn = Callable[[], str]


@dataclass(frozen=True)
class DiagnosticCheck:
    """One registered diagnostic."""

    name: str
    group: str
    fn: CheckFn
    max_retries: int = 0
    order: int = 100
    #: Registration sequence, used only to break `order` ties deterministically.
    seq: int = field(default=0, compare=False)


_checks: dict[str, DiagnosticCheck] = {}
_seq = 0


def register_diagnostic_check(
    name: str,
    group: str,
    fn: CheckFn,
    *,
    max_retries: int = 0,
    order: int = 100,
) -> None:
    """Register a diagnostic check.

    Re-registering a name overwrites, keeping repeated imports idempotent.

    :param name: Display name, unique across all checks.
    :param group: Display grouping (e.g. "Database", "Config", "Schema").
    :param fn: Zero-argument callable returning a detail string, or raising.
    :param max_retries: Extra attempts before recording a failure.
    :param order: Sort key fixing execution and display order.
    """
    global _seq
    _seq += 1
    _checks[name] = DiagnosticCheck(
        name=name, group=group, fn=fn, max_retries=max_retries,
        order=order, seq=_seq,
    )


def registered_checks() -> list[DiagnosticCheck]:
    """:returns: Every registered check, in execution order."""
    return sorted(_checks.values(), key=lambda c: (c.order, c.seq))


def registered_check_names() -> tuple[str, ...]:
    """:returns: Check names in execution order."""
    return tuple(c.name for c in registered_checks())


def __clear_diagnostic_checks() -> None:
    """Test helper: drops every registration. Not used by application code."""
    _checks.clear()
