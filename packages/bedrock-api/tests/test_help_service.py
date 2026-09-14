"""
Module:  test_help_service.py
Layer:   api/tests
Desc:    §S005 coverage for help_service.py — the in-app quick-help entries
         CRUD surface. Runs against the in-memory SQLite fixture, no FastAPI.
"""
import uuid

import pytest

from bedrock.core.database import db
from bedrock.services.help_service import (
    create_help_entry,
    delete_help_entry,
    get_help_entry,
    list_help_entries,
    update_help_entry,
)


def _topic_key(prefix: str = "probe") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


@pytest.fixture
def cleanup_topics():
    created: list[str] = []
    yield created
    for key in created:
        db.execute("DELETE FROM app_help_entries WHERE topic_key = %s", (key,))


# ── get_help_entry ─────────────────────────────────────────────────────────

def test_get_help_entry_returns_none_when_missing():
    assert get_help_entry("__does_not_exist__") is None


def test_get_help_entry_returns_created_row(cleanup_topics):
    key = _topic_key("get")
    create_help_entry({
        "topic_key": key, "title": "Title", "body_markdown": "Body",
    })
    cleanup_topics.append(key)

    row = get_help_entry(key)
    assert row is not None
    assert row["topic_key"] == key
    assert row["title"] == "Title"
    assert row["body_markdown"] == "Body"
    assert row["doc_url"] is None
    assert row["doc_label"] is None


# ── list_help_entries ──────────────────────────────────────────────────────

def test_list_help_entries_empty_when_none_present():
    db.execute("DELETE FROM app_help_entries")
    assert list_help_entries() == []


def test_list_help_entries_ordered_by_topic_key(cleanup_topics):
    key_a = "aaa_" + _topic_key()
    key_z = "zzz_" + _topic_key()
    create_help_entry({"topic_key": key_z, "title": "Z", "body_markdown": "z"})
    create_help_entry({"topic_key": key_a, "title": "A", "body_markdown": "a"})
    cleanup_topics.extend([key_a, key_z])

    rows = list_help_entries()
    keys_in_order = [r["topic_key"] for r in rows if r["topic_key"] in (key_a, key_z)]
    assert keys_in_order == [key_a, key_z]


# ── create_help_entry ──────────────────────────────────────────────────────

def test_create_help_entry_persists_all_fields(cleanup_topics):
    key = _topic_key("create")
    result = create_help_entry(
        {
            "topic_key": key,
            "title": "How to export",
            "body_markdown": "# Export\nUse the button.",
            "doc_url": "https://example.com/docs",
            "doc_label": "Full docs",
        },
        actor="tester@example.com",
    )
    cleanup_topics.append(key)

    assert result["topic_key"] == key
    assert result["doc_url"] == "https://example.com/docs"
    assert result["doc_label"] == "Full docs"
    assert result["created_by"] == "tester@example.com"
    assert result["modified_by"] == "tester@example.com"


def test_create_help_entry_raises_on_missing_required_field(cleanup_topics):
    with pytest.raises(KeyError):
        create_help_entry({"topic_key": _topic_key("missing")})


def test_create_help_entry_raises_conflict_on_duplicate_topic_key(cleanup_topics):
    key = _topic_key("dup")
    create_help_entry({"topic_key": key, "title": "T", "body_markdown": "B"})
    cleanup_topics.append(key)

    with pytest.raises(Exception):
        create_help_entry({"topic_key": key, "title": "T2", "body_markdown": "B2"})


# ── update_help_entry ──────────────────────────────────────────────────────

def test_update_help_entry_updates_only_provided_fields(cleanup_topics):
    key = _topic_key("update")
    create_help_entry({
        "topic_key": key, "title": "Old title", "body_markdown": "Old body",
        "doc_url": "https://old.example.com",
    })
    cleanup_topics.append(key)

    updated = update_help_entry(key, {"title": "New title"}, actor="editor")
    assert updated is not None
    assert updated["title"] == "New title"
    assert updated["body_markdown"] == "Old body"
    assert updated["doc_url"] == "https://old.example.com"
    assert updated["modified_by"] == "editor"


def test_update_help_entry_returns_none_when_missing():
    assert update_help_entry("__does_not_exist__", {"title": "x"}) is None


# ── delete_help_entry ──────────────────────────────────────────────────────

def test_delete_help_entry_removes_row_and_returns_true(cleanup_topics):
    key = _topic_key("delete")
    create_help_entry({"topic_key": key, "title": "T", "body_markdown": "B"})

    assert delete_help_entry(key) is True
    assert get_help_entry(key) is None


def test_delete_help_entry_returns_false_when_missing():
    assert delete_help_entry("__does_not_exist__") is False
