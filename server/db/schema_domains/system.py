"""SQLite DDL for the system domain."""

from server.db.schema_domains.vocabulary import APP_LOG_LEVEL_CHECK_SQL

SCHEMA_META_DDL = """
CREATE TABLE IF NOT EXISTS schema_meta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    schema_semver TEXT NOT NULL
);
"""

# Keep the literal in sync with ``SCHEMA_SEMVER`` in schema_inspect.py (drift-tested).
SCHEMA_META_SEED_SQL = "INSERT OR IGNORE INTO schema_meta (id, schema_semver) VALUES (1, '1.3.0');\n"

CALENDAR_SHARE_PUBLISH_DDL = """
CREATE TABLE IF NOT EXISTS calendar_share_publish (
    workset_id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    public_visibility TEXT NOT NULL,
    grants_json TEXT NOT NULL DEFAULT '[]',
    pending_sync INTEGER NOT NULL DEFAULT 0,
    last_sync_at TEXT,
    last_error TEXT,
    last_grants_hash TEXT,
    last_server_events_hash TEXT,
    last_public_visibility TEXT,
    last_emoji TEXT NOT NULL DEFAULT '',
    last_description TEXT NOT NULL DEFAULT '',
    last_fingerprints_json TEXT NOT NULL DEFAULT '{"events":{},"series":{}}'
);
"""

DDL = f"""
{SCHEMA_META_DDL}
{SCHEMA_META_SEED_SQL}

CREATE TABLE IF NOT EXISTS system_config (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

{CALENDAR_SHARE_PUBLISH_DDL}

CREATE TABLE IF NOT EXISTS app_logs (
    id        TEXT PRIMARY KEY,
    time      TEXT NOT NULL,
    level     TEXT NOT NULL
              {APP_LOG_LEVEL_CHECK_SQL},
    category  TEXT NOT NULL,
    kind      TEXT NOT NULL,
    message   TEXT NOT NULL,
    details   TEXT
);
CREATE INDEX IF NOT EXISTS idx_app_logs_time ON app_logs(time DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_time_asc ON app_logs(time ASC);
CREATE INDEX IF NOT EXISTS idx_app_logs_kind_time ON app_logs(kind, time DESC, id DESC);
"""
