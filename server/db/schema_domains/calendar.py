"""SQLite DDL for the calendar domain."""

from server.db.schema_domains.vocabulary import (
    NOTIFY_PREF_CHECK_SQL,
    TIMELINE_SOURCE_CHECK_SQL,
    USER_EVENT_DIRECTION_CHECK_SQL,
    USER_EVENT_KIND_CHECK_SQL,
    USER_EVENT_ORIGIN_CHECK_SQL,
)

DDL = f"""
-- Standalone recurring calendar series (not analysis_tasks). ``dtstart`` is the
-- real persisted RFC 5545 series anchor (local DATE/DATE-TIME plus TZID).
-- ``is_active=1`` participates in expand; pause/resume via PATCH (hard DELETE removes the row).
CREATE TABLE IF NOT EXISTS recurring_schedules (
    id                      TEXT PRIMARY KEY,
    name                    TEXT NOT NULL,
    workset_id              TEXT NOT NULL DEFAULT '__user__'
                            REFERENCES worksets(id),
    is_active               INTEGER NOT NULL DEFAULT 1,
    rrule                   TEXT NOT NULL,
    dtstart                 TEXT NOT NULL,
    dtend                   TEXT DEFAULT NULL,
    is_all_day              INTEGER NOT NULL DEFAULT 0,
    location                TEXT DEFAULT NULL,
    description             TEXT DEFAULT NULL,
    timezone                TEXT DEFAULT NULL,
    timezone_ical           TEXT DEFAULT NULL,
    exdates_json            TEXT NOT NULL DEFAULT '[]',
    rdates_json             TEXT NOT NULL DEFAULT '[]',
    ics_uid                 TEXT DEFAULT NULL,
    ics_source              TEXT DEFAULT NULL,
    ics_import_fingerprint  TEXT DEFAULT NULL,
    -- Agent-owned child series only (parent must be analysis_mode=agent).
    parent_task_id          TEXT DEFAULT NULL
                            REFERENCES analysis_tasks(id) ON DELETE CASCADE,
    -- Optional parent trackable item (linked recurring calendar under an inventory Thing).
    item_id                 TEXT DEFAULT NULL
                            REFERENCES items(id) ON DELETE SET NULL,
    -- Per-series reminder: follow workset default, or mute this series.
    -- Create-omit and DDL default are off (align DEFAULT_CALENDAR_NOTIFY_PREF).
    notify_pref             TEXT NOT NULL DEFAULT 'off'
                            {NOTIFY_PREF_CHECK_SQL},
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_parent
    ON recurring_schedules(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_item
    ON recurring_schedules(item_id);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_workset
    ON recurring_schedules(workset_id);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_active
    ON recurring_schedules(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_recurring_schedules_ics_source_uid
    ON recurring_schedules(ics_source, ics_uid)
    WHERE ics_source IS NOT NULL AND ics_uid IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_events (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    body        TEXT NOT NULL DEFAULT '',
    start_time  TEXT NOT NULL,
    end_time    TEXT,
    location    TEXT NOT NULL DEFAULT '',
    origin      TEXT NOT NULL {USER_EVENT_ORIGIN_CHECK_SQL},
    event_is_all_day INTEGER NOT NULL DEFAULT 0,
    event_timezone TEXT DEFAULT NULL,
    -- Optional "remind N days before start"; NULL = no remind.
    remind_before_days INTEGER DEFAULT NULL,
    ics_uid     TEXT DEFAULT NULL,
    ics_source  TEXT DEFAULT NULL,
    ics_import_fingerprint TEXT DEFAULT NULL,
    task_id     TEXT DEFAULT NULL REFERENCES analysis_tasks(id) ON DELETE SET NULL,
    -- Optional parent trackable item (linked calendar under an inventory Thing).
    item_id     TEXT DEFAULT NULL
                REFERENCES items(id) ON DELETE SET NULL,
    -- Ownership is always a workset; delete_workset reassigns to __user__ first.
    workset_id  TEXT NOT NULL DEFAULT '__user__' REFERENCES worksets(id),
    -- Special linked-calendar semantics (authority over title presets).
    -- normal = generic; expires = primary expiry projection; purchase_effective = finance.
    kind        TEXT NOT NULL DEFAULT 'normal'
                {USER_EVENT_KIND_CHECK_SQL},
    -- Optional finance fields — only meaningful when kind=purchase_effective.
    amount      REAL DEFAULT NULL,
    direction   TEXT DEFAULT NULL
                {USER_EVENT_DIRECTION_CHECK_SQL},
    -- Per-event reminder: follow workset default, or mute this row.
    -- Create-omit and DDL default are off (align DEFAULT_CALENDAR_NOTIFY_PREF).
    notify_pref TEXT NOT NULL DEFAULT 'off'
                {NOTIFY_PREF_CHECK_SQL},
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
                  {TIMELINE_SOURCE_CHECK_SQL},
    event_id      TEXT NOT NULL,
    dismissed_at  TEXT NOT NULL,
    PRIMARY KEY (source, event_id)
);
CREATE INDEX IF NOT EXISTS idx_timeline_dismissals_event
    ON timeline_dismissals(event_id);

-- User / agent 「重要事件」 markers (❗). Same source vocabulary as dismissals;
-- item_remind／recurring keys are occurrence ids (e.g. item:{{id}}:remind).
CREATE TABLE IF NOT EXISTS timeline_importance (
    source        TEXT NOT NULL
                  {TIMELINE_SOURCE_CHECK_SQL},
    event_id      TEXT NOT NULL,
    marked_at     TEXT NOT NULL,
    PRIMARY KEY (source, event_id)
);
CREATE INDEX IF NOT EXISTS idx_timeline_importance_event
    ON timeline_importance(event_id);
"""
