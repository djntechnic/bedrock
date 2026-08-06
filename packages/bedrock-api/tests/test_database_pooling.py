"""
Module:  test_database_pooling.py
Layer:   api/tests
Desc:    Tests for thread-local SQLite connection pooling and clean shutdown
         in DatabaseManager. Covers: per-thread connection reuse, transaction
         isolation from the thread-local handle, pool cleanup, and reconnect
         after the connection is closed.
"""
import threading

import pytest

from bedrock.core.database import DatabaseManager


@pytest.fixture
def sqlite_db(tmp_path):
    """A DatabaseManager bound to an isolated temp SQLite file (not Postgres)."""
    mgr = DatabaseManager()
    mgr.is_postgres = False
    mgr.db_url = None
    mgr.sqlite_path = str(tmp_path / "pool_test.db")
    # Seed a trivial table to exercise reads/writes.
    mgr.execute("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)")
    yield mgr
    mgr.close_pool()


def test_thread_local_connection_is_reused(sqlite_db):
    """Repeated calls on the same thread return the identical connection."""
    c1 = sqlite_db._get_sqlite_connection()
    c2 = sqlite_db._get_sqlite_connection()
    assert c1 is c2


def test_different_threads_get_different_connections(sqlite_db):
    """Each thread gets its own dedicated thread-local connection."""
    conns = {}

    def grab(name):
        conns[name] = sqlite_db._get_sqlite_connection()

    main_conn = sqlite_db._get_sqlite_connection()
    t = threading.Thread(target=grab, args=("worker",))
    t.start()
    t.join()

    assert conns["worker"] is not main_conn


def test_get_connection_does_not_close_sqlite_handle(sqlite_db):
    """The persistent SQLite handle survives a get_connection() context exit."""
    with sqlite_db.get_connection() as conn:
        first = conn
    # Still usable after the context manager exits (not closed).
    first.execute("SELECT 1")
    # And the next acquisition returns the same persistent handle.
    assert sqlite_db._get_sqlite_connection() is first


def test_reconnect_after_close(sqlite_db):
    """A closed thread-local connection is transparently re-created."""
    conn = sqlite_db._get_sqlite_connection()
    conn.close()  # simulate a stale/closed handle
    fresh = sqlite_db._get_sqlite_connection()
    assert fresh is not conn
    # The fresh connection works.
    assert fresh.execute("SELECT 1").fetchone()[0] == 1


def test_writes_persist_across_calls(sqlite_db):
    """A committed write on the persistent connection is visible to later reads."""
    sqlite_db.execute("INSERT INTO t (v) VALUES (%s)", ("hello",))
    df = sqlite_db.query("SELECT v FROM t")
    assert list(df["v"]) == ["hello"]


def test_transaction_uses_dedicated_connection(sqlite_db):
    """transaction() yields a connection distinct from the thread-local one."""
    local_conn = sqlite_db._get_sqlite_connection()
    with sqlite_db.transaction() as txn_conn:
        assert txn_conn is not local_conn


def test_transaction_commit_isolation(sqlite_db):
    """transaction() commits atomically and the result is visible afterward."""
    with sqlite_db.transaction() as conn:
        sqlite_db.execute_conn(conn, "INSERT INTO t (v) VALUES (%s)", ("txn",))
    df = sqlite_db.query("SELECT v FROM t WHERE v = %s", ("txn",))
    assert len(df) == 1


def test_transaction_rolls_back_on_error(sqlite_db):
    """An exception inside transaction() rolls back all of its writes."""
    with pytest.raises(RuntimeError):
        with sqlite_db.transaction() as conn:
            sqlite_db.execute_conn(conn, "INSERT INTO t (v) VALUES (%s)", ("doomed",))
            raise RuntimeError("boom")
    df = sqlite_db.query("SELECT v FROM t WHERE v = %s", ("doomed",))
    assert df.empty


def test_failed_execute_leaves_connection_usable(sqlite_db):
    """A failed statement rolls back so the persistent connection stays clean."""
    with pytest.raises(Exception):
        sqlite_db.execute("INSERT INTO nonexistent_table (x) VALUES (1)")
    # Connection still works for subsequent statements.
    sqlite_db.execute("INSERT INTO t (v) VALUES (%s)", ("after_error",))
    df = sqlite_db.query("SELECT v FROM t WHERE v = %s", ("after_error",))
    assert len(df) == 1


def test_close_pool_clears_thread_local(sqlite_db):
    """close_pool() drops the thread-local handle; a new one is created next."""
    conn = sqlite_db._get_sqlite_connection()
    sqlite_db.close_pool()
    assert getattr(sqlite_db._local, "sqlite_conn", None) is None
    new_conn = sqlite_db._get_sqlite_connection()
    assert new_conn is not conn


def test_close_pool_is_idempotent(sqlite_db):
    """Calling close_pool() multiple times never raises."""
    sqlite_db._get_sqlite_connection()
    sqlite_db.close_pool()
    sqlite_db.close_pool()  # should be a no-op, not an error


def test_executemany_logs_full_sql_and_records(sqlite_db, caplog):
    """executemany() logs SQL template and full batch records list."""
    records = [("row1",), ("row2",)]
    with caplog.at_level("DEBUG"):
        sqlite_db.executemany("INSERT INTO t (v) VALUES (%s)", records)

    df = sqlite_db.query("SELECT v FROM t")
    assert len(df) == 2
    assert "Executing SQL:" in caplog.text
    assert "records=" in caplog.text
    assert "row1" in caplog.text
    assert "row2" in caplog.text


def test_validate_connection(sqlite_db, caplog):
    """validate_connection() executes lightweight validation query and logs database info."""
    import logging
    with caplog.at_level(logging.INFO):
        msg = sqlite_db.validate_connection()
        assert "pool_test.db" in msg
        assert "Database connection validated" in caplog.text


