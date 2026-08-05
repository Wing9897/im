"""SQLite DDL for the auth domain."""

DDL = """
-- Household admin (single-account password auth) + device sessions.
CREATE TABLE IF NOT EXISTS admin_accounts (
    id              TEXT PRIMARY KEY,
    username        TEXT NOT NULL,
    password_hash   TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    -- Application + schema enforce a single household admin row.
    singleton       INTEGER NOT NULL DEFAULT 1 CHECK (singleton = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_accounts_username
    ON admin_accounts(username);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_accounts_singleton
    ON admin_accounts(singleton);

CREATE TABLE IF NOT EXISTS device_sessions (
    id                  TEXT PRIMARY KEY,
    label               TEXT NOT NULL DEFAULT '',
    refresh_token_hash  TEXT NOT NULL,
    created_at          TEXT NOT NULL,
    last_seen_at        TEXT NOT NULL,
    expires_at          TEXT NOT NULL,
    revoked_at          TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_sessions_refresh_hash
    ON device_sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_device_sessions_expires
    ON device_sessions(expires_at);

CREATE TABLE IF NOT EXISTS device_access_tokens (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL REFERENCES device_sessions(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    expires_at  TEXT NOT NULL,
    revoked_at  TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_access_tokens_hash
    ON device_access_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_device_access_tokens_session
    ON device_access_tokens(session_id);

-- Household API access keys. Hash-only; plaintext returned once on create.
CREATE TABLE IF NOT EXISTS access_api_keys (
    id           TEXT PRIMARY KEY,
    label        TEXT NOT NULL DEFAULT '',
    secret_hash  TEXT NOT NULL,
    preview      TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL,
    revoked_at   TEXT,
    scopes       TEXT NOT NULL DEFAULT '["*"]',
    last_used_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_access_api_keys_secret_hash
    ON access_api_keys(secret_hash);
"""
