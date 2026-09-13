"""
Module:  test_email_token_service.py
Layer:   bedrock-api/tests
Desc:    Coverage for bedrock.services.email_token_service that
         test_email_tokens.py does not exercise: `revoke_outstanding`'s
         direct return value and its no-op case, and the `database`
         dependency-injection seam on `issue`/`consume`/`revoke_outstanding`.
"""
from __future__ import annotations

import hashlib
import os
import sqlite3
import tempfile
import uuid

import pytest

from bedrock.core.database import db, DatabaseManager
from bedrock.core.schema_catalog import Tables as T
from bedrock.services import email_token_service as tokens
from bedrock.services import user_service as us


@pytest.fixture
def user(platform_db):
    return us.create_user(
        email=f"ets-{uuid.uuid4().hex[:12]}@example.com",
        password="correct horse battery staple",
        default_role="member",
    )


class TestRevokeOutstanding:
    def test_no_outstanding_tokens_returns_zero(self, user):
        assert tokens.revoke_outstanding(user.user_id, tokens.PURPOSE_PASSWORD_RESET) == 0

    def test_revokes_exactly_the_live_ones_for_that_purpose(self, user):
        tokens.issue(user.user_id, tokens.PURPOSE_PASSWORD_RESET)
        tokens.issue(user.user_id, tokens.PURPOSE_EMAIL_VERIFICATION)

        revoked = tokens.revoke_outstanding(user.user_id, tokens.PURPOSE_PASSWORD_RESET)
        assert revoked == 1

        # The other purpose is untouched.
        verify_issued = tokens.issue(user.user_id, tokens.PURPOSE_EMAIL_VERIFICATION)
        assert tokens.consume(verify_issued.token, tokens.PURPOSE_EMAIL_VERIFICATION) == user.user_id

    def test_already_consumed_tokens_are_not_double_counted(self, user):
        issued = tokens.issue(user.user_id, tokens.PURPOSE_PASSWORD_RESET)
        tokens.consume(issued.token, tokens.PURPOSE_PASSWORD_RESET)
        # Nothing live left to revoke.
        assert tokens.revoke_outstanding(user.user_id, tokens.PURPOSE_PASSWORD_RESET) == 0

    def test_revoked_rows_are_marked_consumed_not_deleted(self, user):
        issued = tokens.issue(user.user_id, tokens.PURPOSE_PASSWORD_RESET)
        tokens.revoke_outstanding(user.user_id, tokens.PURPOSE_PASSWORD_RESET)
        df = db.query(
            f"SELECT consumed_at FROM {T.AUTH_EMAIL_TOKENS} WHERE token_hash = %s",
            (hashlib.sha256(issued.token.encode()).hexdigest(),),
        )
        assert df.iloc[0]["consumed_at"] is not None

    def test_scoped_to_the_user(self, user):
        other = us.create_user(
            email=f"ets-other-{uuid.uuid4().hex[:12]}@example.com",
            password="correct horse battery staple",
            default_role="member",
        )
        other_issued = tokens.issue(other.user_id, tokens.PURPOSE_PASSWORD_RESET)
        tokens.revoke_outstanding(user.user_id, tokens.PURPOSE_PASSWORD_RESET)
        assert tokens.consume(other_issued.token, tokens.PURPOSE_PASSWORD_RESET) == other.user_id


class TestDatabaseInjection:
    """`issue`/`consume`/`revoke_outstanding` all take an optional `database`
    override so callers can run inside their own transaction/connection
    instead of the module-level singleton."""

    @pytest.fixture
    def other_db(self):
        tmpdir = tempfile.mkdtemp(prefix="bedrock-ets-inject-")
        path = os.path.join(tmpdir, "inject.db")
        baseline = os.path.join(
            os.path.dirname(__file__), "..", "bedrock", "schema", "baseline.sql"
        )
        seed = os.path.join(os.path.dirname(__file__), "..", "bedrock", "schema", "seed.sql")
        conn = sqlite3.connect(path)
        conn.executescript(open(baseline, encoding="utf-8").read())
        conn.executescript(open(seed, encoding="utf-8").read())
        conn.commit()
        conn.close()

        other = DatabaseManager()
        other.sqlite_path = path
        other.is_postgres = False
        other.db_url = None

        yield other

        other.close_pool()
        for suffix in ("", "-wal", "-shm", "-journal"):
            p = path + suffix
            if os.path.exists(p):
                try:
                    os.remove(p)
                except OSError:
                    pass

    def test_issue_and_consume_round_trip_through_injected_db(self, other_db):
        u = us.create_user(
            email=f"ets-inject-{uuid.uuid4().hex[:12]}@example.com",
            password="correct horse battery staple",
            default_role="member",
            database=other_db,
        )
        issued = tokens.issue(u.user_id, tokens.PURPOSE_PASSWORD_RESET, database=other_db)
        assert tokens.consume(
            issued.token, tokens.PURPOSE_PASSWORD_RESET, database=other_db
        ) == u.user_id

    def test_injected_db_tokens_are_invisible_to_the_default_db(self, other_db, user):
        u = us.create_user(
            email=f"ets-inject2-{uuid.uuid4().hex[:12]}@example.com",
            password="correct horse battery staple",
            default_role="member",
            database=other_db,
        )
        issued = tokens.issue(u.user_id, tokens.PURPOSE_PASSWORD_RESET, database=other_db)
        # The default `db` singleton has no such user or token.
        assert tokens.consume(issued.token, tokens.PURPOSE_PASSWORD_RESET) is None

    def test_revoke_outstanding_targets_the_injected_db(self, other_db):
        u = us.create_user(
            email=f"ets-inject3-{uuid.uuid4().hex[:12]}@example.com",
            password="correct horse battery staple",
            default_role="member",
            database=other_db,
        )
        tokens.issue(u.user_id, tokens.PURPOSE_PASSWORD_RESET, database=other_db)
        revoked = tokens.revoke_outstanding(u.user_id, tokens.PURPOSE_PASSWORD_RESET, database=other_db)
        assert revoked == 1


class TestPurgeExpiredEdgeCases:
    def test_older_than_days_zero_still_purges_already_expired_rows(self, user):
        issued = tokens.issue(user.user_id, tokens.PURPOSE_PASSWORD_RESET)
        from datetime import datetime, timedelta, timezone

        past = (datetime.now(timezone.utc) - timedelta(minutes=1)).strftime("%Y-%m-%d %H:%M:%S")
        db.execute(
            f"UPDATE {T.AUTH_EMAIL_TOKENS} SET expires_at = %s WHERE token_hash = %s",
            (past, hashlib.sha256(issued.token.encode()).hexdigest()),
        )
        assert tokens.purge_expired(older_than_days=0) >= 1

    def test_negative_older_than_days_is_floored_to_zero(self, user):
        """A negative cutoff must not become a future date that purges live,
        unexpired tokens."""
        issued = tokens.issue(user.user_id, tokens.PURPOSE_PASSWORD_RESET)
        tokens.purge_expired(older_than_days=-30)
        assert tokens.consume(issued.token, tokens.PURPOSE_PASSWORD_RESET) == user.user_id

    def test_no_expired_rows_returns_zero(self, user):
        tokens.issue(user.user_id, tokens.PURPOSE_PASSWORD_RESET)
        assert tokens.purge_expired(older_than_days=9999) == 0
