"""
Module:  test_user_service.py
Layer:   bedrock-api/tests
Desc:    Coverage for the corners of user_service.py that the endpoint-level
         suites (test_auth.py, test_password_hashing.py, test_password_reset.py)
         exercise only incidentally: role assignment/revocation, the
         authenticate() null paths, JWT issuance/decoding and session
         revocation as unit-level primitives, and the §S004 precedence chain
         for the JWT signing secret.
"""
from __future__ import annotations

import uuid

import pytest

from bedrock.core import database
from bedrock.core.database import db
from bedrock.services import user_service as us


def _fresh_email() -> str:
    return f"us-{uuid.uuid4().hex[:10]}@test.example.com"


@pytest.fixture
def user():
    return us.create_user(email=_fresh_email(), password="a-real-password-1", default_role="member")


# ── get_user_by_id / get_user_by_email ──────────────────────────────────────

def test_get_user_by_id_missing_is_none():
    assert us.get_user_by_id(99999999) is None


def test_get_user_by_email_missing_is_none():
    assert us.get_user_by_email("nobody-at-all@example.com") is None


def test_get_user_by_email_is_case_insensitive(user):
    assert us.get_user_by_email(user.email.upper()).user_id == user.user_id


# ── create_user ──────────────────────────────────────────────────────────────

def test_create_user_rejects_a_duplicate_email(user):
    with pytest.raises(ValueError, match="already exists"):
        us.create_user(email=user.email, password="another-password-1")


def test_create_user_with_no_default_role_assigns_nothing():
    u = us.create_user(email=_fresh_email(), password="a-real-password-1", default_role=None)
    assert us.get_user_roles(u.user_id) == []


def test_create_user_with_an_unknown_role_raises():
    with pytest.raises(ValueError, match="unknown role"):
        us.create_user(email=_fresh_email(), password="a-real-password-1", default_role="not-a-real-role")


def test_create_user_with_no_password_is_oauth_only():
    u = us.create_user(email=_fresh_email(), password=None, default_role=None)
    assert us._get_password_hash(u.user_id) is None
    # An OAuth-only account cannot authenticate by password.
    assert us.authenticate(u.email, "") is None
    assert us.authenticate(u.email, "anything") is None


# ── mutation helpers ─────────────────────────────────────────────────────────

def test_touch_last_login_sets_a_timestamp(user):
    assert user.last_login_at is None
    us.touch_last_login(user.user_id)
    assert us.get_user_by_id(user.user_id).last_login_at is not None


def test_set_password_changes_the_stored_hash(user):
    us.set_password(user.user_id, "brand-new-password-1")
    assert us.authenticate(user.email, "a-real-password-1") is None
    assert us.authenticate(user.email, "brand-new-password-1") is not None


def test_set_verified_toggles(user):
    assert us.get_user_by_id(user.user_id).is_verified is False
    us.set_verified(user.user_id, True)
    assert us.get_user_by_id(user.user_id).is_verified is True
    us.set_verified(user.user_id, False)
    assert us.get_user_by_id(user.user_id).is_verified is False


def test_set_active_toggles_and_blocks_authentication(user):
    us.set_active(user.user_id, False)
    assert us.get_user_by_id(user.user_id).is_active is False
    assert us.authenticate(user.email, "a-real-password-1") is None

    us.set_active(user.user_id, True)
    assert us.authenticate(user.email, "a-real-password-1") is not None


# ── Role assignment ──────────────────────────────────────────────────────────

def test_assign_role_unknown_slug_raises(user):
    with pytest.raises(ValueError, match="unknown role"):
        us.assign_role(user.user_id, "not-a-real-role")


def test_assign_role_is_idempotent(user):
    us.assign_role(user.user_id, "member")
    us.assign_role(user.user_id, "member")
    assert us.get_user_roles(user.user_id) == ["member"]


def test_revoke_role_removes_it(user):
    assert us.revoke_role(user.user_id, "member") is True
    assert us.get_user_roles(user.user_id) == []


def test_revoke_role_unknown_slug_is_false(user):
    assert us.revoke_role(user.user_id, "not-a-real-role") is False


def test_get_user_roles_empty_for_a_roleless_user():
    u = us.create_user(email=_fresh_email(), password="a-real-password-1", default_role=None)
    assert us.get_user_roles(u.user_id) == []


# ── authenticate ─────────────────────────────────────────────────────────────

def test_authenticate_unknown_email_is_none():
    assert us.authenticate("nobody-at-all@example.com", "whatever") is None


def test_authenticate_wrong_password_is_none(user):
    assert us.authenticate(user.email, "the-wrong-password") is None


def test_authenticate_correct_password_returns_the_user(user):
    found = us.authenticate(user.email, "a-real-password-1")
    assert found is not None
    assert found.user_id == user.user_id


# ── JWT issuance / decoding / revocation ────────────────────────────────────

def test_create_access_token_round_trips_through_decode(user):
    token = us.create_access_token(user.user_id)
    claims = us.decode_token(token)
    assert claims is not None
    assert claims["sub"] == str(user.user_id)
    assert "jti" in claims and "exp" in claims and "iat" in claims


def test_decode_token_rejects_garbage():
    assert us.decode_token("not-a-jwt-at-all") is None


def test_is_session_revoked_true_for_an_unknown_jti():
    """An orphan token — signed but with no matching session row — is treated
    as revoked, not trusted."""
    assert us.is_session_revoked("some-jti-that-was-never-issued") is True


def test_is_session_revoked_false_right_after_issuance(user):
    token = us.create_access_token(user.user_id)
    jti = us.decode_token(token)["jti"]
    assert us.is_session_revoked(jti) is False


def test_revoke_session_marks_it_revoked(user):
    token = us.create_access_token(user.user_id)
    jti = us.decode_token(token)["jti"]
    assert us.revoke_session(jti) is True
    assert us.is_session_revoked(jti) is True


def test_revoke_all_sessions_revokes_every_live_session(user):
    tokens = [us.create_access_token(user.user_id) for _ in range(3)]
    jtis = [us.decode_token(t)["jti"] for t in tokens]

    revoked_count = us.revoke_all_sessions(user.user_id)
    assert revoked_count == 3
    assert all(us.is_session_revoked(jti) for jti in jtis)


def test_revoke_all_sessions_is_zero_when_none_are_live(user):
    assert us.revoke_all_sessions(user.user_id) == 0


# ── UserRecord.to_public ─────────────────────────────────────────────────────

def test_to_public_never_includes_the_password_hash(user):
    public = user.to_public()
    assert "hashed_password" not in public
    assert public["email"] == user.email
    assert public["user_id"] == user.user_id


# ── _jwt_secret precedence (§S004) ───────────────────────────────────────────

def test_jwt_secret_prefers_the_env_var(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "env-secret-value")
    assert us._jwt_secret() == "env-secret-value"


def test_jwt_secret_falls_back_to_stored_config(monkeypatch):
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.setattr(
        database.db, "get_config",
        lambda key, default=None: "db-secret-value" if key == "jwt_secret" else default,
    )
    assert us._jwt_secret() == "db-secret-value"


def test_jwt_secret_generates_and_persists_when_nothing_is_configured(monkeypatch):
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.setattr(
        database.db, "get_config",
        lambda key, default=None: default if key == "jwt_secret" else default,
    )
    persisted = {}
    monkeypatch.setattr(
        database.db, "set_config",
        lambda key, value: persisted.__setitem__(key, value),
    )
    generated = us._jwt_secret()
    assert generated
    assert persisted.get("jwt_secret") == generated
