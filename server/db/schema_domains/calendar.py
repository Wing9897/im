"""SQLite DDL for the calendar domain."""

DDL = """
CREATE TABLE IF NOT EXISTS user_events (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    body        TEXT NOT NULL DEFAULT '',
    start_time  TEXT NOT NULL,
    end_time    TEXT,
    location    TEXT NOT NULL DEFAULT '',
    origin      TEXT NOT NULL CHECK (origin IN ('manual', 'assistant', 'a2a', 'agent', 'ics')),
    event_is_all_day INTEGER NOT NULL DEFAULT 0,
    event_timezone TEXT DEFAULT NULL,
    -- Optional "remind N days before start" (calendar / voice); NULL = no remind.
    remind_before_days INTEGER DEFAULT NULL,
    ics_uid     TEXT DEFAULT NULL,
    ics_source  TEXT DEFAULT NULL,
    ics_import_fingerprint TEXT DEFAULT NULL,
    task_id     TEXT DEFAULT NULL REFERENCES analysis_tasks(id) ON DELETE SET NULL,
    -- Optional parent trackable item (linked calendar under an inventory Thing).
    -- No SQL FK: items DDL is applied after calendar in the wipe-only aggregate.
    item_id     TEXT DEFAULT NULL,
    -- Ownership is always a workset; delete_workset reassigns to __user__ first.
    workset_id  TEXT NOT NULL DEFAULT '__user__' REFERENCES worksets(id),
    -- Special linked-calendar semantics (authority over title presets).
    -- normal = generic; expires = primary expiry projection; purchase_effective = finance.
    kind        TEXT NOT NULL DEFAULT 'normal'
                CHECK (kind IN ('normal', 'expires', 'purchase_effective')),
    -- Optional finance fields — only meaningful when kind=purchase_effective.
    amount      REAL DEFAULT NULL,
    direction   TEXT DEFAULT NULL
                CHECK (direction IS NULL OR direction IN ('expense', 'income')),
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_events_start
    ON user_events(start_time ASC);
CREATE INDEX IF NOT EXISTS idx_user_events_created_at_asc
    ON user_events(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_user_events_task_id
    ON user_events(task_id);
CREATE INDEX IF NOT EXISTS idx_user_events_item_id
    ON user_events(item_id);
CREATE INDEX IF NOT EXISTS idx_user_events_workset_id
    ON user_events(workset_id);
CREATE INDEX IF NOT EXISTS idx_user_events_kind
    ON user_events(kind);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_events_ics_source_uid
    ON user_events(ics_source, ics_uid)
    WHERE ics_source IS NOT NULL AND ics_uid IS NOT NULL;
-- Same effective-time expression as analysis_events, for the user-event TTL.
CREATE INDEX IF NOT EXISTS idx_user_events_effective_time
    ON user_events(datetime(COALESCE(NULLIF(TRIM(start_time), ''), created_at)) ASC);

CREATE TABLE IF NOT EXISTS timeline_dismissals (
    source        TEXT NOT NULL
                  CHECK (source IN ('analysis', 'user', 'recurring', 'item')),
    event_id      TEXT NOT NULL,
    dismissed_at  TEXT NOT NULL,
    PRIMARY KEY (source, event_id)
);
CREATE INDEX IF NOT EXISTS idx_timeline_dismissals_event
    ON timeline_dismissals(event_id);

-- User / agent 「重要事件」 markers (❗). Same source vocabulary as dismissals;
-- item／recurring keys are occurrence ids (e.g. item:{id}:expires).
CREATE TABLE IF NOT EXISTS timeline_importance (
    source        TEXT NOT NULL
                  CHECK (source IN ('analysis', 'user', 'recurring', 'item')),
    event_id      TEXT NOT NULL,
    marked_at     TEXT NOT NULL,
    PRIMARY KEY (source, event_id)
);
CREATE INDEX IF NOT EXISTS idx_timeline_importance_event
    ON timeline_importance(event_id);
"""
