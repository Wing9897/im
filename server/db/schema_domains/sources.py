"""SQLite DDL for the sources domain."""

from server.db.schema_domains.vocabulary import PLATFORM_CHECK_SQL, SOURCE_STATUS_CHECK_SQL

DDL = f"""
CREATE TABLE IF NOT EXISTS sources (
    id                 TEXT PRIMARY KEY,
    platform           TEXT NOT NULL
                       {PLATFORM_CHECK_SQL},
    name               TEXT NOT NULL,
    status             TEXT NOT NULL DEFAULT 'disconnected'
                       {SOURCE_STATUS_CHECK_SQL},
    credentials        TEXT,
    last_error         TEXT,
    last_connected_at  TEXT,
    created_at         TEXT NOT NULL,
    updated_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS channels (
    platform      TEXT NOT NULL
                  {PLATFORM_CHECK_SQL},
    platform_id   TEXT NOT NULL,
    channel_name  TEXT,
    created_at    TEXT NOT NULL,
    PRIMARY KEY (platform, platform_id)
);

CREATE TABLE IF NOT EXISTS source_channels (
    source_id   TEXT NOT NULL,
    platform     TEXT NOT NULL,
    platform_id  TEXT NOT NULL,
    PRIMARY KEY (source_id, platform, platform_id),
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
    FOREIGN KEY (platform, platform_id)
        REFERENCES channels(platform, platform_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
    id                  TEXT PRIMARY KEY,
    source_id          TEXT REFERENCES sources(id) ON DELETE SET NULL,
    platform            TEXT NOT NULL
                        {PLATFORM_CHECK_SQL},
    platform_id         TEXT NOT NULL,
    platform_message_id TEXT,
    sender_id           TEXT,
    sender_name         TEXT,
    content             TEXT NOT NULL DEFAULT '',
    timestamp           TEXT NOT NULL,
    raw_data            TEXT,
    created_at          TEXT NOT NULL,
    FOREIGN KEY (platform, platform_id)
        REFERENCES channels(platform, platform_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_platform_unique
    ON messages(platform, platform_id, platform_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp_id
    ON messages(timestamp DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp_asc
    ON messages(timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_messages_channel_timestamp_desc
    ON messages(platform, platform_id, timestamp DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_messages_source_id
    ON messages(source_id);
"""
