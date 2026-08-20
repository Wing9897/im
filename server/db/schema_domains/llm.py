"""SQLite DDL for LLM profiles and staff instances (Python SoT CHECKs)."""

from server.db.schema_domains.vocabulary import (
    JSON_MODE_CHECK_SQL,
    LLM_PROVIDER_CHECK_SQL,
    LLM_STAFF_CLASS_CHECK_SQL,
    WEB_SEARCH_PROVIDER_CHECK_SQL,
)
from server.domain.llm_staff_classes import (
    LLM_STAFF_CLASSES,
    LLM_TASK_STAFF_CLASSES,
)
from server.domain.web_search_providers import WEB_SEARCH_SECRET_COLUMNS

#: Legacy / test fixture id only — fresh DDL never seeds this row; production
#: paths must not invent it as a fallback.
DEFAULT_LLM_PROFILE_ID = "__default__"

_SEARCH_API_KEY_COLUMNS_DDL = "\n".join(
    f"    {column} TEXT NOT NULL DEFAULT ''," for column in WEB_SEARCH_SECRET_COLUMNS
)

DDL = f"""
-- Packaged LLM connection settings (URL / provider / model / key / web search).
-- Fresh DBs start with zero profiles (no bootstrap Ollama row).
CREATE TABLE IF NOT EXISTS llm_profiles (
    id                      TEXT PRIMARY KEY,
    name                    TEXT NOT NULL,
    provider                TEXT NOT NULL DEFAULT 'ollama'
                            {LLM_PROVIDER_CHECK_SQL},
    base_url                TEXT NOT NULL DEFAULT '',
    model                   TEXT NOT NULL DEFAULT '',
    api_key                 TEXT NOT NULL DEFAULT '',
    thinking_enabled        INTEGER NOT NULL DEFAULT 0,
    json_mode               TEXT NOT NULL DEFAULT 'disabled'
                            {JSON_MODE_CHECK_SQL},
    web_search_enabled      INTEGER NOT NULL DEFAULT 1,
    web_search_provider     TEXT NOT NULL DEFAULT 'auto'
                            {WEB_SEARCH_PROVIDER_CHECK_SQL},
{_SEARCH_API_KEY_COLUMNS_DDL}
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_llm_profiles_updated_at
    ON llm_profiles(updated_at ASC);

-- Materialized staff objects: task-mode (class, profile) pairs only.
-- Global trio (assistant / liaison / taskEditor) use system_config slots.
CREATE TABLE IF NOT EXISTS llm_staff_instances (
    id              TEXT PRIMARY KEY,
    staff_class     TEXT NOT NULL
                    {LLM_STAFF_CLASS_CHECK_SQL},
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

__all__ = [
    "DDL",
    "DEFAULT_LLM_PROFILE_ID",
    "LLM_STAFF_CLASSES",
    "LLM_TASK_STAFF_CLASSES",
]
