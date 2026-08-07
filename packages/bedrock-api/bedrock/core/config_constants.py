"""Canonical constants for the app_config_settings key namespace.

This module is the single source of truth for:
  * The set of valid config categories.
  * The <category>_<name> snake_case key naming standard.
  * The set of valid value_type discriminators.

Both admin route validation (api/routes/admin.py, api/routes/config.py) and
the static audit script (scripts/maintenance/audit_config.py) import from
here so the rule set never drifts between runtime enforcement and CI checks.

── Framework / app split ────────────────────────────────────────────────────
The category list is composed, not hardcoded: `FRAMEWORK_CATEGORIES` covers
the categories the reusable platform owns (config, grids, logging, auth,
diagnostics), and each application contributes its own business categories
via `APP_CATEGORY_MODULE`. MLBTracker supplies `sync`, `qualifying`,
`inventory` and `rankings` from api/domain/config_categories.py.

Composition happens once at import time — there is no mutable registry and
therefore no import-ordering hazard for the many callers that do
`from bedrock.core.config_constants import CANONICAL_CATEGORIES`.

When this module moves into the shared platform package, only
`APP_CATEGORY_MODULE` needs to become configurable; everything else is
already app-agnostic.

Any change to the category set must be paired with a schema comment update
in api/core/schema_sqlite.sql (app_config_settings table).
"""

from __future__ import annotations

import importlib
import re
from typing import Final

#: Categories owned by the reusable application platform.
#:
#: `auth` and `mail` arrived with email delivery: token lifetimes are an auth
#: policy and the active mail backend plus its sender identity are mail
#: settings, and both need a category prefix to be legal keys at all. Adding a
#: framework category only widens the accepted set, so it cannot invalidate an
#: application's existing keys.
FRAMEWORK_CATEGORIES: Final[tuple[str, ...]] = (
    "system",
    "api",
    "auth",
    "display",
    "logging",
    "grid",
    "shortcuts",
    "diagnostics",
    "mail",
)

#: Dotted path to the app module exporting an `APP_CATEGORIES` tuple. The
#: import is optional: a deployment with no business categories of its own
#: (or the platform package under test in isolation) resolves to ().
APP_CATEGORY_MODULE: Final[str] = "bedrock_app.config_categories"


def _load_app_categories() -> tuple[str, ...]:
    """Return the host application's config categories, or () if none."""
    try:
        module = importlib.import_module(APP_CATEGORY_MODULE)
    except ModuleNotFoundError:
        return ()
    return tuple(getattr(module, "APP_CATEGORIES", ()))


#: Categories contributed by the host application (MLBTracker's baseball domain).
APP_CATEGORIES: Final[tuple[str, ...]] = _load_app_categories()

#: The full valid set — framework plus app. Callers should keep importing this.
CANONICAL_CATEGORIES: Final[tuple[str, ...]] = FRAMEWORK_CATEGORIES + APP_CATEGORIES

CANONICAL_VALUE_TYPES: Final[tuple[str, ...]] = (
    "string",
    "integer",
    "float",
    "boolean",
    "json",
)

KEY_PATTERN: Final[str] = (
    r"^(?:" + "|".join(CANONICAL_CATEGORIES) + r")_[a-z0-9][a-z0-9_]*$"
)

KEY_REGEX: Final[re.Pattern[str]] = re.compile(KEY_PATTERN)


def category_for_key(key: str) -> str | None:
    """Return the canonical category prefix of ``key`` or ``None`` if invalid."""
    for cat in CANONICAL_CATEGORIES:
        if key.startswith(cat + "_"):
            return cat
    return None


def is_valid_key(key: str) -> bool:
    return bool(KEY_REGEX.match(key))


def is_valid_category(category: str) -> bool:
    return category in CANONICAL_CATEGORIES


def is_valid_value_type(value_type: str) -> bool:
    return value_type in CANONICAL_VALUE_TYPES
