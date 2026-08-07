-- bedrock platform migration 001 — email action tokens
--
-- Backs the invite / password-reset / email-verification flows. Applications
-- created from a later baseline already have this table; the migration exists
-- for the ones that were built against v0.1.x, which is every application that
-- exists today.
--
-- Only the SHA-256 of a token is stored. See
-- bedrock/services/email_token_service.py for why a fast hash is the correct
-- choice here and a slow KDF is not.

CREATE TABLE IF NOT EXISTS auth_email_tokens (
    token_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES auth_users(user_id) ON DELETE CASCADE,
    purpose     TEXT    NOT NULL,
                -- invite | password_reset | email_verification
                -- Keep synced with PURPOSES in email_token_service.py. A token
                -- is only ever redeemable for the purpose it was issued under.
    token_hash  TEXT    NOT NULL UNIQUE,
                -- Lowercase hex SHA-256. UNIQUE both enforces the obvious and
                -- gives redemption its index — lookup is by hash, always.
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    expires_at  TEXT    NOT NULL,
                -- UTC 'YYYY-MM-DD HH:MM:SS', matching auth_sessions.
    consumed_at TEXT
                -- Set on redemption and on supersession. NULL means live,
                -- which is what makes 'UPDATE … WHERE consumed_at IS NULL' a
                -- single-use guarantee rather than a check-then-act race.
);

-- Supersession scans by (user, purpose) over live rows; redemption uses the
-- UNIQUE index above.
CREATE INDEX IF NOT EXISTS idx_auth_email_tokens_lookup
    ON auth_email_tokens (user_id, purpose, consumed_at);
