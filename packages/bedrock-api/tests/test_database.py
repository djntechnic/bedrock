"""Tests for DatabaseManager SQLite configuration and concurrency robustness (CollectIt #60)."""
from __future__ import annotations

import sqlite3

import pytest

from bedrock.core.database import DatabaseManager, parse_sqlite_pragmas


def test_sqlite_busy_timeout(tmp_path, monkeypatch):
    """Verify that SQLite connections are initialized with PRAGMA busy_timeout set."""
    db_file = tmp_path / "test.db"
    monkeypatch.setenv("SQLITE_BUSY_TIMEOUT", "45.0")
    mgr = DatabaseManager()
    mgr.sqlite_path = str(db_file)

    with mgr.get_connection() as conn:
        if isinstance(conn, sqlite3.Connection):
            row = conn.execute("PRAGMA busy_timeout;").fetchone()
            assert row[0] == 45000

    # Default without explicit env var should be at least 30000ms
    monkeypatch.delenv("SQLITE_BUSY_TIMEOUT", raising=False)
    mgr2 = DatabaseManager()
    mgr2.sqlite_path = str(db_file)
    with mgr2.get_connection() as conn:
        if isinstance(conn, sqlite3.Connection):
            row = conn.execute("PRAGMA busy_timeout;").fetchone()
            assert row[0] >= 30000


def test_sqlite_pragmas_default_is_empty(tmp_path, monkeypatch):
    """Unset BEDROCK_SQLITE_PRAGMAS -> {}; a fresh connection keeps SQLite's default journal mode."""
    monkeypatch.delenv("BEDROCK_SQLITE_PRAGMAS", raising=False)
    assert parse_sqlite_pragmas(None) == {}

    mgr = DatabaseManager()
    mgr.is_postgres = False
    mgr.sqlite_path = str(tmp_path / "default.db")
    with mgr.get_connection() as conn:
        row = conn.execute("PRAGMA journal_mode;").fetchone()
        assert row[0].lower() == "delete"
    mgr.close_pool()


def test_sqlite_pragmas_applied_on_connection(tmp_path):
    """configure_sqlite_pragmas applies validated pragmas to the next acquired connection."""
    mgr = DatabaseManager()
    mgr.is_postgres = False
    mgr.sqlite_path = str(tmp_path / "pragma.db")
    mgr.configure_sqlite_pragmas({"journal_mode": "WAL", "synchronous": "NORMAL"})

    with mgr.get_connection() as conn:
        assert conn.execute("PRAGMA journal_mode;").fetchone()[0].lower() == "wal"
        assert conn.execute("PRAGMA synchronous;").fetchone()[0] == 1
    mgr.close_pool()


def test_sqlite_pragmas_reject_injection(tmp_path):
    """An injection-shaped pragma value is rejected before it ever reaches sqlite3.execute."""
    with pytest.raises(ValueError):
        parse_sqlite_pragmas({"journal_mode": "WAL; DROP TABLE x"})

    mgr = DatabaseManager()
    mgr.is_postgres = False
    mgr.sqlite_path = str(tmp_path / "inject.db")

    # Validation happens in configure_sqlite_pragmas before the pragma set is
    # stored or any connection is touched — the malicious value never reaches
    # a live connection to be interpolated into a PRAGMA statement.
    with pytest.raises(ValueError):
        mgr.configure_sqlite_pragmas({"journal_mode": "WAL; DROP TABLE x"})

    assert mgr._sqlite_pragmas == {}
    assert getattr(mgr._local, "sqlite_conn", None) is None
    mgr.close_pool()


def test_sqlite_pragmas_reject_unknown_key():
    """A key outside ALLOWED_SQLITE_PRAGMAS raises ValueError."""
    with pytest.raises(ValueError):
        parse_sqlite_pragmas({"writable_schema": "ON"})


def test_sqlite_pragmas_cannot_override_invariants():
    """foreign_keys / busy_timeout are enforced unconditionally and cannot be configured."""
    with pytest.raises(ValueError):
        parse_sqlite_pragmas({"foreign_keys": "OFF"})
    with pytest.raises(ValueError):
        parse_sqlite_pragmas({"busy_timeout": "0"})


def test_configure_sqlite_pragmas_resets_thread_connection(tmp_path):
    """Calling configure_sqlite_pragmas drops the calling thread's cached connection."""
    mgr = DatabaseManager()
    mgr.is_postgres = False
    mgr.sqlite_path = str(tmp_path / "reset.db")

    first = mgr._get_sqlite_connection()
    mgr.configure_sqlite_pragmas({"journal_mode": "WAL"})
    second = mgr._get_sqlite_connection()

    assert first is not second
    mgr.close_pool()


def test_sqlite_pragmas_ignored_on_postgres(tmp_path):
    """configure_sqlite_pragmas no-ops gracefully (no raise) when is_postgres is True."""
    mgr = DatabaseManager()
    mgr.is_postgres = True
    mgr.sqlite_path = str(tmp_path / "pg.db")

    mgr.configure_sqlite_pragmas({"journal_mode": "WAL"})
