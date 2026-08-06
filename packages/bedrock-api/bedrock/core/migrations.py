"""
Module:  migrations.py
Layer:   bedrock/core
Desc:    Versioned schema migration runner. On startup it ensures a
         `sys_schema_migrations` ledger table exists (auto-renaming the
         legacy `schema_migrations` table if found — §S7 PR-6), then applies
         every pending migration exactly once — recording each by a stable
         migration_id so re-running is fully idempotent.

         Migration sources, applied in this order:
           1. Inline ADD COLUMN migrations (`_ADD_COLUMN_MIGRATIONS`).
           2. Inline raw SQL migrations (`_RAW_MIGRATIONS`).
           3. On-disk `.sql` files in `MIGRATIONS_DIR`, sorted by filename.

         Each migration runs in its own try/except. Non-critical failures are
         logged and skipped so a single bad migration never crashes startup;
         migrations flagged `critical=True` re-raise on failure.
"""
import importlib
import os
import re
import glob
import logging

from bedrock.core.database import db
from bedrock.core.paths import resolve_app_path
from bedrock.core.schema_catalog import Tables as T

logger = logging.getLogger(__name__)

#: Directory holding the application's versioned .sql migration files (e.g.
#: 001_*.sql). These belong to the app, not the runner, so the directory is
#: resolved against the app root — pointing it inside the installed package
#: would look for an application's schema history in site-packages. Set
#: `BEDROCK_MIGRATIONS_DIR` to relocate it; a missing directory is valid and
#: simply means the app has no on-disk migrations.
MIGRATIONS_DIR = resolve_app_path(
    os.environ.get("BEDROCK_MIGRATIONS_DIR"), "migrations")

# ── Migration content (framework boundary) ───────────────────────────────────
# The inline ADD COLUMN and raw-SQL migrations are the host application's
# schema history, not the runner's. They live in api/domain/migration_content
# so this module is pure machinery — ledger, ordering, idempotency, error
# isolation — and can move into the shared platform package unchanged.
#
# On-disk .sql files under api/core/migrations/ are likewise app content;
# MIGRATIONS_DIR stays here because the *convention* (numbered files applied
# in filename order) is the runner's, while the files themselves are not.
#
# A missing content module means an app with no inline migrations, which is
# valid — a fresh application starts from a baseline schema and has none.
#: Dotted path to the app module exporting ADD_COLUMN_MIGRATIONS and
#: RAW_MIGRATIONS. Resolved dynamically — same seam as
#: config_constants.APP_CATEGORY_MODULE — so this module names no application
#: package and only the constant needs changing when it moves into the shared
#: platform package.
APP_MIGRATION_MODULE = "bedrock_app.migration_content"


def _load_inline_migrations() -> tuple[list, list]:
    """Return the host app's (ADD COLUMN, raw SQL) migration lists, or ([], [])."""
    try:
        module = importlib.import_module(APP_MIGRATION_MODULE)
    except ModuleNotFoundError:
        return [], []
    return (
        list(getattr(module, "ADD_COLUMN_MIGRATIONS", [])),
        list(getattr(module, "RAW_MIGRATIONS", [])),
    )


_ADD_COLUMN_MIGRATIONS, _RAW_MIGRATIONS = _load_inline_migrations()



def _ensure_ledger_table() -> None:
    """Ensure the `sys_schema_migrations` ledger exists.

    §S7 PR-6 renamed the legacy `schema_migrations` table to
    `sys_schema_migrations`. On DBs that predate the rename the legacy table
    is ALTERed in place (O(1) metadata) so applied migration IDs are
    preserved; fresh DBs get the new name directly.
    """
    # sqlite_master exists on SQLite; PostgreSQL uses to_regclass. Try SQLite
    # first (the only environment that has ever run this ledger); if it fails,
    # fall through to a straight CREATE IF NOT EXISTS.
    try:
        df = db.query(
            "SELECT name FROM sqlite_master WHERE type='table' "
            "AND name IN ('sys_schema_migrations', 'schema_migrations')"
        )
        names = set(df["name"].tolist()) if not df.empty else set()
        if "sys_schema_migrations" not in names and "schema_migrations" in names:
            db.execute("ALTER TABLE schema_migrations RENAME TO sys_schema_migrations")
            logger.info("Renamed ledger table schema_migrations → sys_schema_migrations")
    except Exception as e:
        logger.debug("Ledger rename probe skipped (%s); proceeding with CREATE IF NOT EXISTS", e)

    db.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {T.SYS_SCHEMA_MIGRATIONS} (
            migration_id TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )


def _is_applied(migration_id: str) -> bool:
    """Return True if a migration_id is already recorded in the ledger."""
    df = db.query(
        f"SELECT 1 FROM {T.SYS_SCHEMA_MIGRATIONS} WHERE migration_id = %s LIMIT 1",
        (migration_id,),
    )
    return not df.empty


def _record(migration_id: str) -> None:
    """Record a migration_id as applied in the ledger."""
    db.execute(
        f"INSERT INTO {T.SYS_SCHEMA_MIGRATIONS} (migration_id) VALUES (%s)",
        (migration_id,),
    )


def _apply_one(migration_id: str, runner, *, critical: bool = False) -> bool:
    """
    Apply a single migration exactly once.

    Args:
        migration_id: Stable unique identifier recorded in the ledger.
        runner: Zero-arg callable that performs the migration's SQL.
        critical: When True, a failure re-raises (aborting startup). When
                  False, failures are logged and skipped.

    Returns:
        bool: True if the migration was applied during this call, False if it
              was already applied or was skipped due to a non-critical error.
    """
    if _is_applied(migration_id):
        return False

    try:
        runner()
    except Exception as e:
        if critical:
            logger.error("CRITICAL migration failed: %s — %s", migration_id, e)
            raise
        logger.warning("Migration skipped (failed): %s — %s", migration_id, e)
        return False

    _record(migration_id)
    logger.info("Migration applied: %s", migration_id)
    return True


# Matches `ALTER TABLE <table> ADD COLUMN <column> …` so the file-based runner
# can pre-check column existence and skip cleanly — otherwise SQLite raises
# "duplicate column name" on every restart for any DB where the column arrived
# via another path (e.g. a fresh CREATE TABLE that already includes it).
_ADD_COLUMN_RE = re.compile(
    r"^\s*ALTER\s+TABLE\s+(?P<table>\w+)\s+ADD\s+COLUMN\s+(?P<column>\w+)\b",
    re.IGNORECASE,
)


# Same idea as _ADD_COLUMN_RE, for RENAME COLUMN. A fresh clone bootstraps from
# schema_sqlite.sql / schema.sql, which already carry the post-rename column
# name, so the ALTER would fail on "no such column" and — because the runner
# aborts a migration at its first failing statement — silently skip everything
# after it in the same file. Guarding here keeps a rename migration correct on
# both an existing database and a fresh one.
_RENAME_COLUMN_RE = re.compile(
    r"^\s*ALTER\s+TABLE\s+(?P<table>\w+)\s+RENAME\s+COLUMN\s+"
    r"(?P<old>\w+)\s+TO\s+(?P<new>\w+)\b",
    re.IGNORECASE,
)


def _execute_statement(stmt: str) -> None:
    """Execute one migration statement, no-oping idempotent ADD/RENAME COLUMN cases."""
    m = _ADD_COLUMN_RE.match(stmt)
    if m:
        table, column = m.group("table"), m.group("column")
        cols = db.query(f"PRAGMA table_info({table})")
        if cols.empty:
            return  # table absent (likely renamed by a later migration)
        if column in cols["name"].tolist():
            return  # column already present
    m = _RENAME_COLUMN_RE.match(stmt)
    if m:
        table, old, new = m.group("table"), m.group("old"), m.group("new")
        cols = db.query(f"PRAGMA table_info({table})")
        if cols.empty:
            return  # table absent (likely renamed by a later migration)
        names = cols["name"].tolist()
        if old not in names and new in names:
            return  # rename already in effect
    db.execute(stmt)


def _split_sql_statements(sql: str) -> list[str]:
    """Split a SQL script into individual non-empty statements on ';', stripping -- comments.

    The split is single-quote aware: a ';' inside a string literal does not
    terminate a statement, so descriptions or values containing semicolons
    (e.g. ``'... surfaced by the health endpoint; blank falls back ...'``) stay
    intact. SQL escapes an embedded quote by doubling it (``''``); the simple
    toggle handles this correctly because the two adjacent quotes flip the
    in-string flag off then back on.
    """
    stripped_lines = [
        line for line in sql.splitlines()
        if not line.strip().startswith("--")
    ]
    stripped = "\n".join(stripped_lines)

    statements: list[str] = []
    current: list[str] = []
    in_string = False
    for ch in stripped:
        if ch == "'":
            in_string = not in_string
            current.append(ch)
        elif ch == ";" and not in_string:
            stmt = "".join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []
        else:
            current.append(ch)

    tail = "".join(current).strip()
    if tail:
        statements.append(tail)
    return statements


def _discover_sql_files() -> list[str]:
    """Return sorted absolute paths of all .sql migration files on disk."""
    if not os.path.isdir(MIGRATIONS_DIR):
        return []
    return sorted(glob.glob(os.path.join(MIGRATIONS_DIR, "*.sql")))


def apply_migrations() -> None:
    """Run all pending migrations through the versioned ledger. Idempotent."""
    _ensure_ledger_table()

    # 1. Raw inline migrations.
    for migration_id, sql in _RAW_MIGRATIONS:
        def _runner(s=sql):
            for statement in _split_sql_statements(s):
                _execute_statement(statement)

        _apply_one(migration_id, _runner)

    # 2. ADD COLUMN migrations — stable id per (table, column).
    for table, column, col_type in _ADD_COLUMN_MIGRATIONS:
        migration_id = f"alter_{table}_{column}"

        def _runner(t=table, c=column, ct=col_type):
            # Check whether the column already exists before attempting ALTER
            # TABLE so the database driver never logs a noisy ERROR for a
            # perfectly expected "duplicate column" scenario. Also skip when
            # the target table is absent — some ADD COLUMN entries target
            # tables that were later renamed by _RAW_MIGRATIONS (e.g.
            # rankings_daily_scores → rankings_scores), so on any DB where the
            # rename has already applied, the source table no longer exists
            # and the ALTER would otherwise emit a spurious startup ERROR.
            cols = db.query(f"PRAGMA table_info({t})")
            if cols.empty:
                return  # table absent (likely renamed by a later migration)
            if c in cols["name"].tolist():
                return  # already present — nothing to do
            db.execute(f"ALTER TABLE {t} ADD COLUMN {c} {ct}")

        _apply_one(migration_id, _runner)

    # 3. On-disk .sql files, applied in sorted filename order.
    for path in _discover_sql_files():
        migration_id = os.path.splitext(os.path.basename(path))[0]

        def _runner(p=path):
            with open(p, "r", encoding="utf-8") as fh:
                script = fh.read()
            for statement in _split_sql_statements(script):
                _execute_statement(statement)

        _apply_one(migration_id, _runner)
