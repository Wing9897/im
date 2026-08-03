"""Authoritative SQLite DDL for schema stamp 10 (single schema source).

``server.db.schema_bootstrap`` owns classification and version stamping; the
structural fingerprint is derived from this DDL in
``server.db.schema_fingerprint``.

Conventions:
- snake_case table/column names; camelCase only at the API boundary.
- TEXT primary keys (uuid4 hex) except composite-key link tables.
- Timestamps are TEXT ISO 8601 UTC.
- Booleans are INTEGER 0/1.
"""

from server.domain.analysis_modes import ALL_ANALYSIS_MODES
from server.domain.collector_platforms import COLLECTOR_PLATFORMS

# Shared platform vocabulary for accounts / channels / messages.
PLATFORM_CHECK_VALUES = COLLECTOR_PLATFORMS
PLATFORM_CHECK_SQL = "CHECK (platform IN ({}))".format(",".join(f"'{value}'" for value in PLATFORM_CHECK_VALUES))

ANALYSIS_MODE_CHECK_VALUES = ALL_ANALYSIS_MODES
ANALYSIS_MODE_CHECK_SQL = "CHECK (analysis_mode IN ({}))".format(
    ",".join(f"'{value}'" for value in ANALYSIS_MODE_CHECK_VALUES)
)

# Canonical task analysis windows. Every value must be a key of
# ``server.analyzer.incremental._TIME_RANGE_OFFSETS`` (or ``all`` / ``today``).
# Message filters share the same canonical offset keys (``7d``／``30d`` only —
# no ``7days``／``30days`` aliases).
ANALYSIS_TIME_RANGE_VALUES = (
    "all",
    "today",
    "1h",
    "6h",
    "12h",
    "24h",
    "48h",
    "1d",
    "7d",
    "30d",
)
ANALYSIS_TIME_RANGE_CHECK_SQL = "CHECK (analysis_time_range IN ({}))".format(
    ",".join(f"'{value}'" for value in ANALYSIS_TIME_RANGE_VALUES)
)

APP_LOG_LEVEL_VALUES = ("info", "success", "warning", "error")
APP_LOG_LEVEL_CHECK_SQL = "CHECK (level IN ({}))".format(",".join(f"'{value}'" for value in APP_LOG_LEVEL_VALUES))

DDL = f"""
CREATE TABLE IF NOT EXISTS accounts (
    id                 TEXT PRIMARY KEY,
    platform           TEXT NOT NULL
                       {PLATFORM_CHECK_SQL},
    name               TEXT NOT NULL,
    status             TEXT NOT NULL DEFAULT 'disconnected'
                       CHECK (status IN ('connected','disconnected','error')),
    credentials        TEXT,
    last_error         TEXT,
    last_connected_at  TEXT,
    created_at         TEXT NOT NULL,
    updated_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS channels (
    platform      TEXT NOT NULL
                  {PLATFORM_CHECK_SQL},
    platform_id   TEXT NOT NULL,
    channel_name  TEXT,
    created_at    TEXT NOT NULL,
    PRIMARY KEY (platform, platform_id)
);

CREATE TABLE IF NOT EXISTS account_channels (
    account_id   TEXT NOT NULL,
    platform     TEXT NOT NULL,
    platform_id  TEXT NOT NULL,
    PRIMARY KEY (account_id, platform, platform_id),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (platform, platform_id)
        REFERENCES channels(platform, platform_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
    id                  TEXT PRIMARY KEY,
    account_id          TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    platform            TEXT NOT NULL
                        {PLATFORM_CHECK_SQL},
    platform_id         TEXT NOT NULL,
    platform_message_id TEXT,
    sender_id           TEXT,
    sender_name         TEXT,
    content             TEXT NOT NULL DEFAULT '',
    timestamp           TEXT NOT NULL,
    raw_data            TEXT,
    created_at          TEXT NOT NULL,
    FOREIGN KEY (platform, platform_id)
        REFERENCES channels(platform, platform_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_platform_unique
    ON messages(platform, platform_id, platform_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp_id
    ON messages(timestamp DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp_asc
    ON messages(timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_messages_channel_timestamp_desc
    ON messages(platform, platform_id, timestamp DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_messages_account_id
    ON messages(account_id);

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
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_parent
    ON recurring_schedules(parent_task_id);
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

CREATE TABLE IF NOT EXISTS system_config (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_logs (
    id        TEXT PRIMARY KEY,
    time      TEXT NOT NULL,
    level     TEXT NOT NULL
              {APP_LOG_LEVEL_CHECK_SQL},
    category  TEXT NOT NULL,
    message   TEXT NOT NULL,
    details   TEXT
);
CREATE INDEX IF NOT EXISTS idx_app_logs_time ON app_logs(time DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_time_asc ON app_logs(time ASC);

CREATE TABLE IF NOT EXISTS actions (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    action_type         TEXT NOT NULL
                        CHECK (action_type IN ('telegram_bot','discord_webhook','http_webhook','mqtt')),
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
    status          TEXT NOT NULL CHECK (status IN ('success','failure')),
    error_message   TEXT,
    triggered_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trigger_history_action_time
    ON action_trigger_history(action_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_trigger_history_time
    ON action_trigger_history(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_trigger_history_triggered_at_asc
    ON action_trigger_history(triggered_at ASC);

CREATE TABLE IF NOT EXISTS user_events (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    body        TEXT NOT NULL DEFAULT '',
    start_time  TEXT NOT NULL,
    end_time    TEXT,
    location    TEXT NOT NULL DEFAULT '',
    origin      TEXT NOT NULL CHECK (origin IN ('manual', 'assistant', 'a2a', 'project', 'ics')),
    event_is_all_day INTEGER NOT NULL DEFAULT 0,
    event_timezone TEXT DEFAULT NULL,
    ics_uid     TEXT DEFAULT NULL,
    ics_source  TEXT DEFAULT NULL,
    ics_import_fingerprint TEXT DEFAULT NULL,
    task_id     TEXT DEFAULT NULL REFERENCES analysis_tasks(id) ON DELETE SET NULL,
    -- Ownership is always a workset; delete_workset reassigns to __user__ first.
    workset_id  TEXT NOT NULL DEFAULT '__user__' REFERENCES worksets(id),
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_events_start
    ON user_events(start_time ASC);
CREATE INDEX IF NOT EXISTS idx_user_events_created_at_asc
    ON user_events(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_user_events_task_id
    ON user_events(task_id);
CREATE INDEX IF NOT EXISTS idx_user_events_workset_id
    ON user_events(workset_id);
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

-- Soft-template categories for trackable items (global; ownership is via workset).
CREATE TABLE IF NOT EXISTS item_categories (
    id                          TEXT PRIMARY KEY,
    name                        TEXT NOT NULL,
    slug                        TEXT DEFAULT NULL,
    sort_order                  INTEGER NOT NULL DEFAULT 0,
    color                       TEXT DEFAULT NULL,
    emoji                       TEXT DEFAULT NULL,
    field_schema                TEXT NOT NULL DEFAULT '[]',
    default_remind_before_days  INTEGER DEFAULT NULL,
    created_at                  TEXT NOT NULL,
    updated_at                  TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_item_categories_slug
    ON item_categories(slug)
    WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_item_categories_sort
    ON item_categories(sort_order ASC, name ASC);

-- Trackable items (inventory / expiry). Core flat columns + soft attributes_json.
CREATE TABLE IF NOT EXISTS items (
    id                   TEXT PRIMARY KEY,
    title                TEXT NOT NULL,
    category_id          TEXT DEFAULT NULL
                         REFERENCES item_categories(id) ON DELETE SET NULL,
    workset_id           TEXT NOT NULL DEFAULT '__user__'
                         REFERENCES worksets(id),
    purchased_at         TEXT DEFAULT NULL,
    expires_at           TEXT DEFAULT NULL,
    remind_before_days   INTEGER DEFAULT NULL,
    notes                TEXT NOT NULL DEFAULT '',
    status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'archived')),
    emoji                TEXT DEFAULT NULL,
    attributes_json      TEXT NOT NULL DEFAULT '{{}}',
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_workset_id
    ON items(workset_id);
CREATE INDEX IF NOT EXISTS idx_items_category_id
    ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_status_expires
    ON items(status, expires_at ASC);
CREATE INDEX IF NOT EXISTS idx_items_updated_at_asc
    ON items(updated_at ASC);

INSERT OR IGNORE INTO item_categories (
    id, name, slug, sort_order, color, emoji, field_schema, default_remind_before_days, created_at, updated_at
) VALUES
(
    'seed_passport_docs', '證件', 'passport_docs', 10, '#3B82F6', '🪪',
    '[{{"key":"id_number","label":"證件號碼"}},{{"key":"issuer","label":"簽發機關"}}]',
    90, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_food', '食物', 'food', 20, '#22C55E', '🍎',
    '[{{"key":"brand","label":"品牌"}},{{"key":"storage","label":"保存方式"}}]',
    3, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_credit_card', '信用卡', 'credit_card', 30, '#F59E0B', '💳',
    '[{{"key":"issuer","label":"發卡行"}},{{"key":"last_four","label":"末四碼"}}]',
    14, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_warranty', '保固', 'warranty', 40, '#8B5CF6', '🛡️',
    '[{{"key":"serial","label":"序號"}},{{"key":"vendor","label":"廠商"}}]',
    30, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_contract', '合約', 'contract', 50, '#EC4899', '📄',
    '[{{"key":"counterparty","label":"相對方"}},{{"key":"ref_number","label":"合約編號"}}]',
    60, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_household', '家庭用品', 'household', 55, '#14B8A6', '🏠',
    '[{{"key":"brand","label":"品牌"}},{{"key":"location","label":"存放位置"}}]',
    14, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_medicine', '藥品', 'medicine', 60, '#EF4444', '💊',
    '[{{"key":"dosage","label":"用法"}},{{"key":"pharmacy","label":"藥局"}}]',
    7, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_subscription', '訂閱', 'subscription', 65, '#06B6D4', '🔁',
    '[{{"key":"provider","label":"服務商"}},{{"key":"plan","label":"方案"}}]',
    7, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_membership', '會員', 'membership', 70, '#A855F7', '🎫',
    '[{{"key":"provider","label":"機構"}},{{"key":"member_id","label":"會員編號"}}]',
    14, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_insurance', '保險', 'insurance', 75, '#0EA5E9', '☂️',
    '[{{"key":"insurer","label":"保險公司"}},{{"key":"policy_number","label":"保單號碼"}}]',
    30, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_vehicle', '車輛', 'vehicle', 80, '#F97316', '🚗',
    '[{{"key":"plate","label":"車牌"}},{{"key":"vin","label":"車架號碼"}}]',
    30, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_other', '其他', 'other', 90, '#64748B', '📦',
    '[]',
    NULL, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
);

-- Household admin (single-account password auth) + device sessions.
CREATE TABLE IF NOT EXISTS admin_accounts (
    id              TEXT PRIMARY KEY,
    username        TEXT NOT NULL,
    password_hash   TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    -- Application + schema enforce a single household admin row.
    singleton       INTEGER NOT NULL DEFAULT 1 CHECK (singleton = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_accounts_username
    ON admin_accounts(username);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_accounts_singleton
    ON admin_accounts(singleton);

CREATE TABLE IF NOT EXISTS device_sessions (
    id                  TEXT PRIMARY KEY,
    label               TEXT NOT NULL DEFAULT '',
    refresh_token_hash  TEXT NOT NULL,
    created_at          TEXT NOT NULL,
    last_seen_at        TEXT NOT NULL,
    expires_at          TEXT NOT NULL,
    revoked_at          TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_sessions_refresh_hash
    ON device_sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_device_sessions_expires
    ON device_sessions(expires_at);

CREATE TABLE IF NOT EXISTS device_access_tokens (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL REFERENCES device_sessions(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    expires_at  TEXT NOT NULL,
    revoked_at  TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_access_tokens_hash
    ON device_access_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_device_access_tokens_session
    ON device_access_tokens(session_id);

-- Household API access keys. Hash-only; plaintext returned once on create.
CREATE TABLE IF NOT EXISTS access_api_keys (
    id           TEXT PRIMARY KEY,
    label        TEXT NOT NULL DEFAULT '',
    secret_hash  TEXT NOT NULL,
    preview      TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL,
    revoked_at   TEXT,
    scopes       TEXT NOT NULL DEFAULT '["*"]',
    last_used_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_access_api_keys_secret_hash
    ON access_api_keys(secret_hash);

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
