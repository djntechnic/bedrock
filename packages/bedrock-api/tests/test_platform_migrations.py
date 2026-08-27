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


class TestSplitSqlStatements:
    """Direct unit tests for the parser every platform and app migration flows
    through — `_run_sql_file` hands it whatever a .sql file contains, and
    `TestEmptyDatabaseBootstrap` above only pins its behaviour incidentally,
    through the present wording of comments inside the real `baseline.sql`.
    Reword one of those comments and that coverage would silently stop
    meaning anything; these tests assert the parser's contract directly, one
    hazard at a time, against the returned statement list rather than a count.
    """

    def test_semicolon_inside_line_comment_does_not_split(self):
        sql = "SELECT 1; -- has a ; in it\nSELECT 2;"
        assert migrations._split_sql_statements(sql) == ["SELECT 1", "SELECT 2"]

    def test_apostrophe_inside_line_comment_does_not_desync(self):
        """The exact case that broke bootstrapping `baseline.sql`: a
        contraction in a trailing comment flips a naive quote tracker and
        silently merges everything after it into one statement."""
        sql = "SELECT 1; -- it's fine\nSELECT 2;"
        assert migrations._split_sql_statements(sql) == ["SELECT 1", "SELECT 2"]

    def test_semicolon_inside_string_literal_does_not_split(self):
        sql = "INSERT INTO t (msg) VALUES ('hello; world');"
        assert migrations._split_sql_statements(sql) == [
            "INSERT INTO t (msg) VALUES ('hello; world')"
        ]

    def test_escaped_quote_inside_string_literal(self):
        sql = "INSERT INTO t (msg) VALUES ('it''s fine');"
        assert migrations._split_sql_statements(sql) == [
            "INSERT INTO t (msg) VALUES ('it''s fine')"
        ]

    def test_trailing_statement_with_no_terminating_semicolon(self):
        sql = "SELECT 1;\nSELECT 2"
        assert migrations._split_sql_statements(sql) == ["SELECT 1", "SELECT 2"]

    def test_empty_input_returns_no_statements(self):
        assert migrations._split_sql_statements("") == []

    def test_input_that_is_only_a_comment_returns_no_statements(self):
        assert migrations._split_sql_statements(
            "-- just a comment, nothing else\n"
        ) == []

    def test_semicolon_inside_block_comment_does_not_split(self):
        sql = "SELECT 1; /* a comment; with a semicolon */\nSELECT 2;"
        assert migrations._split_sql_statements(sql) == ["SELECT 1", "SELECT 2"]

    def test_apostrophe_inside_block_comment_does_not_desync(self):
        """Same hazard as the line-comment case, in the other comment form."""
        sql = "SELECT 1; /* it's a block comment */\nSELECT 2;"
        assert migrations._split_sql_statements(sql) == ["SELECT 1", "SELECT 2"]


class TestBootstrapMissingBaseline:
    """§S5 requires the error leg: `_bootstrap_baseline` warns and skips
    rather than raising when `baseline.sql` is not where it expects — an
    installation that dropped the package data, per its own docstring."""

    def test_missing_baseline_sql_warns_and_skips(self, tmp_path, monkeypatch, caplog):
        db_path = tmp_path / "nobaseline.db"
        sqlite3.connect(str(db_path)).close()

        # A migrations directory with no baseline.sql sibling — the shape a
        # broken or partial package install would have.
        fake_migrations_dir = tmp_path / "schema" / "migrations"
        fake_migrations_dir.mkdir(parents=True)
        monkeypatch.setattr(
            migrations, "PLATFORM_MIGRATIONS_DIR", str(fake_migrations_dir)
        )

        original = (db.sqlite_path, db.is_postgres, db.db_url)
        db.sqlite_path, db.is_postgres, db.db_url = str(db_path), False, None
        db.close_pool()
        try:
            migrations._ensure_ledger_table()
            with caplog.at_level("WARNING", logger="bedrock.core.migrations"):
                migrations._bootstrap_baseline()  # must not raise

            applied = db.query(
                f"SELECT migration_id FROM {T.SYS_SCHEMA_MIGRATIONS}"
            )["migration_id"].tolist()
        finally:
            db.sqlite_path, db.is_postgres, db.db_url = original
            db.close_pool()

        assert "bedrock_baseline" not in applied
        assert any(
            "baseline.sql" in record.getMessage() for record in caplog.records
        )


class TestBootstrapAgainstAPreExistingDatabase:
    """The ledger guard protects a database this bootstrap has already run
    against once. It does NOT protect a database that predates the bootstrap
    entirely — one with tables already, but no `bedrock_baseline` row — and on
    that database the baseline genuinely is re-run over live data. That is
    only safe because `baseline.sql` is exclusively `CREATE TABLE IF NOT
    EXISTS` / `CREATE INDEX IF NOT EXISTS`, with no INSERT and no DROP; this
    asserts that stays true in the way that matters, not by reading the file.
    """

    def test_rerunning_the_baseline_over_existing_data_does_not_lose_it(
        self, tmp_path
    ):
        db_path = tmp_path / "existing.db"
        baseline = os.path.join(
            os.path.dirname(migrations.PLATFORM_MIGRATIONS_DIR), "baseline.sql"
        )
        with open(baseline, encoding="utf-8") as fh:
            baseline_sql = fh.read()

        conn = sqlite3.connect(str(db_path))
        try:
            conn.executescript(baseline_sql)
            conn.execute(
                "INSERT INTO auth_users (email) VALUES (?)",
                ("existing@example.com",),
            )
            conn.commit()
        finally:
            conn.close()

        original = (db.sqlite_path, db.is_postgres, db.db_url)
        db.sqlite_path, db.is_postgres, db.db_url = str(db_path), False, None
        db.close_pool()
        try:
            migrations.apply_migrations()  # must not raise, must not lose data

            conn = sqlite3.connect(str(db_path))
            try:
                emails = [
                    row[0] for row in conn.execute("SELECT email FROM auth_users")
                ]
                applied = {
                    row[0] for row in conn.execute(
                        "SELECT migration_id FROM sys_schema_migrations"
                    )
                }
            finally:
                conn.close()
        finally:
            db.sqlite_path, db.is_postgres, db.db_url = original
            db.close_pool()

        assert emails == ["existing@example.com"]
        assert "bedrock_baseline" in applied
