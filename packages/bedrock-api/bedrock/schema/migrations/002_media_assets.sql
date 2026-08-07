-- Platform migration 002 — media assets (plan F4).
--
-- One table for every kind of attached file, keyed by (entity_type, entity_id)
-- rather than by a foreign key to any particular table. That is what makes it
-- reusable: MLBTracker's photos hang off a collection card, a gallery's hang
-- off a gallery item, a blog's off a post, and the platform needs to know none
-- of those tables exist.
--
-- The cost of that choice, stated plainly: there is no referential integrity
-- to the owning row. Deleting an entity does not cascade to its media. An
-- application that wants that behaviour calls `media_service.delete_for_entity`
-- in the same transaction — see docs/media.md.

CREATE TABLE IF NOT EXISTS media_assets (
    media_id            INTEGER PRIMARY KEY AUTOINCREMENT,
    -- What this is attached to. Free text, because the platform cannot know
    -- an application's entity names; conventionally the table name.
    entity_type         TEXT    NOT NULL,
    entity_id           INTEGER NOT NULL,
    -- Who uploaded it, for per-user scoping. Not a hard FK to auth_users:
    -- media outliving a deleted account is the safer default for an approval
    -- queue an admin is still working through.
    owner_id            INTEGER,
    -- Opaque, backend-specific. A path for local disk, an image id for
    -- Cloudflare. Code that parses this has coupled itself to one backend.
    storage_key         TEXT    NOT NULL,
    storage_provider    TEXT    NOT NULL DEFAULT 'local',
    -- Public URL when the backend has one; NULL when the app serves the bytes.
    url                 TEXT,
    filename            TEXT    NOT NULL,
    content_type        TEXT,
    file_size_bytes     INTEGER,
    width               INTEGER,
    height              INTEGER,
    -- SHA-256 of the bytes, so "already uploaded" is answerable without
    -- re-reading the file.
    content_hash        TEXT,
    -- pending | approved | rejected. Uploads land pending so an unreviewed
    -- image cannot reach a public CDN.
    status              TEXT    NOT NULL DEFAULT 'pending',
    -- Display order within an entity. Nullable: most callers do not care.
    sort_order          INTEGER,
    tags                TEXT,
    source_url          TEXT,
    submitted_by_user_id INTEGER,
    reviewed_by_user_id  INTEGER,
    reviewed_at         TEXT,
    reject_reason       TEXT,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- The read every consumer makes: everything attached to one entity, approved
-- first, in display order.
CREATE INDEX IF NOT EXISTS idx_media_assets_entity
    ON media_assets (entity_type, entity_id, status);

-- The approval queue: pending across every entity, oldest first.
CREATE INDEX IF NOT EXISTS idx_media_assets_status
    ON media_assets (status, created_at);

-- Duplicate detection.
CREATE INDEX IF NOT EXISTS idx_media_assets_hash
    ON media_assets (content_hash);
