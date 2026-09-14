"""
Module:  test_admin_users_service.py
Layer:   api/tests
Desc:    §S005 coverage for admin_users_service.py — the Admin Users,
         Sessions, and Security Log data-access helpers. Runs against the
         in-memory SQLite fixture, no FastAPI.
"""
import uuid

import pytest

from bedrock.core.database import db
from bedrock.services.admin_users_service import (
    get_admin_user_row,
    get_session_owner,
    get_admin_users_counts,
    list_admin_sessions,
    list_admin_user_rows,
    snapshot_config_row,
)


def _make_user(*, is_active: int = 1) -> int:
    email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    db.execute(
        "INSERT INTO auth_users (email, is_active) VALUES (%s, %s)",
        (email, is_active),
    )
    df = db.query("SELECT user_id FROM auth_users WHERE email = %s", (email,))
    return int(df.iloc[0]["user_id"])


# ── get_admin_user_row ────────────────────────────────────────────────────────

def test_get_admin_user_row_returns_row_for_existing_user():
    user_id = _make_user()
    row = get_admin_user_row(user_id)
    assert row is not None
    assert row["user_id"] == user_id
    assert {"email", "display_name", "is_active", "is_verified",
             "is_superuser", "created_at", "last_login_at"}.issubset(row.keys())


def test_get_admin_user_row_returns_none_when_missing():
    assert get_admin_user_row(-1) is None


# ── list_admin_user_rows ──────────────────────────────────────────────────────

def test_list_admin_user_rows_includes_created_user():
    user_id = _make_user()
    rows = list_admin_user_rows()
    assert isinstance(rows, list)
    assert any(r["user_id"] == user_id for r in rows)


def test_list_admin_user_rows_ordered_newest_first():
    # created_at has second-level resolution, so two rows inserted back to
    # back can tie; give them distinct explicit timestamps to make the
    # ordering assertion deterministic rather than depending on insert order.
    older_email = f"older_{uuid.uuid4().hex[:8]}@example.com"
    newer_email = f"newer_{uuid.uuid4().hex[:8]}@example.com"
    db.execute(
        "INSERT INTO auth_users (email, created_at) VALUES (%s, '2020-01-01 00:00:00')",
        (older_email,),
    )
    db.execute(
        "INSERT INTO auth_users (email, created_at) VALUES (%s, '2030-01-01 00:00:00')",
        (newer_email,),
    )
    rows = list_admin_user_rows()
    emails = [r["email"] for r in rows]
    assert emails.index(newer_email) < emails.index(older_email)


# ── get_admin_users_counts ────────────────────────────────────────────────────

def test_get_admin_users_counts_reflects_active_and_inactive():
    before = get_admin_users_counts()
    _make_user(is_active=1)
    _make_user(is_active=0)
    after = get_admin_users_counts()

    assert after["total"] == before["total"] + 2
    assert after["active"] == before["active"] + 1
    assert after["inactive"] == before["inactive"] + 1
    assert after["total"] == after["active"] + after["inactive"]


def test_get_admin_users_counts_never_negative_inactive():
    counts = get_admin_users_counts()
    assert counts["inactive"] >= 0


# ── list_admin_sessions / get_session_owner ───────────────────────────────────

def test_list_admin_sessions_joins_user_email():
    user_id = _make_user()
    session_id = uuid.uuid4().hex
    db.execute(
        "INSERT INTO auth_sessions (session_id, user_id, expires_at) "
        "VALUES (%s, %s, datetime('now', '+1 hour'))",
        (session_id, user_id),
    )
    rows = list_admin_sessions()
    matches = [r for r in rows if r["session_id"] == session_id]
    assert len(matches) == 1
    assert matches[0]["user_id"] == user_id
    assert "email" in matches[0]


def test_list_admin_sessions_empty_when_no_sessions():
    db.execute("DELETE FROM auth_sessions")
    rows = list_admin_sessions()
    assert rows == []


def test_get_session_owner_returns_user_id_for_known_session():
    user_id = _make_user()
    session_id = uuid.uuid4().hex
    db.execute(
        "INSERT INTO auth_sessions (session_id, user_id, expires_at) "
        "VALUES (%s, %s, datetime('now', '+1 hour'))",
        (session_id, user_id),
    )
    assert get_session_owner(session_id) == user_id


def test_get_session_owner_returns_none_for_unknown_session():
    assert get_session_owner("__no_such_session__") is None


# ── snapshot_config_row ───────────────────────────────────────────────────────

@pytest.mark.usefixtures("clean_config")
def test_snapshot_config_row_returns_scalar_only_mapping():
    key = f"system_snapshot_{uuid.uuid4().hex[:8]}"
    db.execute(
        "INSERT INTO app_config_settings (key, value, value_type, category) "
        "VALUES (%s, %s, %s, %s)",
        (key, "42", "integer", "system"),
    )
    snap = snapshot_config_row(key)
    assert snap is not None
    assert snap["key"] == key
    for v in snap.values():
        assert v is None or isinstance(v, (int, float, str, bool))


@pytest.mark.usefixtures("clean_config")
def test_snapshot_config_row_returns_none_when_missing():
    assert snapshot_config_row("__does_not_exist__") is None
