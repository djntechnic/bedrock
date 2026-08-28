-- Platform migration 005 — granular security capability matrix, tri-state user
-- overrides, dynamic menu navigation settings, and standardized audit columns.
--
-- Tables migrated:
--   - auth_roles (add description, created_by, modified_at, modified_by)
--   - auth_modules (add created_by, modified_at, modified_by)
--   - auth_role_modules (can_view, can_update, can_delete, can_execute, audit columns)
--   - auth_user_module_overrides (can_view, can_update, can_delete, can_execute, audit columns)
--   - auth_user_roles (audit columns)
--   - app_nav_item_settings (new dynamic navigation configuration table)

-- 1. Alter auth_roles
ALTER TABLE auth_roles ADD COLUMN description TEXT;
ALTER TABLE auth_roles ADD COLUMN created_by TEXT NOT NULL DEFAULT 'System';
ALTER TABLE auth_roles ADD COLUMN modified_at TEXT NOT NULL DEFAULT (datetime('now'));
ALTER TABLE auth_roles ADD COLUMN modified_by TEXT NOT NULL DEFAULT 'System';

-- 2. Alter auth_modules
ALTER TABLE auth_modules ADD COLUMN created_by TEXT NOT NULL DEFAULT 'System';
ALTER TABLE auth_modules ADD COLUMN modified_at TEXT NOT NULL DEFAULT (datetime('now'));
ALTER TABLE auth_modules ADD COLUMN modified_by TEXT NOT NULL DEFAULT 'System';

-- 3. Alter auth_role_modules with granular capability flags and audit columns
ALTER TABLE auth_role_modules ADD COLUMN can_view INTEGER NOT NULL DEFAULT 1;
ALTER TABLE auth_role_modules ADD COLUMN can_update INTEGER NOT NULL DEFAULT 0;
ALTER TABLE auth_role_modules ADD COLUMN can_delete INTEGER NOT NULL DEFAULT 0;
ALTER TABLE auth_role_modules ADD COLUMN can_execute INTEGER NOT NULL DEFAULT 0;
ALTER TABLE auth_role_modules ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));
ALTER TABLE auth_role_modules ADD COLUMN created_by TEXT NOT NULL DEFAULT 'System';
ALTER TABLE auth_role_modules ADD COLUMN modified_at TEXT NOT NULL DEFAULT (datetime('now'));
ALTER TABLE auth_role_modules ADD COLUMN modified_by TEXT NOT NULL DEFAULT 'System';

-- 4. Alter auth_user_module_overrides with granular tri-state flags and audit columns
ALTER TABLE auth_user_module_overrides ADD COLUMN can_view INTEGER;
ALTER TABLE auth_user_module_overrides ADD COLUMN can_update INTEGER;
ALTER TABLE auth_user_module_overrides ADD COLUMN can_delete INTEGER;
ALTER TABLE auth_user_module_overrides ADD COLUMN can_execute INTEGER;
ALTER TABLE auth_user_module_overrides ADD COLUMN created_by TEXT NOT NULL DEFAULT 'System';
ALTER TABLE auth_user_module_overrides ADD COLUMN modified_at TEXT NOT NULL DEFAULT (datetime('now'));
ALTER TABLE auth_user_module_overrides ADD COLUMN modified_by TEXT NOT NULL DEFAULT 'System';

-- 5. Alter auth_user_roles with audit columns
ALTER TABLE auth_user_roles ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));
ALTER TABLE auth_user_roles ADD COLUMN created_by TEXT NOT NULL DEFAULT 'System';
ALTER TABLE auth_user_roles ADD COLUMN modified_at TEXT NOT NULL DEFAULT (datetime('now'));
ALTER TABLE auth_user_roles ADD COLUMN modified_by TEXT NOT NULL DEFAULT 'System';

-- 6. Create app_nav_item_settings table
CREATE TABLE IF NOT EXISTS app_nav_item_settings (
    nav_setting_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    nav_key             TEXT    NOT NULL UNIQUE,  -- route path e.g. '/inventory'
    parent_key          TEXT,                     -- parent route path if child
    sort_order          INTEGER NOT NULL DEFAULT 0,
    label_override      TEXT,
    icon_override       TEXT,                     -- Lucide icon name string
    tooltip_override    TEXT,
    is_hidden_override  INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    created_by          TEXT    NOT NULL DEFAULT 'System',
    modified_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    modified_by         TEXT    NOT NULL DEFAULT 'System'
);
