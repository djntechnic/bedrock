"""
Module:  test_migration_atomicity.py
Layer:   bedrock-api/tests
Desc:    A migration is one unit of work, or it is a trap.

         The runner used to execute a .sql file statement by statement with no
         transaction, and to log-and-skip on failure. That combination reads as
         resilient and behaves as the opposite: the statements before the
         failure stayed committed, nothing was recorded in the ledger, and the
         next boot replayed the file from statement one against a database that
         had already half-received it.

         These tests pin the two properties that fix it — the file rolls back
         as a whole, and a failure stops startup rather than being swallowed —
         plus the subtler one that made the transaction possible at all: the
         ADD/RENAME COLUMN guards read through the migration's own connection,
         so they can see DDL the same file committed nowhere yet.
"""
from __future__ import annotations

import os
import sqlite3
import tempfile

import pytest

from bedrock.core import migrations
from bedrock.core.database import db
from bedrock.core.schema_catalog import Tables as T

_PRE_MIGRATION_SCHEMA = """
CREATE TABLE auth_users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    email   TEXT NOT NULL UNIQUE
);
"""


@pytest.fixture
def app_migrations(tmp_path):
    """An empty database plus an app migrations directory under test control.

    Yields a writer: `write("050_thing.sql", sql)` drops a migration file into
    the directory the runner will discover.
    """
    db_path = str(tmp_path / "atomic.db")
    conn = sqlite3.connect(db_path)
    try:
        conn.executescript(_PRE_MIGRATION_SCHEMA)
        conn.commit()
    finally:
        conn.close()

    mig_dir = tmp_path / "migrations"
    mig_dir.mkdir()

    original_db = (db.sqlite_path, db.is_postgres, db.db_url)
    original_dir = migrations.MIGRATIONS_DIR
    db.sqlite_path, db.is_postgres, db.db_url = db_path, False, None
    migrations.MIGRATIONS_DIR = str(mig_dir)
    db.close_pool()

    def write(name: str, sql: str) -> None:
        (mig_dir / name).write_text(sql, encoding="utf-8")

    yield write

    db.close_pool()
    db.sqlite_path, db.is_postgres, db.db_url = original_db
    migrations.MIGRATIONS_DIR = original_dir
    db.close_pool()


def _tables() -> set[str]:
    conn = sqlite3.connect(db.sqlite_path)
    try:
        return {
            row[0] for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
    finally:
        conn.close()


def _ledger() -> list[str]:
    return db.query(
        f"SELECT migration_id FROM {T.SYS_SCHEMA_MIGRATIONS}"
    )["migration_id"].tolist()


class TestAPartialFailureRollsBack:
    """The whole file, or none of it."""

    BROKEN = """
    CREATE TABLE widget (id INTEGER PRIMARY KEY);
    INSERT INTO widget (id) VALUES (1);
    INSERT INTO no_such_table (id) VALUES (1);
    CREATE TABLE gadget (id INTEGER PRIMARY KEY);
    """

    def test_it_raises(self, app_migrations):
        app_migrations("900_broken.sql", self.BROKEN)
        with pytest.raises(Exception):
            migrations.apply_migrations()

    def test_the_committed_prefix_is_undone(self, app_migrations):
        """The old runner left `widget` behind. That is the actual bug."""
        app_migrations("900_broken.sql", self.BROKEN)
        with pytest.raises(Exception):
            migrations.apply_migrations()
        assert "widget" not in _tables()
        assert "gadget" not in _tables()

    def test_nothing_is_recorded(self, app_migrations):
        app_migrations("900_broken.sql", self.BROKEN)
        with pytest.raises(Exception):
            migrations.apply_migrations()
        assert "900_broken" not in _ledger()

    def test_a_later_migration_does_not_run(self, app_migrations):
        """Startup stops. Applying 901 against a schema 900 never delivered is
        how a database ends up in a state no migration path describes."""
        app_migrations("900_broken.sql", self.BROKEN)
        app_migrations("901_later.sql", "CREATE TABLE later (id INTEGER);")
        with pytest.raises(Exception):
            migrations.apply_migrations()
        assert "later" not in _tables()


class TestASuccessfulMigration:
    def test_it_applies_and_records_together(self, app_migrations):
        app_migrations("900_ok.sql", "CREATE TABLE widget (id INTEGER PRIMARY KEY);")
        migrations.apply_migrations()
        assert "widget" in _tables()
        assert "900_ok" in _ledger()

    def test_rerunning_does_not_replay_it(self, app_migrations):
        app_migrations("900_ok.sql", "CREATE TABLE widget (id INTEGER PRIMARY KEY);")
        migrations.apply_migrations()
        migrations.apply_migrations()
        assert _ledger().count("900_ok") == 1

    def test_multiple_statements_all_commit(self, app_migrations):
        app_migrations(
            "900_multi.sql",
            "CREATE TABLE widget (id INTEGER PRIMARY KEY);\n"
            "INSERT INTO widget (id) VALUES (1);\n"
            "INSERT INTO widget (id) VALUES (2);\n",
        )
        migrations.apply_migrations()
        assert int(db.query("SELECT COUNT(*) AS n FROM widget").iloc[0]["n"]) == 2


class TestGuardsSeeTheirOwnTransaction:
    """The hazard the transaction introduced, and the reason `conn` is threaded
    all the way down to `_execute_statement`.

    The ADD/RENAME COLUMN guards pre-check with `PRAGMA table_info`. On any
    connection but the migration's own, a table created earlier in the same
    uncommitted file reads as absent — and "absent" makes the guard return
    quietly, skipping a real ALTER and calling the migration a success.
    """

    def test_add_column_after_create_in_the_same_file(self, app_migrations):
        app_migrations(
            "900_add.sql",
            "CREATE TABLE widget (id INTEGER PRIMARY KEY);\n"
            "ALTER TABLE widget ADD COLUMN label TEXT;\n",
        )
        migrations.apply_migrations()
        cols = db.query("PRAGMA table_info(widget)")["name"].tolist()
        assert "label" in cols

    def test_rename_column_after_create_in_the_same_file(self, app_migrations):
        app_migrations(
            "900_rename.sql",
            "CREATE TABLE widget (id INTEGER PRIMARY KEY, old_name TEXT);\n"
            "ALTER TABLE widget RENAME COLUMN old_name TO new_name;\n",
        )
        migrations.apply_migrations()
        cols = db.query("PRAGMA table_info(widget)")["name"].tolist()
        assert "new_name" in cols and "old_name" not in cols

    def test_the_add_column_guard_still_no_ops_when_already_present(
        self, app_migrations
    ):
        """Idempotency is why the guard exists; the transaction must not cost it."""
        app_migrations(
            "900_add.sql",
            "CREATE TABLE widget (id INTEGER PRIMARY KEY, label TEXT);\n"
            "ALTER TABLE widget ADD COLUMN label TEXT;\n",
        )
        migrations.apply_migrations()
        assert "900_add" in _ledger()
