"""SQLite DDL for the ui domain."""

DDL = """
-- Global UI prefs JSON blobs (board / notify / timeline / assistant sessions).
-- Served only via /api/v1/ui-prefs/*. Notify keys: notify_settings, notify_fired, notify_trigger_history.
CREATE TABLE IF NOT EXISTS ui_prefs (
    key           TEXT PRIMARY KEY,
    payload_json  TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ui_prefs_updated_at_asc
    ON ui_prefs(updated_at ASC);
"""
