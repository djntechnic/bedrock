"""
Module:  test_security_event_vocabulary.py
Layer:   api/tests
Desc:    #40 — `<SecurityLogViewer>` ships its own curated event-type list,
         `PLATFORM_EVENT_TYPES`, alongside `useSecurityEvents`. This pins it
         against drift from the canonical vocabulary in
         `auth_activity_service.EVENT_TYPES`: every name the component offers
         has to be a real event the backend can write.

         The regex below is the entire test. A regex that matched nothing
         would make the "every entry is a member" assertion pass vacuously,
         so the length floor is what actually catches a parse failure.
"""
from __future__ import annotations

import re
from pathlib import Path

from bedrock.services.auth_activity_service import EVENT_TYPES

_COMPONENT_PATH = (
    Path(__file__).parent.parent.parent
    / "bedrock-ui"
    / "src"
    / "components"
    / "admin"
    / "SecurityLogViewer.tsx"
)


def _parse_platform_event_types() -> list[str]:
    source = _COMPONENT_PATH.read_text(encoding="utf-8")
    match = re.search(
        r"export const PLATFORM_EVENT_TYPES[^=]*=\s*\[(.*?)\]",
        source,
        re.DOTALL,
    )
    assert match is not None, (
        "Could not find `export const PLATFORM_EVENT_TYPES = [...]` in "
        f"{_COMPONENT_PATH}"
    )
    body = match.group(1)
    return re.findall(r'"([^"]+)"', body)


def test_platform_event_types_are_all_real_auth_events() -> None:
    platform_event_types = _parse_platform_event_types()

    # A regex that matched nothing (component renamed, moved, or the array
    # syntax changed) would leave this list empty, and an empty list makes
    # "every entry is a member of EVENT_TYPES" vacuously true. Assert a floor
    # well above zero so a parse failure fails loudly instead of passing.
    assert len(platform_event_types) >= 20, (
        f"Parsed only {len(platform_event_types)} event types from "
        f"{_COMPONENT_PATH} — the parser likely broke, not the vocabulary."
    )

    unknown = set(platform_event_types) - EVENT_TYPES
    assert not unknown, (
        f"SecurityLogViewer.PLATFORM_EVENT_TYPES contains names bedrock's own "
        f"auth code never writes: {sorted(unknown)}. App-specific event types "
        "belong in the component's `eventTypes` prop, not in this list."
    )
