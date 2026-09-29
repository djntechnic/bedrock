"""
Module: tests/test_logging.py
Layer:  bedrock-api/tests
Desc:   Unit tests for centralized backend logging bootstrapper.
        Verifies log levels, source formatting, and guarantees that
        initialize_backend_logging() does not touch the database or
        leak SQLite connections during module initialization (issue #114).
"""
import os
import sqlite3
import pytest
from bedrock.core.config import config
from bedrock.core.database import db
from bedrock.core.logging import (
    initialize_backend_logging,
    configure_backend_logging_from_db,
    _get_log_level,
    _show_source_location,
    _backend_log_format,
)


@pytest.fixture(autouse=True)
def cleanup_db():
    yield
    db.close_pool()


def test_initialize_backend_logging_never_acquires_db_connection(tmp_path, monkeypatch):
    """
    Issue #114: initialize_backend_logging() must not acquire database connections
    or mutate connection pool state at module import time, preserving hermetic
    test isolation in consumer applications.
    """
    # Create a non-empty SQLite database file simulating live app DB
    fake_db = tmp_path / "live_app.db"
    conn = sqlite3.connect(fake_db)
    conn.execute("CREATE TABLE app_config_settings (key TEXT PRIMARY KEY, value TEXT);")
    conn.execute("INSERT INTO app_config_settings VALUES ('logging_level', 'WARNING');")
    conn.execute("INSERT INTO app_config_settings VALUES ('logging_show_source_location', '1');")
    conn.commit()
    conn.close()

    # Point db.sqlite_path at this file
    monkeypatch.setattr(db, "_sqlite_path", str(fake_db))
    # Clear any cached connection
    db.close_pool()

    # Clear env vars so fallback paths execute
    monkeypatch.delenv("BACKEND_LOG_LEVEL", raising=False)
    monkeypatch.delenv("LOG_LEVEL", raising=False)
    monkeypatch.delenv("BACKEND_LOG_SHOW_SOURCE", raising=False)
    monkeypatch.delenv("LOG_SHOW_SOURCE", raising=False)

    mtime_before = os.path.getmtime(fake_db)

    # Call initialize_backend_logging
    initialize_backend_logging()

    # Verify no connection was cached in thread-local storage
    cached_conn = getattr(db._local, "sqlite_conn", None)
    assert cached_conn is None, "initialize_backend_logging() leaked a SQLite connection into db._local"

    # Verify live DB file mtime was not altered
    mtime_after = os.path.getmtime(fake_db)
    assert mtime_before == mtime_after, "initialize_backend_logging() modified the SQLite file mtime"


def test_get_log_level_env_precedence(monkeypatch):
    monkeypatch.setenv("BACKEND_LOG_LEVEL", "ERROR")
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    assert _get_log_level() == "ERROR"

    monkeypatch.delenv("BACKEND_LOG_LEVEL")
    monkeypatch.setenv("LOG_LEVEL", "WARNING")
    assert _get_log_level() == "WARNING"


def test_get_log_level_fallback(monkeypatch):
    monkeypatch.delenv("BACKEND_LOG_LEVEL", raising=False)
    monkeypatch.delenv("LOG_LEVEL", raising=False)
    monkeypatch.delenv("DEBUG", raising=False)

    monkeypatch.setattr("bedrock.core.logging.config.DEBUG", True)
    assert _get_log_level() == "DEBUG"

    monkeypatch.setattr("bedrock.core.logging.config.DEBUG", False)
    assert _get_log_level() == "INFO"

    monkeypatch.setenv("DEBUG", "true")
    assert _get_log_level() == "DEBUG"


def test_show_source_location_env(monkeypatch):
    monkeypatch.setenv("BACKEND_LOG_SHOW_SOURCE", "true")
    assert _show_source_location() is True

    monkeypatch.setenv("BACKEND_LOG_SHOW_SOURCE", "1")
    assert _show_source_location() is True

    monkeypatch.setenv("BACKEND_LOG_SHOW_SOURCE", "false")
    assert _show_source_location() is False

    monkeypatch.delenv("BACKEND_LOG_SHOW_SOURCE")
    monkeypatch.setenv("LOG_SHOW_SOURCE", "yes")
    assert _show_source_location() is True

    monkeypatch.delenv("LOG_SHOW_SOURCE")
    assert _show_source_location() is False


def test_backend_log_format():
    fmt_with_source = _backend_log_format(show_source=True)
    assert "{name}:{function}:{line}" in fmt_with_source

    fmt_no_source = _backend_log_format(show_source=False)
    assert "{name}:{function}:{line}" not in fmt_no_source


def test_configure_backend_logging_from_db(tmp_path, monkeypatch):
    """
    Dynamic configuration from app_config_settings is deferred to
    lifespan / configure_backend_logging_from_db().
    """
    fake_db = tmp_path / "app.db"
    conn = sqlite3.connect(fake_db)
    conn.execute("CREATE TABLE app_config_settings (key TEXT PRIMARY KEY, value TEXT);")
    conn.execute("INSERT INTO app_config_settings VALUES ('logging_level', 'CRITICAL');")
    conn.execute("INSERT INTO app_config_settings VALUES ('logging_show_source_location', '1');")
    conn.commit()
    conn.close()

    monkeypatch.setattr(db, "_sqlite_path", str(fake_db))
    db.close_pool()

    monkeypatch.delenv("BACKEND_LOG_LEVEL", raising=False)
    monkeypatch.delenv("LOG_LEVEL", raising=False)
    monkeypatch.delenv("BACKEND_LOG_SHOW_SOURCE", raising=False)
    monkeypatch.delenv("LOG_SHOW_SOURCE", raising=False)

    # Calling configure_backend_logging_from_db reads from DB and updates logging
    configure_backend_logging_from_db()
