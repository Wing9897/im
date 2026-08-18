"""SQLite DDL for the worksets ownership dimension."""

DDL = """
-- Ownership dimension for analysis tasks (orthogonal to analysis_mode).
-- Builtin system row id ``__user__`` (is_system=1) is the default bucket
-- (same as items / user_events). delete_workset reassigns to __user__ first.
CREATE TABLE IF NOT EXISTS worksets (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    is_system  INTEGER NOT NULL DEFAULT 0,
    -- Workset-level reminder default (1 = on). Builtin 「一般」 can be turned off.
    notify_enabled INTEGER NOT NULL DEFAULT 1,
    -- MCP/A2A visibility (1 = on). Shared by both channels; builtin 「一般」 can be turned off.
    external_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_worksets_updated_at_asc
    ON worksets(updated_at ASC);
INSERT OR IGNORE INTO worksets (id, name, is_system, created_at, updated_at)
VALUES ('__user__', '一般', 1, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z');
"""
