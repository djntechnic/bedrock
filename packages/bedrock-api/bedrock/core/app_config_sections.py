"""
Module:  app_config_sections.py
Layer:   api/core
Desc:    Extension point for the boot-time app-config payload
         (`GET /api/v1/config/app`).

         The frontend fetches one document on load rather than making five
         round trips. Two of its sections belong to the platform — the
         `app_config` key/value settings and the `ui_query_config` per-hook
         query tuning, both backed by platform tables. The rest are whatever
         the application needs at boot; MLBTracker adds the current season,
         the season list, and collection statuses.

         Applications register their sections at startup; the route merges
         everything into one response. Section order follows registration
         order, and the platform's own sections register last so an app can
         never accidentally shadow them.

         Unlike the health counters, a failing section is *not* swallowed: a
         missing config section means the frontend boots misconfigured, which
         is worse than a clear 500 at startup.
"""
from __future__ import annotations

from typing import Any, Callable

#: Registered section builders, in registration order.
_sections: dict[str, Callable[[], Any]] = {}


def register_app_config_section(name: str, build: Callable[[], Any]) -> None:
    """Register a section of the boot-time app-config payload.

    Re-registering a name overwrites, keeping repeated imports idempotent.

    :param name: Key the section appears under in the response.
    :param build: Zero-argument callable returning the section's value.
    """
    _sections[name] = build


def registered_section_names() -> tuple[str, ...]:
    """:returns: The registered section names, in registration order."""
    return tuple(_sections)


def build_app_config() -> dict[str, Any]:
    """Build the full app-config payload.

    Exceptions propagate deliberately — see the module docstring.

    :returns: Section name → value for every registered section.
    """
    return {name: build() for name, build in _sections.items()}


def __clear_app_config_sections() -> None:
    """Test helper: drops every registration. Not used by application code."""
    _sections.clear()
