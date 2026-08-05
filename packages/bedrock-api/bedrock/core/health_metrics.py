"""
Module:  health_metrics.py
Layer:   api/core
Desc:    Extension point for application-specific counters on the platform
         health endpoint.

         `GET /api/v1/health` reports infrastructure facts the platform owns
         (database reachable/writable, storage writable, read/write latency)
         plus a handful of "is there actually data in here" counts. Those
         counts are pure application knowledge — MLBTracker reports visible
         players, collection rows and pending import staging rows — so the
         route must not reach for them directly.

         Applications register their counters at startup; the health route
         calls `collect_health_counters()` and merges the result into its
         payload.

         Each counter is invoked defensively: a raising or missing counter
         reports `None` rather than failing the health check, which preserves
         the behaviour of the per-count `try/except` blocks this replaced.
         A health endpoint that 500s because one optional count broke is
         worse than one that reports a null.
"""
from __future__ import annotations

from typing import Callable

from loguru import logger

#: Registered counters, in registration order (dicts preserve insertion order,
#: so the health payload's key order is stable across restarts).
_counters: dict[str, Callable[[], int]] = {}


def register_health_counter(name: str, fn: Callable[[], int]) -> None:
    """Register an application counter surfaced on the health endpoint.

    Re-registering a name overwrites, which keeps repeated imports (tests,
    reloads) idempotent.

    :param name: Key the count appears under in the health payload.
    :param fn: Zero-argument callable returning the count.
    """
    _counters[name] = fn


def registered_counter_names() -> tuple[str, ...]:
    """:returns: The registered counter names, in registration order."""
    return tuple(_counters)


def collect_health_counters() -> dict[str, int | None]:
    """Invoke every registered counter.

    :returns: Counter name → value, or ``None`` where the counter raised.
    """
    results: dict[str, int | None] = {}
    for name, fn in _counters.items():
        try:
            results[name] = fn()
        except Exception as exc:
            # Deliberately swallowed: an optional count must not take down the
            # health check. Logged (unlike the bare `except: pass` this
            # replaced) so a silently-null count is diagnosable.
            logger.warning(f"health counter {name!r} failed: {exc}")
            results[name] = None
    return results


def __clear_health_counters() -> None:
    """Test helper: drops every registration. Not used by application code."""
    _counters.clear()
