"""
Module:  schema_catalog.py
Layer:   bedrock/core
Desc:    Canonical names for the database objects the *platform* owns. See the
         S7 standard for the rule this enforces: python callers reference
         `Tables.<CONST>` in SQL f-strings, never bare literals, so a rename is
         a compile-time concern rather than a grep.

         This catalog deliberately covers only platform tables — app config,
         grid settings, auth, logging, the import ledger and system tables. An
         application generates its own catalog for its own tables and is free
         to re-export these alongside them.

         Regenerated from a live schema by the catalog generator; do not
         hand-edit the constants, edit a migration and rerun it.
"""
from typing import Final


class Tables:
    """Every base table the platform owns."""
    APP_CONFIG_SETTINGS: Final = "app_config_settings"
    APP_GRID_COLUMN_SETTINGS: Final = "app_grid_column_settings"
    APP_GRID_COLUMN_SETTINGS_USER: Final = "app_grid_column_settings_user"
    APP_GRID_SETTINGS: Final = "app_grid_settings"
    APP_GRID_SETTINGS_USER: Final = "app_grid_settings_user"
    APP_NAV_ITEM_SETTINGS: Final = "app_nav_item_settings"
    APP_UI_QUERY_CONFIG: Final = "app_ui_query_config"
    AUTH_ACTIVITY_LOG: Final = "auth_activity_log"
    AUTH_EMAIL_TOKENS: Final = "auth_email_tokens"
    MEDIA_ASSETS: Final = "media_assets"
    AUTH_MODULES: Final = "auth_modules"
    AUTH_OAUTH_ACCOUNTS: Final = "auth_oauth_accounts"
    AUTH_ROLES: Final = "auth_roles"
    AUTH_ROLE_MODULES: Final = "auth_role_modules"
    AUTH_SESSIONS: Final = "auth_sessions"
    AUTH_USERS: Final = "auth_users"
    AUTH_USER_MODULE_OVERRIDES: Final = "auth_user_module_overrides"
    AUTH_USER_ROLES: Final = "auth_user_roles"
    IMPORT_RUNS: Final = "import_runs"
    IMPORT_SOURCES: Final = "import_sources"
    LOG_ACTIVITY: Final = "log_activity"
    LOG_EVENT_TYPES: Final = "log_event_types"
    SYS_AUDIT_RUNS: Final = "sys_audit_runs"
    SYS_EXPORT_RUNS: Final = "sys_export_runs"
    SYS_SCHEMA_MIGRATIONS: Final = "sys_schema_migrations"
    SYS_STATE: Final = "sys_state"
    DIAG_TEST_RESULTS: Final = "diag_test_results"
    DIAG_TEST_RUNS: Final = "diag_test_runs"


class Views:
    """Platform-owned views. None today — the platform reads base tables
    directly and leaves view composition to applications."""


class Indexes:
    """Platform-owned indexes, created by the baseline schema."""

    IDX_AUTH_ACTIVITY_TS: Final = "idx_auth_activity_ts"
    IDX_AUTH_ACTIVITY_TYPE: Final = "idx_auth_activity_type"
    IDX_AUTH_ACTIVITY_USER: Final = "idx_auth_activity_user"
    IDX_AUTH_EMAIL_TOKENS_LOOKUP: Final = "idx_auth_email_tokens_lookup"
    IDX_MEDIA_ASSETS_ENTITY: Final = "idx_media_assets_entity"
    IDX_MEDIA_ASSETS_STATUS: Final = "idx_media_assets_status"
    IDX_MEDIA_ASSETS_HASH: Final = "idx_media_assets_hash"
    IDX_AUTH_SESSIONS_USER: Final = "idx_auth_sessions_user"
    IDX_LOG_ACTIVITY_EVENT_TYPE_TS: Final = "idx_log_activity_event_type_ts"
    IDX_LOG_ACTIVITY_USER_ID: Final = "idx_log_activity_user_id"


ALL_TABLES: Final = frozenset(v for k, v in vars(Tables).items()
                              if not k.startswith("_") and isinstance(v, str))
ALL_VIEWS: Final = frozenset(v for k, v in vars(Views).items()
                             if not k.startswith("_") and isinstance(v, str))
ALL_INDEXES: Final = frozenset(v for k, v in vars(Indexes).items()
                               if not k.startswith("_") and isinstance(v, str))
ALL_OBJECTS: Final = ALL_TABLES | ALL_VIEWS | ALL_INDEXES

# Tables scheduled for removal — callers should migrate off these.
DEPRECATED: Final[frozenset[str]] = frozenset([])
