-- Migration 008: Seed platform configuration keys
-- Resolves bedrock#50: platform keys read via db.get_config must be discoverable and configurable in the admin console.
-- Note: jwt_secret is intentionally excluded as secrets must never reside in editable UI configuration.

INSERT OR IGNORE INTO app_config_settings (key, value, value_type, description, category) VALUES
    ('rate_limit_login', '10/minute', 'string', 'Rate limit for user login attempts', 'system'),
    ('rate_limit_register', '5/minute', 'string', 'Rate limit for account registration', 'system'),
    ('rate_limit_oauth_callback', '10/minute', 'string', 'Rate limit for OAuth callback handshakes', 'system'),
    ('rate_limit_password_reset', '5/hour', 'string', 'Rate limit for password reset requests', 'system'),
    ('mail_from_address', '', 'string', 'Default From email address for transactional emails', 'system'),
    ('mail_from_name', '', 'string', 'Default From display name for transactional emails', 'system'),
    ('system_base_url', '', 'string', 'Public base URL of the application for link generation', 'system'),
    ('seo_allow_indexing', 'true', 'boolean', 'Allow search engine web crawlers to index public pages', 'system'),
    ('diagnostics_retention_days', '60', 'integer', 'Number of days to retain diagnostic test execution history', 'diagnostics'),
    ('diagnostics_schedule_enabled', 'false', 'boolean', 'Whether daily automated diagnostic checks are enabled', 'diagnostics'),
    ('diagnostics_schedule_time', '02:00', 'string', 'Daily scheduled time (HH:MM UTC) for automated diagnostic checks', 'diagnostics');
