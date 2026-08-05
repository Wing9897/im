"""SQLite DDL for the analysis domain."""

DDL = """
CREATE TABLE IF NOT EXISTS analysis_events (
    id                          TEXT PRIMARY KEY,
    task_id                     TEXT NOT NULL REFERENCES analysis_tasks(id) ON DELETE CASCADE,
    version                     INTEGER NOT NULL DEFAULT 1,
    batch_id                    TEXT NOT NULL REFERENCES analysis_batches(id) ON DELETE CASCADE,
    title                       TEXT NOT NULL,
    body                        TEXT NOT NULL DEFAULT '',
    start_time                  TEXT,
    end_time                    TEXT,
    location                    TEXT NOT NULL DEFAULT 'N/A',
    latitude                    REAL DEFAULT NULL,
    longitude                   REAL DEFAULT NULL,
    participants_json           TEXT NOT NULL DEFAULT '[]',
    source_message_id           TEXT REFERENCES messages(id) ON DELETE SET NULL,
    batch_source_channel_names  TEXT,
    content_hash                TEXT NOT NULL,
    semantic_hash               TEXT NOT NULL DEFAULT '',
    event_key                   TEXT,
    created_at                  TEXT NOT NULL,
    updated_at                  TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_task_version_hash
    ON analysis_events(task_id, version, content_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_task_version_semantic_hash
    ON analysis_events(task_id, version, semantic_hash) WHERE semantic_hash != '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_task_version_key
    ON analysis_events(task_id, version, event_key) WHERE event_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_task_version_start
    ON analysis_events(task_id, version, start_time ASC);
CREATE INDEX IF NOT EXISTS idx_events_task_version_created
    ON analysis_events(task_id, version, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_created_at_asc
    ON analysis_events(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_events_task_version_has_coords
    ON analysis_events(task_id, version, created_at DESC)
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
-- Retention ages events by their effective time (timed events by start_time,
-- untimed by created_at). Expression must match server/scheduler/retention.py
-- exactly or SQLite falls back to a full scan.
CREATE INDEX IF NOT EXISTS idx_events_effective_time
    ON analysis_events(datetime(COALESCE(NULLIF(TRIM(start_time), ''), created_at)) ASC);
"""
