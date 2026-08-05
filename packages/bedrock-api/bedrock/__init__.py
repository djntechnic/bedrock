"""
bedrock — a reusable full-stack application platform.

Extracted from MLBTracker. Provides a config-driven grid backend, JWT auth with
roles and per-user module gating, DB-backed application config, a schema
catalog with boot-time drift detection, a versioned migration runner, and the
admin surfaces that drive all of it.

The package holds no business domain. Where it needs application knowledge it
exposes an extension point and the host app registers an implementation:

    bedrock.core.config_constants   APP_CATEGORY_MODULE   config categories
    bedrock.core.app_config_sections register_app_config_section
    bedrock.core.health_metrics      register_health_counter
    bedrock.core.db_health           register_canonical_tables
    bedrock.core.database            register_current_season_resolver
    bedrock.core.migrations          APP_MIGRATION_MODULE  inline migrations

Every one degrades sensibly when nothing is registered, so a brand-new app
boots before it has any data.
"""

__version__ = "0.1.0"
