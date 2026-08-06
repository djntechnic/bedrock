"""
Module:  paths.py
Layer:   bedrock/core
Desc:    Where the consuming application lives on disk.

         This exists because the obvious answer is wrong once the platform is
         a package. Every module extracted from MLBTracker computed the
         project root as three directories up from its own `__file__`, which
         was correct while it sat in `api/core/` inside the app. Installed as
         `bedrock`, three directories up is site-packages — a location that
         belongs to nobody, holds no `.env`, and has no `data/`.

         So the root has to come from the application. `BEDROCK_APP_ROOT` is
         the explicit answer; the process working directory is the default,
         because every documented entry point — `uvicorn`, `pytest`, the
         maintenance scripts — is already run from the application root.

         Resolved once at import, before any `.env` is read: a value that
         locates the `.env` cannot itself be configured by it.
"""
from __future__ import annotations

import os
from typing import Final

#: Absolute path to the consuming application's root directory.
APP_ROOT: Final[str] = os.path.abspath(
    os.environ.get("BEDROCK_APP_ROOT") or os.getcwd()
)


def app_path(*parts: str) -> str:
    """Join `parts` onto the application root.

    :param parts: Path segments relative to the application root.
    :returns: An absolute path.
    """
    return os.path.join(APP_ROOT, *parts)


def resolve_app_path(value: str | None, *default_parts: str) -> str:
    """Resolve a configured path, treating a relative one as app-root-relative.

    Configured paths land here from `.env` files, where writing
    `data/app.db` is far more natural than an absolute path — and where a
    relative path resolved against the working directory would mean something
    different depending on where the process was started.

    :param value: The configured path, or None/empty to use the default.
    :param default_parts: Path segments, relative to the app root, used when
        `value` is not set.
    :returns: An absolute path.
    """
    if not value:
        return app_path(*default_parts)
    return value if os.path.isabs(value) else app_path(value)
