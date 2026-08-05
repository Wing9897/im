"""SQLite DDL for the ui domain."""

DDL = """
-- Global UI prefs JSON (board / voice / timeline / assistant sessions + voice-io).
-- Keys match former system_config ids; served only via /api/v1/ui-prefs/*.
CREATE TABLE IF NOT EXISTS ui_prefs (
    key           TEXT PRIMARY KEY,
    payload_json  TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ui_prefs_updated_at_asc
    ON ui_prefs(updated_at ASC);
"""
