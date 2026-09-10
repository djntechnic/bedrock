"""
Module:  help_service.py
Layer:   bedrock-api/services
Desc:    Config-driven in-app quick help entries service:
         - Public retrieval of topic entries by topic_key
         - Admin listing, creation, patching, and deletion with audit tracking
"""
from __future__ import annotations

from typing import Any
from loguru import logger

from bedrock.core.database import db, DatabaseManager
from bedrock.core.schema_catalog import Tables as T


def _get_db(database: DatabaseManager | None = None) -> DatabaseManager:
    return database or db


def get_help_entry(topic_key: str, *, database: DatabaseManager | None = None) -> dict[str, Any] | None:
    """Retrieve a single help entry by its unique topic key."""
    d = _get_db(database)
    df = d.query(
        f"""
        SELECT help_entry_id, topic_key, title, body_markdown, doc_url, doc_label,
               created_at, created_by, modified_at, modified_by
          FROM {T.APP_HELP_ENTRIES}
         WHERE topic_key = %s
        """,
        (topic_key,),
    )
    if df.empty:
        return None
    return dict(df.to_dict(orient="records")[0])


def list_help_entries(*, database: DatabaseManager | None = None) -> list[dict[str, Any]]:
    """Retrieve all help entries ordered by topic_key."""
    d = _get_db(database)
    df = d.query(
        f"""
        SELECT help_entry_id, topic_key, title, body_markdown, doc_url, doc_label,
               created_at, created_by, modified_at, modified_by
          FROM {T.APP_HELP_ENTRIES}
         ORDER BY topic_key
        """
    )
    if df.empty:
        return []
    return [dict(r) for r in df.to_dict(orient="records")]


def create_help_entry(
    entry_data: dict[str, Any],
    actor: str = "System",
    *,
    database: DatabaseManager | None = None,
) -> dict[str, Any]:
    """Create a new help entry."""
    d = _get_db(database)
    topic_key = entry_data["topic_key"]
    title = entry_data["title"]
    body_md = entry_data["body_markdown"]
    doc_url = entry_data.get("doc_url")
    doc_label = entry_data.get("doc_label")

    with d.transaction() as conn:
        d.execute_conn(
            conn,
            f"""
            INSERT INTO {T.APP_HELP_ENTRIES}
                (topic_key, title, body_markdown, doc_url, doc_label,
                 created_at, created_by, modified_at, modified_by)
            VALUES (%s, %s, %s, %s, %s, datetime('now'), %s, datetime('now'), %s)
            """,
            (topic_key, title, body_md, doc_url, doc_label, actor, actor),
        )
    logger.info("Created help entry topic_key={} by={}", topic_key, actor)
    created = get_help_entry(topic_key, database=d)
    if not created:
        raise RuntimeError(f"Failed to create help entry '{topic_key}'")
    return created


def update_help_entry(
    topic_key: str,
    updates: dict[str, Any],
    actor: str = "System",
    *,
    database: DatabaseManager | None = None,
) -> dict[str, Any] | None:
    """Update fields on an existing help entry."""
    d = _get_db(database)
    existing = get_help_entry(topic_key, database=d)
    if not existing:
        return None

    title = updates.get("title", existing["title"])
    body_md = updates.get("body_markdown", existing["body_markdown"])
    doc_url = updates.get("doc_url", existing["doc_url"])
    doc_label = updates.get("doc_label", existing["doc_label"])

    with d.transaction() as conn:
        d.execute_conn(
            conn,
            f"""
            UPDATE {T.APP_HELP_ENTRIES}
               SET title = %s,
                   body_markdown = %s,
                   doc_url = %s,
                   doc_label = %s,
                   modified_at = datetime('now'),
                   modified_by = %s
             WHERE topic_key = %s
            """,
            (title, body_md, doc_url, doc_label, actor, topic_key),
        )
    logger.info("Updated help entry topic_key={} by={}", topic_key, actor)
    return get_help_entry(topic_key, database=d)


def delete_help_entry(
    topic_key: str,
    actor: str = "System",
    *,
    database: DatabaseManager | None = None,
) -> bool:
    """Delete a help entry by topic key."""
    d = _get_db(database)
    existing = get_help_entry(topic_key, database=d)
    if not existing:
        return False
    d.execute(f"DELETE FROM {T.APP_HELP_ENTRIES} WHERE topic_key = %s", (topic_key,))
    logger.info("Deleted help entry topic_key={} by={}", topic_key, actor)
    return True
