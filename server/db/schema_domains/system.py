"""SQLite DDL for the system domain."""

from server.db.schema_domains.vocabulary import APP_LOG_LEVEL_CHECK_SQL

DDL = f"""
CREATE TABLE IF NOT EXISTS system_config (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

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
