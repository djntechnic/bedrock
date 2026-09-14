"""Tests for DatabaseManager SQLite configuration and concurrency robustness (CollectIt #60)."""
from __future__ import annotations

import sqlite3
from bedrock.core.database import DatabaseManager


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
