"""
Module:  config.py
Layer:   bedrock/core
Desc:    Environment and filesystem configuration for a bedrock application.

         Every path here is anchored to `paths.APP_ROOT` — the consuming
         application's directory — rather than to this file's own location.
         See `paths.py` for why that distinction matters once the platform
         ships as a package.

         This module loads `<APP_ROOT>/.env`, and everything that touches the
         database imports it, so a setting placed there is visible to the rest
         of bedrock.
"""
import os

from dotenv import load_dotenv

from bedrock.core.paths import APP_ROOT, app_path, resolve_app_path

# Load the application's .env before any setting below is read. `override=True`
# means the file wins over an inherited environment, which is what makes a
# checkout's .env authoritative during local development.
load_dotenv(app_path(".env"), override=True)

_DATA_DIR = resolve_app_path(os.environ.get("BEDROCK_DATA_DIR"), "data")
_SQLITE_ENV = os.environ.get("SQLITE_DB_PATH")


class Config:
    """Centralized configuration for a bedrock application.

    Aggregates settings from environment variables and provides defaults that
    work for a fresh application with no `.env` at all.
    """

    # Project Paths
    PROJECT_ROOT = APP_ROOT
    DATA_DIR = _DATA_DIR

    # Database
    DATABASE_URL = os.environ.get("DATABASE_URL")
    #: SQLite file used when DATABASE_URL is unset. A relative value is
    #: resolved against the application root, so `.env` can say
    #: `SQLITE_DB_PATH=data/myapp.db` and mean the same thing regardless of
    #: which directory the process was started from.
    SQLITE_DB_PATH = (resolve_app_path(_SQLITE_ENV) if _SQLITE_ENV
                      else os.path.join(_DATA_DIR, "app.db"))

    CACHE_DIR = os.path.join(_DATA_DIR, ".cache")

    # Cloudflare Images CDN — optional; the adapter degrades when unset.
    CLOUDFLARE_ACCOUNT_ID = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
    CLOUDFLARE_API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")
    CLOUDFLARE_IMAGES_HASH = os.environ.get("CLOUDFLARE_IMAGES_HASH", "")

    # Application Settings
    DEBUG = os.environ.get("DEBUG", "false").lower() == "true"
    PORT = int(os.environ.get("PORT", 8000))

    @classmethod
    def get_db_path(cls):
        """
        Helper to get the appropriate DB path or URL.

        Returns:
            str: The database connection string or file path.
        """
        return cls.DATABASE_URL if cls.DATABASE_URL else cls.SQLITE_DB_PATH


config = Config()
