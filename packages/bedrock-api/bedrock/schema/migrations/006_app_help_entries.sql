-- Platform migration 006 — app_help_entries for config-driven in-app quick help system (#69)
--
-- Table: app_help_entries
-- Supports topic-based in-app help popovers with markdown bodies and external doc links.

CREATE TABLE IF NOT EXISTS app_help_entries (
    help_entry_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_key       TEXT    NOT NULL UNIQUE,
    title           TEXT    NOT NULL,
    body_markdown   TEXT    NOT NULL,
    doc_url         TEXT,
    doc_label       TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    created_by      TEXT    NOT NULL DEFAULT 'System',
    modified_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    modified_by     TEXT    NOT NULL DEFAULT 'System'
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_app_help_entries_topic ON app_help_entries (topic_key);
