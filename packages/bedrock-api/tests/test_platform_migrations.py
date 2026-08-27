"""
Module:  test_platform_migrations.py
Layer:   bedrock-api/tests
Desc:    The platform's own migration source.

         `baseline.sql` only reaches databases created after a change, so
         without this mechanism a bedrock release that adds a platform table
         could not reach any application that already exists — every consumer
         would have to hand-copy a migration for a table it does not own.

         These tests run the real runner against a genuinely empty database,
         because the interesting case is the one the baseline does not cover.
"""
from __future__ import annotations

import os
import sqlite3
import tempfile

import pytest

from bedrock.core import migrations
from bedrock.core.database import db
from bedrock.core.schema_catalog import Tables as T


#: The pre-migration schema: `auth_users` and nothing else. That is what an
#: application upgrading from v0.1.x looks like from this migration's point of
#: view — the FK target exists, the token table does not. Building the fixture
#: from the current `baseline.sql` instead would create the table before the
#: migration ran and test nothing; building it from literally nothing leaves a
#: dangling foreign key that no real database has.
_PRE_MIGRATION_SCHEMA = """
CREATE TABLE auth_users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    email   TEXT NOT NULL UNIQUE
);
"""


@pytest.fixture
def empty_db():
    """A v0.1.x-shaped database, pointed at by the shared manager."""
    tmpdir = tempfile.mkdtemp(prefix="bedrock-migrations-")
    path = os.path.join(tmpdir, "empty.db")
    conn = sqlite3.connect(path)
    try:
        conn.executescript(_PRE_MIGRATION_SCHEMA)
        conn.commit()
    finally:
        conn.close()

    original = (db.sqlite_path, db.is_postgres, db.db_url)
    db.sqlite_path, db.is_postgres, db.db_url = path, False, None
    db.close_pool()
    yield path
    db.close_pool()
    db.sqlite_path, db.is_postgres, db.db_url = original
    db.close_pool()


def _tables(path: str) -> set[str]:
    conn = sqlite3.connect(path)
    try:
        return {
            row[0] for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
    finally:
        conn.close()


class TestPlatformMigrationsAreDiscovered:
    def test_the_directory_ships_with_the_package(self):
        """Anchored to `__file__`, unlike every other path in bedrock — these
        files belong to the package, so site-packages is the right place."""
        assert os.path.isdir(migrations.PLATFORM_MIGRATIONS_DIR)

    def test_at_least_one_migration_exists(self):
        assert migrations._discover_platform_sql_files()

    def test_they_are_ordered_by_filename(self):
        found = migrations._discover_platform_sql_files()
        assert found == sorted(found)


class TestApplication:
    def test_the_table_is_created(self, empty_db):
        migrations.apply_migrations()
        assert T.AUTH_EMAIL_TOKENS in _tables(empty_db)

    def test_the_ledger_records_it(self, empty_db):
        migrations.apply_migrations()
        applied = db.query(
            f"SELECT migration_id FROM {T.SYS_SCHEMA_MIGRATIONS}"
        )["migration_id"].tolist()
        assert "bedrock_001_auth_email_tokens" in applied

    def test_ids_are_namespaced(self, empty_db):
        """An app's `001_initial.sql` and the platform's `001_…` would collide
        on a bare stem, and the second to run would be recorded as done."""
        migrations.apply_migrations()
        applied = db.query(
            f"SELECT migration_id FROM {T.SYS_SCHEMA_MIGRATIONS}"
        )["migration_id"].tolist()
        assert all(
            mid.startswith(migrations.PLATFORM_MIGRATION_PREFIX) for mid in applied
        )

    def test_rerunning_is_idempotent(self, empty_db):
        migrations.apply_migrations()
        migrations.apply_migrations()
        count = db.query(
            f"SELECT COUNT(*) AS n FROM {T.SYS_SCHEMA_MIGRATIONS} "
            f"WHERE migration_id = %s",
            ("bedrock_001_auth_email_tokens",),
        ).iloc[0]["n"]
        assert int(count) == 1

    def test_the_table_is_usable_afterwards(self, empty_db):
        """A CREATE that parses is not the same as a table the code can write."""
        migrations.apply_migrations()
        db.execute("INSERT INTO auth_users (email) VALUES (%s)", ("u@example.com",))
        db.execute(
            f"INSERT INTO {T.AUTH_EMAIL_TOKENS} "
            f"(user_id, purpose, token_hash, expires_at) VALUES (%s, %s, %s, %s)",
            (1, "password_reset", "deadbeef", "2099-01-01 00:00:00"),
        )
        assert not db.query(f"SELECT * FROM {T.AUTH_EMAIL_TOKENS}").empty


class TestBaselineAndMigrationAgree:
    """A platform table has to exist for both new and existing applications.

    A change made only to `baseline.sql` is invisible to every live database;
    one made only as a migration is invisible to every new one. This asserts
    the pair stayed in step for the table F1 introduced.
    """

    def test_the_baseline_also_creates_it(self):
        baseline = os.path.join(
            os.path.dirname(migrations.PLATFORM_MIGRATIONS_DIR), "baseline.sql"
        )
        with open(baseline, encoding="utf-8") as fh:
            assert T.AUTH_EMAIL_TOKENS in fh.read()

    def test_a_baseline_database_needs_no_migration(self, platform_db):
        """The session database is built from the baseline alone."""
        assert T.AUTH_EMAIL_TOKENS in _tables(platform_db)


class TestEmptyDatabaseBootstrap:
    """A database with no tables at all — the path a fresh install takes.

    The session `platform_db` fixture applies baseline.sql itself, so no
    existing test reaches this state. That is why #20 shipped.
    """

    def test_apply_migrations_creates_the_platform_tables(self, tmp_path):
        db_path = tmp_path / "empty.db"
        sqlite3.connect(str(db_path)).close()  # exists, and is empty

        from bedrock.core.database import db
        original = (db.sqlite_path, db.is_postgres, db.db_url)
        db.sqlite_path = str(db_path)
        db.is_postgres = False
        db.db_url = None
        db.close_pool()
        try:
            migrations.apply_migrations()

            conn = sqlite3.connect(str(db_path))
            names = {
                row[0] for row in conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                )
            }
            conn.close()
        finally:
            db.sqlite_path, db.is_postgres, db.db_url = original
            db.close_pool()

        assert "app_grid_settings" in names
        assert "auth_users" in names

    def test_the_bootstrap_is_recorded_so_a_second_boot_is_a_noop(self, tmp_path):
        db_path = tmp_path / "empty2.db"
        sqlite3.connect(str(db_path)).close()

        from bedrock.core.database import db
        original = (db.sqlite_path, db.is_postgres, db.db_url)
        db.sqlite_path = str(db_path)
        db.is_postgres = False
        db.db_url = None
        db.close_pool()
        try:
            migrations.apply_migrations()
            migrations.apply_migrations()  # must not raise

            conn = sqlite3.connect(str(db_path))
            applied = {
                row[0] for row in conn.execute(
                    "SELECT migration_id FROM sys_schema_migrations"
                )
            }
            conn.close()
        finally:
            db.sqlite_path, db.is_postgres, db.db_url = original
            db.close_pool()

        assert "bedrock_baseline" in applied
