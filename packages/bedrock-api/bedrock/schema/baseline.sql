-- bedrock platform baseline schema
--
-- These are the tables bedrock's own code queries: app config, the grid config
-- store (global + per-user), auth, the log and audit stream, the import/export
-- run ledger, diagnostics, and migration bookkeeping.
--
-- An application applies this first, then layers its own migrations on top.
--
-- ── How this file is maintained ─────────────────────────────────────────────
-- It started as a dump: generated from a database built by applying
-- MLBTracker's full migration chain, which was the only authoritative
-- description of the platform schema while the platform lived inside the
-- application. That is no longer true in either direction — MLBTracker now
-- consumes this package, so re-deriving the baseline from it would delete any
-- table bedrock has added since.
--
-- So this file is now maintained here, and a schema change is two edits:
--   1. the table, added or altered below, for applications created from now on;
--   2. a file under schema/migrations/, for the applications that already exist.
-- Neither is optional. A baseline-only change is invisible to every live
-- database; a migration-only change is invisible to every new one.

CREATE TABLE IF NOT EXISTS import_runs (
    import_run_id       TEXT    PRIMARY KEY,
    source              TEXT    NOT NULL,
    run_type            TEXT    NOT NULL DEFAULT 'data',  -- data | historical | validation
    status              TEXT    NOT NULL DEFAULT 'running',
    started_ts          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_ts        TIMESTAMP,
    duration_seconds    REAL,
    total_rows          INTEGER DEFAULT 0,
    committed_rows      INTEGER DEFAULT 0,
    staged_rows         INTEGER DEFAULT 0,
    skipped_rows        INTEGER DEFAULT 0,
    source_version      TEXT,
    import_phase        TEXT,
    error_message       TEXT,
    content_hash        TEXT,       -- R1: SHA-256 of raw file bytes for dedup
    last_row_offset     INTEGER DEFAULT 0,  -- R3: checkpoint watermark for crash-resume
    metadata_json       TEXT        -- Phase H (055): batch shape — set count,
                                    -- per-set card counts, source filenames.
);

CREATE TABLE IF NOT EXISTS "sys_export_runs" (
    export_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    export_type TEXT    NOT NULL DEFAULT 'csv',  -- csv | pdf
    page        TEXT    NOT NULL,
                -- leaderboard | inventory | trend | players | admin
    row_count   INTEGER,
    user_note   TEXT,
    exported_at TEXT    NOT NULL DEFAULT (datetime('now')),
    exported_by TEXT    NOT NULL DEFAULT 'Admin'
);

CREATE TABLE IF NOT EXISTS log_activity (
    activity_id         INTEGER PRIMARY KEY AUTOINCREMENT,  -- renamed from log_id
    event_type          TEXT    NOT NULL,
    description         TEXT    NOT NULL,
    detail              TEXT,
    event_ts            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Inventory rewrite, Phase F (migration 052): the acting user, when there
    -- is one. Nullable because most rows are system events (imports, syncs)
    -- with no actor; SET NULL on user deletion so the audit trail outlives its
    -- operator. This is what makes the COLLECTION_UPDATE half of the activity
    -- feed owner-scopable — see cross-feature remediation Surface C.
    user_id             INTEGER REFERENCES auth_users(user_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_log_activity_user_id       ON log_activity (user_id);
CREATE INDEX IF NOT EXISTS idx_log_activity_event_type_ts ON log_activity (event_type, event_ts);

CREATE TABLE IF NOT EXISTS log_event_types (
    event_key       TEXT PRIMARY KEY,  -- raw value from DB
    display_label   TEXT NOT NULL,     -- human-readable label
    category        TEXT NOT NULL,     -- activity | import | export
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "sys_state" (
    key     TEXT PRIMARY KEY,
    value   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_config_settings (
    config_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    key         TEXT    NOT NULL UNIQUE,
    value       TEXT,
    value_type  TEXT    NOT NULL DEFAULT 'string',
                -- string | integer | float | boolean
    description TEXT,
    category    TEXT    NOT NULL DEFAULT 'system',
                -- Canonical list (see api/core/config_constants.py):
                -- system | api | sync | qualifying | display | logging |
                -- inventory | rankings | grid | shortcuts | diagnostics
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    created_by  TEXT    NOT NULL DEFAULT 'Admin',
    modified_at TEXT    NOT NULL DEFAULT (datetime('now')),
    modified_by TEXT    NOT NULL DEFAULT 'Admin'
);

CREATE TABLE IF NOT EXISTS app_grid_settings (
    grid_setting_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    grid_id           TEXT    NOT NULL UNIQUE,
    grid_label        TEXT    NOT NULL,
    title             TEXT,
    sub_header        TEXT,
    footer            TEXT,
    allow_column_toggle INTEGER NOT NULL DEFAULT 1,
    allow_export      INTEGER NOT NULL DEFAULT 1,
    read_only         INTEGER NOT NULL DEFAULT 0,
    -- New fields 12.07.06
    default_page_size     INTEGER NOT NULL DEFAULT 50,
    page_size_options     TEXT    NOT NULL DEFAULT '25,50,100,250',
    pagination_enabled    INTEGER NOT NULL DEFAULT 1,
    sticky_header         INTEGER NOT NULL DEFAULT 1,
    sticky_first_column   INTEGER NOT NULL DEFAULT 0,  -- stub, CSS deferred
    row_striping          INTEGER NOT NULL DEFAULT 1,
    dense_mode            INTEGER NOT NULL DEFAULT 0,
    default_sort_column   TEXT,
    default_sort_direction TEXT,   -- asc | desc | NULL
    show_row_count        INTEGER NOT NULL DEFAULT 1,
    show_ranking          INTEGER NOT NULL DEFAULT 0,
    wrap_text             INTEGER NOT NULL DEFAULT 0,
    min_column_width      INTEGER NOT NULL DEFAULT 80,
    sort_asc_color        TEXT,
    sort_desc_color       TEXT,
    hover_color           TEXT,
    allow_selection       INTEGER NOT NULL DEFAULT 0,
    selection_position    TEXT    NOT NULL DEFAULT 'end',  -- 'start' | 'end' — which side the selection checkbox column sits on
    allow_print           INTEGER NOT NULL DEFAULT 0,  -- expose clean print/PDF layout trigger in the unified GridHeader
    page                  TEXT,                        -- screen/page a grid renders on (admin Screen dropdown)
    tooltip_delay_duration INTEGER,                    -- tooltip open latency (ms); null = appSettings default
    show_search           INTEGER NOT NULL DEFAULT 1,  -- GridHeader inline search input
    show_density_toggle   INTEGER NOT NULL DEFAULT 1,  -- GridHeader density toggle
    show_rank_highlight   INTEGER NOT NULL DEFAULT 0,  -- GridHeader rank highlight toggle
    row_key_column        TEXT,                        -- row-object field carrying the row's stable ID (drives selection column)
    caption               TEXT,                        -- semantic <caption> element rendered inside the <Table>
    allow_column_reorder  INTEGER NOT NULL DEFAULT 1,   -- drag-and-drop column reordering (session-local for end users, persisted in the admin editor)
    allow_expansion       INTEGER NOT NULL DEFAULT 0,   -- Phase 10 B2: expander column + renderSubRow slot on <DataGrid>
    numeral_style          TEXT    NOT NULL DEFAULT 'default',  -- 'default' | 'tabular' condensed numerals for cell_type='number'
    live_update_highlight  INTEGER NOT NULL DEFAULT 0,  -- flash changed cells with --live-pulse
    row_accent_reactive    INTEGER NOT NULL DEFAULT 0,  -- tint rows with the row's --row-accent color
    created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
    created_by        TEXT    NOT NULL DEFAULT 'Admin',
    modified_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    modified_by       TEXT    NOT NULL DEFAULT 'Admin'
);

CREATE TABLE IF NOT EXISTS app_grid_settings_user (
    user_id            INTEGER NOT NULL REFERENCES auth_users(user_id) ON DELETE CASCADE,
    grid_id            TEXT    NOT NULL,
    sort_column        TEXT,
    sort_direction     TEXT,                        -- asc | desc
    pinned_filter_set  TEXT,                         -- JSON: saved columnFilters snapshot
    dashboard_pin      INTEGER NOT NULL DEFAULT 0,   -- this grid_id pinned as a dashboard source
    created_at         TEXT NOT NULL DEFAULT (datetime('now')),
    modified_at        TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, grid_id)
);

CREATE TABLE IF NOT EXISTS app_grid_column_settings_user (
    user_id       INTEGER NOT NULL,
    grid_id       TEXT    NOT NULL,
    column_id     TEXT    NOT NULL,
    visible       INTEGER,             -- NULL = inherit admin default_visible
    column_order  INTEGER,             -- NULL = inherit admin column_order
    modified_at   TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, grid_id, column_id),
    FOREIGN KEY (user_id, grid_id) REFERENCES app_grid_settings_user(user_id, grid_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_grid_column_settings (
    column_setting_id INTEGER PRIMARY KEY AUTOINCREMENT,
    grid_setting_id   INTEGER NOT NULL REFERENCES app_grid_settings(grid_setting_id),
    column_id         TEXT    NOT NULL,
    label_override    TEXT,
    tooltip_override  TEXT,
    default_visible   INTEGER NOT NULL DEFAULT 1,
    default_sort      TEXT,   -- asc | desc | NULL
    default_filter    TEXT,
    column_order      INTEGER NOT NULL DEFAULT 0,
    format_string     TEXT,
    null_display      TEXT    NOT NULL DEFAULT '—',
    allow_sort        INTEGER NOT NULL DEFAULT 1,
    allow_sort_mode   TEXT NOT NULL DEFAULT 'both',   -- none | asc | desc | both (P2 4-state enum, supersedes allow_sort)
    allow_filter      INTEGER NOT NULL DEFAULT 1,
    read_only         INTEGER NOT NULL DEFAULT 0,
    -- New fields 12.07.06
    width                 INTEGER,          -- fixed px, null = auto
    min_width             INTEGER DEFAULT 60,
    max_width             INTEGER,          -- null = unconstrained
    pinned                TEXT,             -- left | right | null (stub)
    text_align            TEXT NOT NULL DEFAULT 'left',   -- left | center | right
    wrap_text             INTEGER NOT NULL DEFAULT 0,     -- overrides parent
    resizable             INTEGER NOT NULL DEFAULT 1,
    cell_type             TEXT NOT NULL DEFAULT 'text',
                        -- text | number | badge | currency | date | sparkline(stub)
    aggregate_function    TEXT,             -- sum | avg | min | max | count | null
    conditional_format    TEXT,             -- JSON array of threshold rules
    link_target           TEXT,             -- player_flyout | player_page | null (stub)
    group_by              INTEGER NOT NULL DEFAULT 0,     -- stub
    sort_asc_color        TEXT,
    sort_desc_color       TEXT,
    gradient_from_color   TEXT,
    gradient_to_color     TEXT,
    editable              INTEGER NOT NULL DEFAULT 0,     -- Phase 8 H3: <EditableCell> opt-in
    created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
    created_by        TEXT    NOT NULL DEFAULT 'Admin',
    modified_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    modified_by       TEXT    NOT NULL DEFAULT 'Admin',
    UNIQUE (grid_setting_id, column_id)
);

CREATE TABLE IF NOT EXISTS app_ui_query_config (
    hook_name               TEXT    PRIMARY KEY,
                            -- matches hook function name e.g. useLeaderboards
    stale_time_ms           INTEGER NOT NULL DEFAULT 300000,
                            -- 5 minutes default
    refetch_interval_ms     INTEGER,
                            -- null = no polling
    refetch_on_window_focus INTEGER NOT NULL DEFAULT 0,
    description             TEXT,
    created_at              TEXT    NOT NULL DEFAULT (datetime('now')),
    created_by              TEXT    NOT NULL DEFAULT 'Admin',
    modified_at             TEXT    NOT NULL DEFAULT (datetime('now')),
    modified_by             TEXT    NOT NULL DEFAULT 'Admin'
);

CREATE TABLE IF NOT EXISTS "auth_users" (
    user_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email           TEXT    NOT NULL UNIQUE,
    hashed_password TEXT,                                        -- NULL for OAuth-only accounts
    is_active       INTEGER NOT NULL DEFAULT 1,
    is_verified     INTEGER NOT NULL DEFAULT 0,
    is_superuser    INTEGER NOT NULL DEFAULT 0,
    display_name    TEXT,
    avatar_url      TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    last_login_at   TEXT
);

CREATE TABLE IF NOT EXISTS "auth_roles" (
    role_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    slug        TEXT    NOT NULL UNIQUE,                         -- anon | viewer | member | admin
    label       TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "auth_user_roles" (
    user_id    INTEGER NOT NULL REFERENCES "auth_users"(user_id) ON DELETE CASCADE,
    role_id    INTEGER NOT NULL REFERENCES "auth_roles"(role_id) ON DELETE CASCADE,
    granted_at TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS "auth_oauth_accounts" (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES "auth_users"(user_id) ON DELETE CASCADE,
    oauth_name     TEXT    NOT NULL,                             -- 'google'
    access_token   TEXT    NOT NULL,
    refresh_token  TEXT,
    expires_at     INTEGER,
    account_id     TEXT    NOT NULL,                             -- provider's user id
    account_email  TEXT    NOT NULL,
    UNIQUE (oauth_name, account_id)
);

CREATE TABLE IF NOT EXISTS "auth_sessions" (
    session_id  TEXT    PRIMARY KEY,                             -- also the JWT jti claim
    user_id     INTEGER NOT NULL REFERENCES "auth_users"(user_id) ON DELETE CASCADE,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    expires_at  TEXT    NOT NULL,
    revoked_at  TEXT,
    ip_address  TEXT,
    user_agent  TEXT
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions (user_id);

-- Single-use, expiring tokens for the flows that prove control of an email
-- address: invitation, password reset, address verification. Only the SHA-256
-- of a token is stored; see bedrock/services/email_token_service.py.
CREATE TABLE IF NOT EXISTS auth_email_tokens (
    token_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES "auth_users"(user_id) ON DELETE CASCADE,
    purpose     TEXT    NOT NULL,   -- invite | password_reset | email_verification
    token_hash  TEXT    NOT NULL UNIQUE,   -- lowercase hex SHA-256
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    expires_at  TEXT    NOT NULL,          -- UTC 'YYYY-MM-DD HH:MM:SS'
    consumed_at TEXT                       -- NULL means live
);
CREATE INDEX IF NOT EXISTS idx_auth_email_tokens_lookup
    ON auth_email_tokens (user_id, purpose, consumed_at);

-- Media assets (F4). Keyed by (entity_type, entity_id) rather than a foreign
-- key to any particular table — that is what lets one table serve a card's
-- photos, a gallery item's images and a blog post's attachments. The cost is
-- no referential integrity to the owning row; an application deleting an
-- entity calls media_service.delete_for_entity.
CREATE TABLE IF NOT EXISTS media_assets (
    media_id            INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type         TEXT    NOT NULL,
    entity_id           INTEGER NOT NULL,
    owner_id            INTEGER,
    storage_key         TEXT    NOT NULL,
    storage_provider    TEXT    NOT NULL DEFAULT 'local',
    url                 TEXT,
    filename            TEXT    NOT NULL,
    content_type        TEXT,
    file_size_bytes     INTEGER,
    width               INTEGER,
    height              INTEGER,
    content_hash        TEXT,
    status              TEXT    NOT NULL DEFAULT 'pending',
    sort_order          INTEGER,
    tags                TEXT,
    source_url          TEXT,
    submitted_by_user_id INTEGER,
    reviewed_by_user_id  INTEGER,
    reviewed_at         TEXT,
    reject_reason       TEXT,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_media_assets_entity
    ON media_assets (entity_type, entity_id, status);
CREATE INDEX IF NOT EXISTS idx_media_assets_status
    ON media_assets (status, created_at);
CREATE INDEX IF NOT EXISTS idx_media_assets_hash
    ON media_assets (content_hash);

CREATE TABLE IF NOT EXISTS "auth_modules" (
    module_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    slug        TEXT    NOT NULL UNIQUE,                         -- dashboard | leaderboards | rankings | trends | players | inventory | admin | health
    label       TEXT    NOT NULL,
    description TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_core     INTEGER NOT NULL DEFAULT 0,                      -- 1 = always-on for admin, cannot be revoked
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "auth_role_modules" (
    role_id   INTEGER NOT NULL REFERENCES "auth_roles"(role_id) ON DELETE CASCADE,
    module_id INTEGER NOT NULL REFERENCES "auth_modules"(module_id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, module_id)
);

CREATE TABLE IF NOT EXISTS "auth_user_module_overrides" (
    user_id    INTEGER NOT NULL REFERENCES "auth_users"(user_id) ON DELETE CASCADE,
    module_id  INTEGER NOT NULL REFERENCES "auth_modules"(module_id) ON DELETE CASCADE,
    granted    INTEGER NOT NULL,
    granted_by INTEGER REFERENCES "auth_users"(user_id),
    granted_at TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, module_id)
);

CREATE TABLE IF NOT EXISTS auth_activity_log (
    event_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    event_ts       TEXT    NOT NULL DEFAULT (datetime('now')),
    event_type     TEXT    NOT NULL,                             -- register | login_success | login_failed | logout | oauth_login | oauth_link | oauth_new_user | role_granted | role_revoked | module_granted | module_revoked | module_access_denied | role_access_denied | user_deactivated | user_reactivated | user_invited | session_revoked | rate_limit_tripped | password_reset_request | password_reset_complete
    user_id        INTEGER REFERENCES "auth_users"(user_id),            -- NULL for failed-login-unknown-user
    target_user_id INTEGER REFERENCES "auth_users"(user_id),            -- for admin actions on another user
    actor_ip       TEXT,
    user_agent     TEXT,
    detail_json    TEXT
);
CREATE INDEX IF NOT EXISTS idx_auth_activity_ts   ON auth_activity_log (event_ts DESC);
CREATE INDEX IF NOT EXISTS idx_auth_activity_user ON auth_activity_log (user_id, event_ts DESC);
CREATE INDEX IF NOT EXISTS idx_auth_activity_type ON auth_activity_log (event_type, event_ts DESC);

CREATE TABLE IF NOT EXISTS import_sources (
    import_source_id   INTEGER PRIMARY KEY,
    import_source_code TEXT    NOT NULL UNIQUE,
    label              TEXT    NOT NULL,
    description        TEXT,
    sort_order         INTEGER NOT NULL DEFAULT 0,
    is_active          INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sys_schema_migrations (
            migration_id TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS "diag_test_runs" (
            run_id       INTEGER PRIMARY KEY AUTOINCREMENT,
            triggered_by TEXT NOT NULL DEFAULT 'manual',
            started_at   TEXT NOT NULL,
            finished_at  TEXT,
            status       TEXT NOT NULL DEFAULT 'running',
            duration_ms  INTEGER,
            total        INTEGER DEFAULT 0,
            passed       INTEGER DEFAULT 0,
            failed       INTEGER DEFAULT 0,
            skipped      INTEGER DEFAULT 0
        );

CREATE TABLE IF NOT EXISTS "diag_test_results" (
            result_id  INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id     INTEGER NOT NULL REFERENCES "diag_test_runs"(run_id) ON DELETE CASCADE,
            test_name  TEXT NOT NULL,
            test_group TEXT NOT NULL,
            status     TEXT NOT NULL,
            message    TEXT,
            duration_ms INTEGER,
            retries    INTEGER DEFAULT 0,
            error_detail TEXT
        );

CREATE TABLE IF NOT EXISTS "sys_audit_runs" (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            run_at       TEXT NOT NULL,
            triggered_by TEXT NOT NULL DEFAULT 'manual',
            checks_run   TEXT,
            findings     TEXT,
            summary_p1   INTEGER DEFAULT 0,
            summary_p2   INTEGER DEFAULT 0,
            summary_p3   INTEGER DEFAULT 0,
            total        INTEGER DEFAULT 0,
            duration_ms  INTEGER
        );
