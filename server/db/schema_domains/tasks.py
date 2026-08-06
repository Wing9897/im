"""SQLite DDL for the tasks domain."""

from server.db.schema_domains.vocabulary import (
    ANALYSIS_MODE_CHECK_SQL,
    ANALYSIS_TIME_RANGE_CHECK_SQL,
)

DDL = f"""
-- Optional ownership dimension for analysis tasks (orthogonal to analysis_mode / parent_task_id).
-- Builtin system row id ``__user__`` (is_system=1) is the handwritten / assistant ownership bucket.
CREATE TABLE IF NOT EXISTS worksets (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    is_system  INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_worksets_updated_at_asc
    ON worksets(updated_at ASC);
INSERT OR IGNORE INTO worksets (id, name, is_system, created_at, updated_at)
VALUES ('__user__', '一般', 1, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z');

CREATE TABLE IF NOT EXISTS analysis_tasks (
    id                   TEXT PRIMARY KEY,
    name                 TEXT NOT NULL,
    description          TEXT,
    prompt_template      TEXT NOT NULL DEFAULT '',
    -- Web-intel search query / keywords (empty for other modes).
    web_search_query     TEXT NOT NULL DEFAULT '',
    analysis_mode        TEXT NOT NULL DEFAULT 'leaderboard'
                         {ANALYSIS_MODE_CHECK_SQL},
    analysis_time_range  TEXT NOT NULL DEFAULT 'all'
                         {ANALYSIS_TIME_RANGE_CHECK_SQL},
    version              INTEGER NOT NULL DEFAULT 1,
    is_active            INTEGER NOT NULL DEFAULT 1,
    -- Trigger-purpose RRULE-shaped string for AI modes (APScheduler next-run only).
    -- NULL for recurring shells; calendar series live on recurring_schedules.rrule.
    -- Never calendar-expanded (hard-gated by analysis_mode / purpose=trigger).
    schedule_rrule       TEXT DEFAULT NULL,
    include_in_timeline  INTEGER NOT NULL DEFAULT 1,
    workset_id           TEXT DEFAULT NULL
                         REFERENCES worksets(id) ON DELETE SET NULL,
    -- Per-task analysis-scheduling overrides (NULL = use system_config defaults).
    project_wave_interval_seconds INTEGER DEFAULT NULL,
    batch_overlap_count           INTEGER DEFAULT NULL,
    analysis_trigger_threshold    INTEGER DEFAULT NULL,
    analysis_batch_message_limit  INTEGER DEFAULT NULL,
    analysis_strategy_mode        TEXT DEFAULT NULL,
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analysis_tasks_workset
    ON analysis_tasks(workset_id);

-- Recurrence is a schedule resource, not an analysis-task concern. ``dtstart``
-- is the real persisted RFC 5545 series anchor (local DATE/DATE-TIME plus TZID),
-- never a synthetic expansion date.
CREATE TABLE IF NOT EXISTS recurring_schedules (
    task_id                 TEXT PRIMARY KEY
                            REFERENCES analysis_tasks(id) ON DELETE CASCADE,
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
    parent_task_id          TEXT DEFAULT NULL
                            REFERENCES analysis_tasks(id) ON DELETE CASCADE,
    -- Optional parent trackable item (child recurring calendar under an inventory Thing).
    -- No SQL FK: items DDL is applied after tasks in the wipe-only aggregate.
    item_id                 TEXT DEFAULT NULL,
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_parent
    ON recurring_schedules(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_item
    ON recurring_schedules(item_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_recurring_schedules_ics_source_uid
    ON recurring_schedules(ics_source, ics_uid)
    WHERE ics_source IS NOT NULL AND ics_uid IS NOT NULL;

-- Project-manager incremental message cursor (not system_config).
-- last_message_at = ISO timestamp only; last_message_id = same-second tie-break (nullable).
CREATE TABLE IF NOT EXISTS project_message_cursors (
    task_id          TEXT PRIMARY KEY
                     REFERENCES analysis_tasks(id) ON DELETE CASCADE,
    last_message_at  TEXT NOT NULL,
    last_message_id  TEXT
);

CREATE TABLE IF NOT EXISTS task_channels (
    task_id      TEXT NOT NULL,
    platform     TEXT NOT NULL,
    platform_id  TEXT NOT NULL,
    PRIMARY KEY (task_id, platform, platform_id),
    FOREIGN KEY (task_id) REFERENCES analysis_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (platform, platform_id)
        REFERENCES channels(platform, platform_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analysis_batches (
    id                     TEXT PRIMARY KEY,
    task_id                TEXT NOT NULL REFERENCES analysis_tasks(id) ON DELETE CASCADE,
    version                INTEGER NOT NULL DEFAULT 1,
    status                 TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','processing','completed')),
    message_count          INTEGER NOT NULL DEFAULT 0,
    retry_count            INTEGER NOT NULL DEFAULT 0,
    error_message          TEXT,
    prompt_tokens          INTEGER NOT NULL DEFAULT 0,
    completion_tokens      INTEGER NOT NULL DEFAULT 0,
    created_at             TEXT NOT NULL,
    updated_at             TEXT NOT NULL,
    completed_at           TEXT,
    -- Project-tick observability (nullable; leaderboard/event batches leave unset).
    agent_message          TEXT,
    tool_calls_json        TEXT
);
-- No standalone status index: batch status is written three times per batch, and
-- the only status-without-task queries are cold paths (startup orphan recovery,
-- pause abort) over a retention-bounded table.
CREATE INDEX IF NOT EXISTS idx_batches_task_status  ON analysis_batches(task_id, status);
CREATE INDEX IF NOT EXISTS idx_batches_task_created ON analysis_batches(task_id, created_at DESC);
-- Covers the claim hot path: task_id = ? AND version = ? AND status = 'pending'
-- ORDER BY created_at ASC (server/scheduler/batch_claim.py).
CREATE INDEX IF NOT EXISTS idx_batches_task_version_status_created
    ON analysis_batches(task_id, version, status, created_at);
-- Retention: completed batches aged by completed_at (fallback updated_at in SQL).
CREATE INDEX IF NOT EXISTS idx_batches_completed_at_asc
    ON analysis_batches(completed_at ASC)
    WHERE status = 'completed';

CREATE TABLE IF NOT EXISTS analysis_markers (
    id           TEXT PRIMARY KEY,
    message_id   TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    task_id      TEXT NOT NULL REFERENCES analysis_tasks(id) ON DELETE CASCADE,
    version      INTEGER NOT NULL DEFAULT 1,
    batch_id     TEXT NOT NULL REFERENCES analysis_batches(id) ON DELETE CASCADE,
    analyzed_at  TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_markers_message_task_version
    ON analysis_markers(message_id, task_id, version);
CREATE INDEX IF NOT EXISTS idx_markers_batch
    ON analysis_markers(batch_id);
CREATE INDEX IF NOT EXISTS idx_markers_task_version_message
    ON analysis_markers(task_id, version, message_id);

CREATE TABLE IF NOT EXISTS trending_topics (
    id          TEXT PRIMARY KEY,
    task_id     TEXT NOT NULL REFERENCES analysis_tasks(id) ON DELETE CASCADE,
    version     INTEGER NOT NULL DEFAULT 1,
    batch_id    TEXT NOT NULL REFERENCES analysis_batches(id) ON DELETE CASCADE,
    rank        INTEGER DEFAULT NULL,
    topic_name  TEXT NOT NULL,
    score       REAL NOT NULL DEFAULT 0.0,
    summary     TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_topics_task_version_score
    ON trending_topics(task_id, version, score DESC);
CREATE INDEX IF NOT EXISTS idx_topics_task_version_batch
    ON trending_topics(task_id, version, batch_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_topics_task_version_rank
    ON trending_topics(task_id, version, rank);
CREATE INDEX IF NOT EXISTS idx_topics_updated_at_asc
    ON trending_topics(updated_at ASC);

CREATE TABLE IF NOT EXISTS topic_messages (
    topic_id    TEXT NOT NULL REFERENCES trending_topics(id) ON DELETE CASCADE,
    message_id  TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    PRIMARY KEY (topic_id, message_id)
);
CREATE INDEX IF NOT EXISTS idx_topic_messages_message
    ON topic_messages(message_id);
"""
