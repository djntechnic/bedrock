"""
Module:  database.py
Layer:   api/core
Desc:    Centralized database abstraction layer. Handles connection pooling,
         dialect translation between SQLite and Postgres, and utility methods
         for querying and logging.

         Connection strategy:
           - SQLite: one persistent connection per thread (thread-local),
             reused across query()/execute()/executemany() calls. Stale or
             closed connections are transparently re-created.
           - Postgres: a process-wide psycopg2 ThreadedConnectionPool
             (min=2, max=10) leased per call and returned afterwards.

         transaction() always allocates a dedicated connection that the caller
         owns exclusively for the duration of the unit of work — it never
         reuses the thread-local SQLite connection.
"""
import os
import logging
import re
import sqlite3
import threading
import pandas as pd


class DatabaseQueryError(RuntimeError):
    """Raised when a SQL SELECT via DatabaseManager.query fails.

    Introduced by unified_grid_standard §1.5 / Phase 2.b: db.query() stops
    swallowing exceptions. The platform translates this to a 500 carrying
    detail={"code": "GRID_QUERY_FAILED", ...} — see
    `bedrock.core.error_handlers.register_error_handlers`, which an
    application calls once from its entry point.
    """

    def __init__(self, message: str, *, sql: str | None = None, original: BaseException | None = None):
        super().__init__(message)
        self.sql = sql
        self.original = original


# Matches SQLAlchemy/Peewee-style :name binds so they can be rewritten to the
# Postgres %(name)s style. Ignores `::type` casts (double colon) and only
# recognizes an identifier that follows a colon at a word boundary. SQLite
# handles :name natively via sqlite3, so this translation only fires for the
# Postgres path.
_NAMED_BIND_PATTERN = re.compile(r"(?<!:):([A-Za-z_][A-Za-z0-9_]*)")

try:
    import psycopg2
    import psycopg2.pool
except ImportError:
    psycopg2 = None  # type: ignore[assignment]
from contextlib import contextmanager
from time import monotonic
from typing import Callable
from bedrock.core.config import config
from bedrock.core.schema_catalog import Tables as T

# Module-level config cache — shared across all DatabaseManager instances.
# Values expire after _CONFIG_TTL seconds; set_config evicts the key immediately.
_CONFIG_TTL: float = 60.0
_config_cache: dict = {}            # key → (coerced_value, expires_at)
_config_cache_lock = threading.Lock()

_current_season_cache = None
_current_season_expires_at: float = 0.0
_season_cache_lock = threading.Lock()

# Resolver supplying the current season. Registered by the host application
# (see api/domain/current_season.py) so this module carries no season-table
# knowledge; None means "no season concept", handled in get_current_season().
_current_season_resolver: Callable[[], int] | None = None


def register_current_season_resolver(fn: Callable[[], int]) -> None:
    """Register the callable that resolves the current season.

    Re-registering overwrites, which keeps repeated imports idempotent.

    :param fn: Zero-argument callable returning an int. Exceptions are caught
        by `get_current_season()` and fall back to the calendar year.
    """
    global _current_season_resolver, _current_season_cache, _current_season_expires_at
    _current_season_resolver = fn
    # Drop any value cached under a previous resolver.
    with _season_cache_lock:
        _current_season_cache = None
        _current_season_expires_at = 0.0


def registered_current_season_resolver() -> tuple[Callable[[], int], ...]:
    """:returns: The registered resolver as a 0- or 1-tuple.

    A tuple rather than `Callable | None` so this reader matches the other
    registries' shape (see `docs/extension_points.md`) — every `registered_*`
    hands back an immutable snapshot, and callers test it the same way
    regardless of whether the registry holds one contribution or many.
    """
    return () if _current_season_resolver is None else (_current_season_resolver,)


def __clear_current_season_resolver() -> None:
    """Test helper: drops the registration. Not used by application code."""
    global _current_season_resolver, _current_season_cache, _current_season_expires_at
    _current_season_resolver = None
    with _season_cache_lock:
        _current_season_cache = None
        _current_season_expires_at = 0.0


# Postgres connection-pool sizing.
_PG_POOL_MIN = 2
_PG_POOL_MAX = 10

logger = logging.getLogger(__name__)

class DatabaseManager:
    """
    Centralized database manager.
    Handles connection management, dialect translation (SQLite vs Postgres),
    and common configuration/logging tasks.
    """

    def __init__(self):
        self.db_url = config.DATABASE_URL
        self._sqlite_path = config.SQLITE_DB_PATH
        self.is_postgres = bool(self.db_url)

        # Thread-local store for persistent per-thread SQLite connections.
        self._local = threading.local()

        # Lazily-initialised Postgres connection pool (guarded by _pool_lock).
        self._pg_pool = None
        self._pool_lock = threading.Lock()

    @property
    def sqlite_path(self):
        return self._sqlite_path

    @sqlite_path.setter
    def sqlite_path(self, value):
        self._sqlite_path = value
        self.invalidate_config()

    def validate_connection(self) -> str:
        """Validate database name and connection upon startup.

        Logs an INFO message confirming the database backend, full path (if local)
        or URL (if hosted), and successful connection verification.
        """
        if self.is_postgres:
            db_target = self.db_url or "postgres"
            backend = "PostgreSQL"
        else:
            db_target = os.path.abspath(self.sqlite_path) if self.sqlite_path else "sqlite.db"
            backend = "SQLite"

        with self.get_connection() as conn:
            if self.is_postgres:
                cur = conn.cursor()
                cur.execute("SELECT 1;")
            else:
                conn.execute("SELECT 1;")

        log_msg = f"Database connection validated: connected to {backend} database '{db_target}'."
        logger.info(log_msg)
        return log_msg

    # ------------------------------------------------------------------ #
    # Connection acquisition
    # ------------------------------------------------------------------ #
    def _create_sqlite_connection(self, *, explicit_transactions: bool = False
                                  ) -> sqlite3.Connection:
        """Create and configure a new SQLite connection with foreign keys enabled.

        :param explicit_transactions: When True the connection is opened in
            autocommit mode (``isolation_level=None``) and the caller drives
            BEGIN/COMMIT/ROLLBACK itself. `transaction()` needs this: pysqlite's
            default mode only opens a transaction ahead of DML, so a CREATE
            TABLE commits on the spot and survives a later rollback — which for
            a schema migration is the entire failure mode being guarded against.
        """
        conn = sqlite3.connect(
            self.sqlite_path,
            isolation_level=None if explicit_transactions else "",
        )
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

    def _get_sqlite_connection(self) -> sqlite3.Connection:
        """
        Return the calling thread's persistent SQLite connection, creating it
        on first use. The connection is health-checked with `SELECT 1`; if the
        check fails (closed/stale handle) a fresh connection is created.

        Returns:
            sqlite3.Connection: A live connection scoped to the current thread.
        """
        conn = getattr(self._local, "sqlite_conn", None)
        if conn is not None:
            try:
                conn.execute("SELECT 1")
                return conn
            except sqlite3.Error:
                # Stale/closed handle — drop it and reconnect below.
                try:
                    conn.close()
                except sqlite3.Error:
                    pass
                self._local.sqlite_conn = None

        conn = self._create_sqlite_connection()
        self._local.sqlite_conn = conn
        return conn

    def _get_pg_pool(self):
        """Lazily create and return the process-wide Postgres connection pool."""
        if psycopg2 is None:
            raise RuntimeError("psycopg2 is not installed. Run: pip install psycopg2-binary")
        if self._pg_pool is None:
            with self._pool_lock:
                if self._pg_pool is None:
                    self._pg_pool = psycopg2.pool.ThreadedConnectionPool(
                        _PG_POOL_MIN, _PG_POOL_MAX, dsn=self.db_url
                    )
        return self._pg_pool

    @contextmanager
    def get_connection(self):
        """
        Context manager yielding a usable connection.

        - SQLite: yields the persistent thread-local connection. It is NOT
          closed on exit — it lives for the thread's lifetime and is reused.
        - Postgres: leases a connection from the pool and returns it on exit.

        Yields:
            connection: A sqlite3 or psycopg2 connection object.
        """
        if self.is_postgres:
            pool = self._get_pg_pool()
            conn = pool.getconn()
            try:
                yield conn
            finally:
                pool.putconn(conn)
        else:
            # Persistent per-thread connection — do not close on exit.
            yield self._get_sqlite_connection()

    def close_pool(self) -> None:
        """
        Release pooled/thread-local resources for clean shutdown.

        Closes the calling thread's SQLite connection (if any) and the entire
        Postgres pool. Safe to call multiple times. Wire this into the
        application lifespan shutdown hook.
        """
        conn = getattr(self._local, "sqlite_conn", None)
        if conn is not None:
            try:
                conn.close()
            except sqlite3.Error:
                pass
            self._local.sqlite_conn = None

        if self._pg_pool is not None:
            with self._pool_lock:
                if self._pg_pool is not None:
                    try:
                        self._pg_pool.closeall()
                    finally:
                        self._pg_pool = None

    # Dialect translation between SQLite and Postgres. Handles both positional
    # (%s / ?) and named (:name / %(name)s) placeholder styles so the same SQL
    # runs against either backend without modification.
    #
    # SQLite path: %s → ?, :name left as-is (sqlite3 supports :name natively).
    # Postgres path: %s left as-is, :name → %(name)s (psycopg2's dict-bind
    # style).
    def _translate_query(self, sql):
        """Translate placeholders to the active backend's dialect."""
        if self.is_postgres:
            # Rewrite :name → %(name)s. Skip ::type-cast tokens (handled by the
            # negative-lookbehind in _NAMED_BIND_PATTERN).
            return _NAMED_BIND_PATTERN.sub(r"%(\1)s", sql)
        return sql.replace("%s", "?")

    def query(self, sql, params=None):
        """
        Execute a SELECT query and return a pandas DataFrame.

        Args:
            sql: The SQL query string (Postgres dialect).
            params: Optional tuple/list of parameters for the query.

        Returns:
            pd.DataFrame: Results of the query as a DataFrame.
        """
        sql = self._translate_query(sql)

        logger.debug("Executing SQL: %s | params=%s", sql, params)

        with self.get_connection() as conn:
            try:
                df = pd.read_sql_query(sql, conn, params=params)
                # Ensure NaN values are converted to None for JSON serialization
                # compatibility. Cast to object first: on an all-NULL column
                # pandas infers float64 dtype, and .where(..., None) on a float
                # column silently re-coerces None back to NaN. astype(object)
                # lets the None survive so nullable columns (e.g. hover_color)
                # serialize as JSON null rather than NaN.
                return df.astype(object).where(pd.notnull(df), None)
            except Exception as e:
                # Phase 2.b: propagate. Silent DataFrame() masked bugs and
                # made empty-result vs. crashed-query indistinguishable at the
                # route layer. The FastAPI handler translates DatabaseQueryError
                # to HTTPException(500) with the GRID_QUERY_FAILED code.
                logger.error("Database Query Error: %s\nSQL: %s", e, sql)
                raise DatabaseQueryError(str(e), sql=sql, original=e) from e

    def execute(self, sql, params=None):
        """
        Execute a non-SELECT query (INSERT, UPDATE, DELETE).

        Args:
            sql: The SQL query string (Postgres dialect).
            params: Optional tuple/list of parameters for the query.

        Returns:
            int: The number of rows affected by the statement.
        """
        sql = self._translate_query(sql)

        logger.debug("Executing SQL: %s | params=%s", sql, params)

        with self.get_connection() as conn:
            try:
                cur = conn.cursor()
                if params:
                    cur.execute(sql, params)
                else:
                    cur.execute(sql)
                conn.commit()
                return cur.rowcount
            except Exception as e:
                logger.error("Database Execution Error: %s\nSQL: %s", e, sql)
                # Roll back so the persistent (SQLite thread-local) or pooled
                # (Postgres) connection is left in a clean, reusable state.
                try:
                    conn.rollback()
                except Exception:
                    pass
                raise

    def executemany(self, sql: str, records: list) -> int:
        """
        Execute a parameterised statement once per record in batch.
        Used for bulk INSERT operations (e.g. staging row batch insert).
        More efficient than calling execute() in a Python loop.

        Args:
            sql: SQL statement with positional ? placeholders (SQLite)
                 or %s placeholders (Postgres). Named :param style is
                 NOT supported for executemany — use positional only.
            records: List of tuples, one per row to insert.
        Returns:
            int: Total rows affected.
        """
        sql = self._translate_query(sql)

        logger.debug("Executing SQL: %s | records=%s", sql, records)
        
        with self.get_connection() as conn:
            try:
                cur = conn.cursor()
                if self.is_postgres:
                    from psycopg2.extras import execute_values
                    execute_values(cur, sql, records)
                else:
                    cur.executemany(sql, records)
                conn.commit()
                return cur.rowcount
            except Exception as e:
                logger.error("Database ExecuteMany Error: %s\nSQL: %s", e, sql)
                try:
                    conn.rollback()
                except Exception:
                    pass
                raise

    def log_activity(self, event_type, description, detail=None, user_id=None):
        """
        Log a system event to the log_activity table.

        Args:
            event_type: Category of the event (e.g., 'IMPORT', 'ERROR').
            description: Short summary of what happened.
            detail: Optional extended details or JSON payload.
            user_id: The acting user, when there is one (Inventory rewrite,
                     Phase F). Left None for system events — imports, syncs,
                     scheduled jobs — which have no actor. This is what makes
                     the COLLECTION_UPDATE half of the activity feed
                     owner-scopable; a row with a NULL user_id is not
                     attributable and the owner-scoped read excludes it.
        """
        # Audit logging must never crash the caller, even if the DB is broken.
        sql = (
            f"INSERT INTO {T.LOG_ACTIVITY} (event_type, description, detail, user_id) "
            "VALUES (%s, %s, %s, %s);"
        )
        try:
            self.execute(sql, (event_type, description, detail, user_id))
        except Exception as e:
            logger.error("log_activity failed (event_type=%s): %s", event_type, e)

    @staticmethod
    def _coerce_config(val_str, default):
        """Parse a raw config string to its inferred Python type."""
        if val_str is None:
            return default
        try:
            if val_str.isdigit() or (val_str.startswith('-') and val_str[1:].isdigit()):
                return int(val_str)
            if '.' in val_str:
                return float(val_str)
            if val_str.lower() in ("true", "1", "yes"):
                return True
            if val_str.lower() in ("false", "0", "no"):
                return False
            return val_str
        except (ValueError, TypeError):
            return val_str

    def get_config(self, key: str, default=None):
        """
        Retrieve a config value from app_config_settings.

        Results are cached for _CONFIG_TTL seconds (default 60 s) so
        hot-path callers (analytics, import rows) avoid repeated DB
        round trips for settings that rarely change.

        Args:
            key: Configuration key.
            default: Returned when the key is absent or its value is NULL.

        Returns:
            The stored value coerced to int / float / bool / str, or default.
        """
        now = monotonic()
        with _config_cache_lock:
            if key in _config_cache:
                val, exp = _config_cache[key]
                if now < exp:
                    return val

        sql = f"SELECT value FROM {T.APP_CONFIG_SETTINGS} WHERE key = %s LIMIT 1;"
        df = self.query(sql, (key,))
        val = self._coerce_config(
            df.iloc[0]["value"] if not df.empty else None,
            default,
        )

        with _config_cache_lock:
            _config_cache[key] = (val, now + _CONFIG_TTL)
        return val

    def get_current_season(self) -> int:
        """
        Return the application's notion of the current season/period.

        The *query* is application knowledge — MLBTracker resolves it from the
        `mlb_seasons` table — so it is supplied via
        `register_current_season_resolver()`. Caching, thread safety, error
        isolation and the calendar-year fallback stay here, which is why the
        29 call sites and the §S4 contract are unchanged by the split.

        With no resolver registered the calendar year is returned, which is a
        sane default for an application that has no season concept.

        Results are cached in memory for _CONFIG_TTL seconds.
        """
        import datetime
        now = monotonic()
        global _current_season_cache, _current_season_expires_at
        with _season_cache_lock:
            if _current_season_cache is not None and now < _current_season_expires_at:
                return _current_season_cache

        default_year = datetime.date.today().year
        if _current_season_resolver is None:
            val = default_year
        else:
            try:
                val = int(_current_season_resolver())
            except Exception as e:
                logger.warning(
                    "Failed to retrieve current season, defaulting to %d: %s",
                    default_year, e,
                )
                val = default_year

        with _season_cache_lock:
            _current_season_cache = val
            _current_season_expires_at = now + _CONFIG_TTL
        return val

    def invalidate_current_season(self) -> None:
        """Evict the cached current season value."""
        global _current_season_cache, _current_season_expires_at
        with _season_cache_lock:
            _current_season_cache = None
            _current_season_expires_at = 0.0

    def invalidate_config(self, key: str = None) -> None:
        """
        Evict one key (or all keys) from the in-process config cache.

        Called automatically by set_config so writes are immediately
        visible to subsequent get_config calls in the same process.
        """
        with _config_cache_lock:
            if key is None:
                _config_cache.clear()
            else:
                _config_cache.pop(key, None)
        if key is None:
            self.invalidate_current_season()


    def set_config(self, key, value):
        """
        Upsert a config value in app_config_settings and evict the cache entry.

        Args:
            key: Configuration key.
            value: New value (stored as string).

        Returns:
            bool: True if the write succeeded.
        """
        sql_upd = f"UPDATE {T.APP_CONFIG_SETTINGS} SET value = %s, modified_at = CURRENT_TIMESTAMP WHERE key = %s;"
        sql_ins = f"INSERT INTO {T.APP_CONFIG_SETTINGS} (key, value, modified_at) VALUES (%s, %s, CURRENT_TIMESTAMP);"
        sql_upd = self._translate_query(sql_upd)
        sql_ins = self._translate_query(sql_ins)
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql_upd, (str(value), key))
            if cur.rowcount == 0:
                cur.execute(sql_ins, (key, str(value)))
            conn.commit()
            ok = cur.rowcount > 0
        self.invalidate_config(key)
        return ok

    def get_all_config(self):
        """
        Return all application configuration as a list of dicts.

        Returns:
            list: A list of configuration dictionaries.
        """
        # Fetch all registered application settings for the Admin UI.
        sql = f"SELECT key, value, value_type, description, category, modified_at FROM {T.APP_CONFIG_SETTINGS} ORDER BY category, key;"
        df = self.query(sql)
        if df.empty:
            # Valid: Return empty list if no configuration settings exist in the database yet.
            return []

        results = []
        for _, row in df.iterrows():
            results.append({
                "key": row["key"],
                "value": row["value"],
                "value_type": row["value_type"],
                "description": row["description"],
                "category": row["category"],
                "updated_at": row["modified_at"]
            })
        return results

    @contextmanager
    def transaction(self):
        """
        Yield a single connection scoped to a unit of work, committing once on
        success and rolling back on exception. Use for multi-statement batches
        (e.g. imports) to avoid the per-call open/close + commit overhead of
        query()/execute()/executemany().

        The yielded connection is dedicated to the caller for the duration of
        the block — it is never the shared thread-local SQLite connection, so
        the caller has exclusive control over commit/rollback. For Postgres the
        connection is leased from (and returned to) the pool; for SQLite a
        fresh, short-lived connection is opened and closed per transaction.

        Yields:
            connection: a live sqlite3/psycopg2 connection with an open transaction.
        """
        if self.is_postgres:
            pool = self._get_pg_pool()
            conn = pool.getconn()
            try:
                yield conn
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                pool.putconn(conn)
        else:
            conn = self._create_sqlite_connection(explicit_transactions=True)
            conn.execute("BEGIN")
            try:
                yield conn
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()

    def query_conn(self, conn, sql, params=None):
        """Run a SELECT on an existing connection (no open/close). Returns DataFrame."""
        import pandas as pd
        sql = self._translate_query(sql)
        cur = conn.cursor()
        cur.execute(sql, params or [])
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description] if cur.description else []
        return pd.DataFrame([dict(zip(cols, r)) for r in rows], columns=cols)

    def execute_conn(self, conn, sql: str, params=None) -> int:
        """Run a single INSERT/UPDATE/DELETE on an existing connection (no open/close/commit)."""
        sql = self._translate_query(sql)
        cur = conn.cursor()
        if params:
            cur.execute(sql, params)
        else:
            cur.execute(sql)
        return cur.rowcount

    def executemany_conn(self, conn, sql: str, records: list) -> int:
        """Run executemany on an existing connection (no open/close/commit)."""
        sql = self._translate_query(sql)
        cur = conn.cursor()
        cur.executemany(sql, records)
        return cur.rowcount


# Global instance
db = DatabaseManager()
