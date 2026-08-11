"""SQLite DDL for LLM profiles and staff instances (stamp 29+)."""

#: Legacy / test fixture id only — fresh DDL no longer seeds this row.
DEFAULT_LLM_PROFILE_ID = "__default__"

#: Staff classes that bind to a profile (taskEditor is display-only, not materialized).
LLM_STAFF_CLASSES = ("leaderboard", "intel_event", "agent", "assistant")

DDL = """
-- Packaged LLM connection settings (URL / provider / model / key / web search).
-- Fresh DBs start with zero profiles (no bootstrap Ollama row). Existing DBs
-- keep any prior `__default__` until the user deletes it.
CREATE TABLE IF NOT EXISTS llm_profiles (
    id                      TEXT PRIMARY KEY,
    name                    TEXT NOT NULL,
    provider                TEXT NOT NULL DEFAULT 'ollama'
                            CHECK (provider IN (
                                'ollama',
                                'openai_compatible',
                                'gemini_compatible',
                                'openrouter'
                            )),
    base_url                TEXT NOT NULL DEFAULT '',
    model                   TEXT NOT NULL DEFAULT '',
    api_key                 TEXT NOT NULL DEFAULT '',
    thinking_enabled        INTEGER NOT NULL DEFAULT 0,
    json_mode               TEXT NOT NULL DEFAULT 'disabled',
    web_search_enabled      INTEGER NOT NULL DEFAULT 1,
    web_search_provider     TEXT NOT NULL DEFAULT 'auto',
    brave_search_api_key    TEXT NOT NULL DEFAULT '',
    is_default              INTEGER NOT NULL DEFAULT 0,
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_llm_profiles_updated_at
    ON llm_profiles(updated_at ASC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_llm_profiles_one_default
    ON llm_profiles(is_default)
    WHERE is_default = 1;

-- Materialized staff objects: one (class, profile) pair.
CREATE TABLE IF NOT EXISTS llm_staff_instances (
    id              TEXT PRIMARY KEY,
    staff_class     TEXT NOT NULL
                    CHECK (staff_class IN (
                        'leaderboard',
                        'intel_event',
                        'agent',
                        'assistant'
                    )),
    profile_id      TEXT NOT NULL
                    REFERENCES llm_profiles(id) ON DELETE CASCADE,
    display_name    TEXT,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    UNIQUE (staff_class, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_llm_staff_instances_profile
    ON llm_staff_instances(profile_id);
CREATE INDEX IF NOT EXISTS idx_llm_staff_instances_class
    ON llm_staff_instances(staff_class);
"""
