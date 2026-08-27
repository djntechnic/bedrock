"""
Module:  test_email_tokens.py
Layer:   bedrock-api/tests
Desc:    The token store behind the invite, password-reset and verification
         flows.

         These tests are mostly about the ways a token must *stop* working —
         expiry, reuse, supersession, wrong purpose. The happy path is one
         line; every other case is a way an account gets taken over if the
         store gets it wrong.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone

import pytest

from bedrock.core.database import db
from bedrock.core.schema_catalog import Tables as T
from bedrock.services import email_token_service as tokens
from bedrock.services import user_service as us


@pytest.fixture
def user(platform_db):
    """A throwaway account to hang tokens off."""
    import uuid

    return us.create_user(
        email=f"token-{uuid.uuid4().hex[:12]}@example.com",
        password="correct horse battery staple",
        default_role="member",
    )


@pytest.fixture
def other_user(platform_db):
    import uuid

    return us.create_user(
        email=f"other-{uuid.uuid4().hex[:12]}@example.com",
        password="correct horse battery staple",
        default_role="member",
    )


def _expire(token: str) -> None:
    """Backdate a token's expiry so it is already past."""
    past = (datetime.now(timezone.utc) - timedelta(minutes=5)).strftime(
        "%Y-%m-%d %H:%M:%S"
    )
    db.execute(
        f"UPDATE {T.AUTH_EMAIL_TOKENS} SET expires_at = %s WHERE token_hash = %s",
        (past, hashlib.sha256(token.encode()).hexdigest()),
    )


class TestIssuing:
    def test_round_trip(self, user):
        issued = tokens.issue(user.user_id, tokens.PURPOSE_PASSWORD_RESET)
        assert tokens.consume(issued.token, tokens.PURPOSE_PASSWORD_RESET) == user.user_id

    @pytest.mark.parametrize(
        "purpose",
        [tokens.PURPOSE_INVITE, tokens.PURPOSE_PASSWORD_RESET,
         tokens.PURPOSE_EMAIL_VERIFICATION],
    )
    def test_every_purpose_round_trips(self, user, purpose):
        issued = tokens.issue(user.user_id, purpose)
        assert tokens.consume(issued.token, purpose) == user.user_id

    def test_unknown_purpose_raises(self, user):
        """A code constant, not an admin-editable value — so this is a bug."""
        with pytest.raises(ValueError, match="unknown token purpose"):
            tokens.issue(user.user_id, "teleportation")

    def test_tokens_are_unique(self, user):
        first = tokens.issue(user.user_id, tokens.PURPOSE_PASSWORD_RESET).token
        second = tokens.issue(user.user_id, tokens.PURPOSE_PASSWORD_RESET).token
        assert first != second

    def test_the_plaintext_token_is_never_stored(self, user):
        """A database read must not yield a working reset link."""
        issued = tokens.issue(user.user_id, tokens.PURPOSE_PASSWORD_RESET)
        stored = db.query(
            f"SELECT token_hash FROM {T.AUTH_EMAIL_TOKENS} WHERE user_id = %s",
            (user.user_id,),
        )
        hashes = stored["token_hash"].tolist()
        assert issued.token not in hashes
        assert hashlib.sha256(issued.token.encode()).hexdigest() in hashes

    def test_expiry_is_in_the_future(self, user):
        issued = tokens.issue(user.user_id, tokens.PURPOSE_PASSWORD_RESET)
        parsed = datetime.strptime(issued.expires_at, "%Y-%m-%d %H:%M:%S")
        assert parsed.replace(tzinfo=timezone.utc) > datetime.now(timezone.utc)

    def test_human_readable_window_is_supplied(self, user):
        """Normalised upward: the default is 60 minutes, and an email should
        say "1 hour"."""
        issued = tokens.issue(user.user_id, tokens.PURPOSE_PASSWORD_RESET)
        assert issued.expires_in == "1 hour"


class TestSingleUse:
    def test_a_token_works_once(self, user):
        issued = tokens.issue(user.user_id, tokens.PURPOSE_PASSWORD_RESET)
        assert tokens.consume(issued.token, tokens.PURPOSE_PASSWORD_RESET) is not None
        assert tokens.consume(issued.token, tokens.PURPOSE_PASSWORD_RESET) is None

    def test_issuing_supersedes_the_previous_token(self, user):
        """Two clicks on "reset" must not leave two live links in an inbox."""
        first = tokens.issue(user.user_id, tokens.PURPOSE_PASSWORD_RESET)
        tokens.issue(user.user_id, tokens.PURPOSE_PASSWORD_RESET)
        assert tokens.consume(first.token, tokens.PURPOSE_PASSWORD_RESET) is None

    def test_supersession_is_scoped_to_the_purpose(self, user):
        """A new reset link must not silently kill a pending verification."""
        verify = tokens.issue(user.user_id, tokens.PURPOSE_EMAIL_VERIFICATION)
        tokens.issue(user.user_id, tokens.PURPOSE_PASSWORD_RESET)
        assert tokens.consume(
            verify.token, tokens.PURPOSE_EMAIL_VERIFICATION
        ) == user.user_id

    def test_supersession_is_scoped_to_the_user(self, user, other_user):
        theirs = tokens.issue(other_user.user_id, tokens.PURPOSE_PASSWORD_RESET)
        tokens.issue(user.user_id, tokens.PURPOSE_PASSWORD_RESET)
        assert tokens.consume(
            theirs.token, tokens.PURPOSE_PASSWORD_RESET
        ) == other_user.user_id


class TestRejection:
    """Every rejection returns the same undifferentiated None."""

    def test_unknown_token(self, platform_db):
        assert tokens.consume("nope", tokens.PURPOSE_PASSWORD_RESET) is None

    def test_empty_token(self, platform_db):
        assert tokens.consume("", tokens.PURPOSE_PASSWORD_RESET) is None

    def test_expired_token(self, user):
        issued = tokens.issue(user.user_id, tokens.PURPOSE_PASSWORD_RESET)
        _expire(issued.token)
        assert tokens.consume(issued.token, tokens.PURPOSE_PASSWORD_RESET) is None

    def test_wrong_purpose(self, user):
        """A verification link must not be redeemable as a password reset."""
        issued = tokens.issue(user.user_id, tokens.PURPOSE_EMAIL_VERIFICATION)
        assert tokens.consume(issued.token, tokens.PURPOSE_PASSWORD_RESET) is None

    def test_wrong_purpose_does_not_consume_it(self, user):
        """Presenting it wrongly must not be a way to burn someone's token."""
        issued = tokens.issue(user.user_id, tokens.PURPOSE_EMAIL_VERIFICATION)
        tokens.consume(issued.token, tokens.PURPOSE_PASSWORD_RESET)
        assert tokens.consume(
            issued.token, tokens.PURPOSE_EMAIL_VERIFICATION
        ) == user.user_id

    def test_an_unreadable_expiry_is_treated_as_expired(self, user):
        issued = tokens.issue(user.user_id, tokens.PURPOSE_PASSWORD_RESET)
        db.execute(
            f"UPDATE {T.AUTH_EMAIL_TOKENS} SET expires_at = %s WHERE token_hash = %s",
            ("not a timestamp", hashlib.sha256(issued.token.encode()).hexdigest()),
        )
        assert tokens.consume(issued.token, tokens.PURPOSE_PASSWORD_RESET) is None


class TestAcceptedPurposes:
    """`consume` takes a tuple so one endpoint serves reset and invitation."""

    def test_a_tuple_accepts_either(self, user):
        both = (tokens.PURPOSE_PASSWORD_RESET, tokens.PURPOSE_INVITE)
        invite = tokens.issue(user.user_id, tokens.PURPOSE_INVITE)
        assert tokens.consume(invite.token, both) == user.user_id
        reset = tokens.issue(user.user_id, tokens.PURPOSE_PASSWORD_RESET)
        assert tokens.consume(reset.token, both) == user.user_id

    def test_a_tuple_still_excludes_others(self, user):
        both = (tokens.PURPOSE_PASSWORD_RESET, tokens.PURPOSE_INVITE)
        verify = tokens.issue(user.user_id, tokens.PURPOSE_EMAIL_VERIFICATION)
        assert tokens.consume(verify.token, both) is None


class TestConfiguredLifetime:
    @pytest.fixture
    def config(self, monkeypatch):
        from bedrock.core import database

        values: dict[str, object] = {}
        real = database.db.get_config
        monkeypatch.setattr(
            database.db, "get_config",
            lambda key, default=None: values.get(key, real(key, default)),
        )
        return values

    def test_ttl_is_read_from_config(self, user, config):
        config["auth_password_reset_ttl_minutes"] = 5
        assert tokens.issue(
            user.user_id, tokens.PURPOSE_PASSWORD_RESET
        ).expires_in == "5 minutes"

    def test_a_non_numeric_ttl_falls_back(self, user, config):
        config["auth_password_reset_ttl_minutes"] = "soon"
        assert tokens.issue(
            user.user_id, tokens.PURPOSE_PASSWORD_RESET
        ).expires_in == "1 hour"

    def test_a_zero_ttl_falls_back(self, user, config):
        """Honouring 0 would mint tokens that are expired on arrival."""
        config["auth_password_reset_ttl_minutes"] = 0
        assert tokens.issue(
            user.user_id, tokens.PURPOSE_PASSWORD_RESET
        ).expires_in == "1 hour"

    def test_a_negative_ttl_falls_back(self, user, config):
        config["auth_password_reset_ttl_minutes"] = -10
        assert tokens.issue(
            user.user_id, tokens.PURPOSE_PASSWORD_RESET
        ).expires_in == "1 hour"

    @pytest.mark.parametrize(
        "purpose,expected",
        [
            (tokens.PURPOSE_INVITE, "7 days"),
            (tokens.PURPOSE_EMAIL_VERIFICATION, "2 days"),
        ],
    )
    def test_defaults_read_naturally(self, user, purpose, expected):
        assert tokens.issue(user.user_id, purpose).expires_in == expected


class TestPurge:
    def test_purge_removes_long_expired_rows(self, user):
        issued = tokens.issue(user.user_id, tokens.PURPOSE_PASSWORD_RESET)
        long_ago = (datetime.now(timezone.utc) - timedelta(days=90)).strftime(
            "%Y-%m-%d %H:%M:%S"
        )
        db.execute(
            f"UPDATE {T.AUTH_EMAIL_TOKENS} SET expires_at = %s WHERE token_hash = %s",
            (long_ago, hashlib.sha256(issued.token.encode()).hexdigest()),
        )
        assert tokens.purge_expired(older_than_days=30) >= 1
        assert tokens.consume(issued.token, tokens.PURPOSE_PASSWORD_RESET) is None

    def test_purge_keeps_recent_rows(self, user):
        issued = tokens.issue(user.user_id, tokens.PURPOSE_PASSWORD_RESET)
        tokens.purge_expired(older_than_days=30)
        assert tokens.consume(
            issued.token, tokens.PURPOSE_PASSWORD_RESET
        ) == user.user_id
