"""SQLite DDL for the actions domain."""

from server.db.schema_domains.vocabulary import (
    ACTION_TRIGGER_STATUS_CHECK_SQL,
    ACTION_TYPE_CHECK_SQL,
)

DDL = f"""
CREATE TABLE IF NOT EXISTS actions (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    action_type         TEXT NOT NULL
                        {ACTION_TYPE_CHECK_SQL},
    configuration       TEXT NOT NULL,
    trigger_conditions  TEXT,
    is_enabled          INTEGER NOT NULL DEFAULT 1,
    last_triggered_at   TEXT,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_actions_is_enabled ON actions(is_enabled);

CREATE TABLE IF NOT EXISTS action_trigger_history (
    id              TEXT PRIMARY KEY,
    action_id       TEXT NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
    task_id         TEXT REFERENCES analysis_tasks(id) ON DELETE SET NULL,
    batch_id        TEXT REFERENCES analysis_batches(id) ON DELETE SET NULL,
    trigger_reason  TEXT NOT NULL,
    status          TEXT NOT NULL {ACTION_TRIGGER_STATUS_CHECK_SQL},
    error_message   TEXT,
    triggered_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trigger_history_action_time
    ON action_trigger_history(action_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_trigger_history_time
    ON action_trigger_history(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_trigger_history_triggered_at_asc
    ON action_trigger_history(triggered_at ASC);
"""
