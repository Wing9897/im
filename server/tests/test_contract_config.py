"""Contract keys: config routes (settings snapshot / retired LLM slots)."""

from __future__ import annotations

from server.api.routes.config import _SETTINGS_KEYS
from server.api.schemas.responses import SystemSettingsSnapshot
from server.config import CONFIG_DEFAULTS
from server.tests.contract_helpers import assert_keys

#: Wire keys — single source is ``_SETTINGS_KEYS`` in config routes.
SETTINGS_KEYS = list(_SETTINGS_KEYS)

_INTERNAL_CONFIG_KEYS = frozenset(
    {
        "localhost_auth_exempt",
        "setup_complete",
        # Project tick knobs — server-owned; not on SystemSettingsSnapshot yet.
        "agent_max_tool_rounds",
        "agent_max_drain_waves",
        # AI profile global slots — managed via /api/v1/llm/global-slots, not Settings wire.
        "llm_global_slot_assistant",
        "llm_global_slot_liaison",
        "llm_global_slot_task_editor",
    }
)

#: Retired config keys (removed implementations) that must stay retired.
_RETIRED_CONFIG_KEYS = frozenset(
    {
        "analysis_spatiotemporal_mode",
        "auto_pause_on_rate_limit",
        "data_retention_days",
        # Schema v9: household keys live in access_api_keys table (hash-only).
        "ingestion_api_key",
        "access_api_keys",
        # Device-scoped assistant sessions live in ui_prefs.
        "assistant_sessions",
        # Board / notify / timeline / assistant voice-io live in ui_prefs (wipe-only).
        "ops_board_layout",
        "ops_board_widget_state",
        "voice_reminder_settings",
        "voice_reminder_fired",
        "voice_reminder_trigger_history",
        "notify_settings",
        "notify_fired",
        "notify_trigger_history",
        "assistant_voice_io_settings",
        "timeline_annotations",
        # Per-task scheduling columns are task-owned; no longer system_config globals.
        "batch_overlap_count",
        "agent_project_wave_interval_seconds",
        # Prompt revision tag removed — correlate via git / prompt files, not system_config.
        "intelligence_rules_version",
        # LLM connection slots live on llm_profiles (see docs/SCHEMA-BASELINE.md).
        "llm_provider",
        "ollama_base_url",
        "ollama_model",
        "ollama_thinking_enabled",
        "openai_base_url",
        "openai_model",
        "openai_api_key",
        "openai_json_mode",
        "gemini_base_url",
        "gemini_model",
        "gemini_api_key",
        "openrouter_base_url",
        "openrouter_model",
        "openrouter_api_key",
        "assistant_llm_provider",
        "assistant_llm_base_url",
        "assistant_llm_model",
        "assistant_llm_api_key",
        "assistant_web_search_enabled",
        "web_search_provider",
        "brave_search_api_key",
        "mcp_workset_scope",
        "mcp_workset_ids",
    }
)

#: Retired camelCase wire keys that must stay absent from settings snapshot.
_RETIRED_WIRE_KEYS = frozenset(
    {
        "llmProvider",
        "ollamaBaseUrl",
        "ollamaModel",
        "ollamaThinkingEnabled",
        "openaiBaseUrl",
        "openaiModel",
        "openaiApiKey",
        "openaiJsonMode",
        "geminiBaseUrl",
        "geminiModel",
        "geminiApiKey",
        "openrouterBaseUrl",
        "openrouterModel",
        "openrouterApiKey",
        "assistantLlmProvider",
        "assistantLlmBaseUrl",
        "assistantLlmModel",
        "assistantLlmApiKey",
        "assistantWebSearchEnabled",
        "webSearchProvider",
        "braveSearchApiKey",
        "dataRetentionDays",
        "autoPauseOnRateLimit",
        "mcpWorksetScope",
        "mcpWorksetIds",
    }
)


def test_settings_keys_align_across_config_api_and_response_model():
    api_config_keys = set(_SETTINGS_KEYS.values())
    snapshot_keys = set(SystemSettingsSnapshot.model_fields)

    assert snapshot_keys == set(SETTINGS_KEYS)

    for key in _RETIRED_CONFIG_KEYS:
        assert key not in CONFIG_DEFAULTS

    for config_key in api_config_keys:
        assert config_key in CONFIG_DEFAULTS, f"missing CONFIG_DEFAULTS entry for {config_key}"

    exposed_defaults = set(CONFIG_DEFAULTS) - _INTERNAL_CONFIG_KEYS
    assert api_config_keys == exposed_defaults


def test_retention_defaults_keep_analysis_and_calendar():
    """Intel/analysis events and calendar user_events default to keep-forever (0)."""
    assert CONFIG_DEFAULTS["retention_messages_days"] == "90"
    assert CONFIG_DEFAULTS["retention_analysis_days"] == "0"
    assert CONFIG_DEFAULTS["retention_leaderboard_days"] == "90"
    assert CONFIG_DEFAULTS["retention_app_logs_days"] == "30"
    assert CONFIG_DEFAULTS["retention_user_events_days"] == "0"


async def test_settings_snapshot_and_roundtrip(client):
    resp = await client.get("/api/v1/config/settings")
    snapshot = resp.json()
    assert_keys(snapshot, SETTINGS_KEYS, "SystemSettingsSnapshot")
    assert isinstance(snapshot["analysisPaused"], bool)
    assert isinstance(snapshot["analysisTraceVerbose"], bool)
    assert isinstance(snapshot["autoPauseOnRetriesExhausted"], bool)
    assert snapshot["mcpEnabled"] is True
    assert snapshot["a2aEnabled"] is True
    assert isinstance(snapshot["maxConcurrentBatches"], str)
    for retired in _RETIRED_WIRE_KEYS:
        assert retired not in snapshot

    snapshot["maxConcurrentBatches"] = "3"
    snapshot["agentHistoryMaxMessages"] = "48"
    saved = (await client.put("/api/v1/config/settings", json=snapshot)).json()
    assert saved["maxConcurrentBatches"] == "3"
    assert saved["agentHistoryMaxMessages"] == "48"

    again = (await client.get("/api/v1/config/settings")).json()
    assert again["maxConcurrentBatches"] == "3"
    assert again["agentHistoryMaxMessages"] == "48"
    assert "dataRetentionDays" not in again
    assert "retentionMessagesDays" in again
    assert again["uiLocale"] == "zh-Hant"
    assert "llmProvider" not in again


async def test_a2a_and_mcp_master_switches_persist_independently(client):
    saved = (await client.put("/api/v1/config/settings", json={"a2aEnabled": False})).json()
    assert saved["a2aEnabled"] is False
    assert saved["mcpEnabled"] is True

    saved = (await client.put("/api/v1/config/settings", json={"mcpEnabled": False})).json()
    assert saved["mcpEnabled"] is False
    assert saved["a2aEnabled"] is False

    saved = (await client.put("/api/v1/config/settings", json={"a2aEnabled": True})).json()
    assert saved["a2aEnabled"] is True
    assert saved["mcpEnabled"] is False


async def test_ui_locale_settings_roundtrip(client):
    before = (await client.get("/api/v1/config/settings")).json()
    assert before["uiLocale"] == "zh-Hant"

    saved = (await client.put("/api/v1/config/settings", json={**before, "uiLocale": "en"})).json()
    assert saved["uiLocale"] == "en"

    again = (await client.get("/api/v1/config/settings")).json()
    assert again["uiLocale"] == "en"

    # Invalid tokens normalize to zh-Hant
    normalized = (await client.put("/api/v1/config/settings", json={**again, "uiLocale": "fr"})).json()
    assert normalized["uiLocale"] == "zh-Hant"

    # Client preference ``auto`` is not a valid server uiLocale
    rejected_auto = (await client.put("/api/v1/config/settings", json={**again, "uiLocale": "auto"})).json()
    assert rejected_auto["uiLocale"] == "zh-Hant"


async def test_trigger_threshold_and_batch_limit_independent_roundtrip(client):
    """Trigger threshold (min to start) and batch limit (max per batch) persist separately."""
    before = (await client.get("/api/v1/config/settings")).json()
    payload = {
        **before,
        "analysisTriggerThreshold": "1",
        "analysisBatchMessageLimit": "50",
    }
    saved = (await client.put("/api/v1/config/settings", json=payload)).json()
    assert saved["analysisTriggerThreshold"] == "1"
    assert saved["analysisBatchMessageLimit"] == "50"

    again = (await client.get("/api/v1/config/settings")).json()
    assert again["analysisTriggerThreshold"] == "1"
    assert again["analysisBatchMessageLimit"] == "50"


async def test_settings_put_ignores_analysis_paused(client):
    """analysisPaused is read-only on PUT /settings; use POST /system/analysis/pause."""
    before = (await client.get("/api/v1/config/settings")).json()
    assert before["analysisPaused"] is False

    await client.post(
        "/api/v1/system/analysis/pause",
        json={"paused": True},
    )
    paused = (await client.get("/api/v1/config/settings")).json()
    assert paused["analysisPaused"] is True

    # Stale snapshot with analysisPaused=false must not resume scheduler.
    stale = {**paused, "analysisPaused": False}
    saved = (await client.put("/api/v1/config/settings", json=stale)).json()
    assert saved["analysisPaused"] is True

    again = (await client.get("/api/v1/config/settings")).json()
    assert again["analysisPaused"] is True


async def test_settings_put_rejects_invalid_max_concurrent_batches(client):
    """Non-integer maxConcurrentBatches → 422 (was: silent try/except pass)."""
    before = (await client.get("/api/v1/config/settings")).json()
    stored = before["maxConcurrentBatches"]

    resp = await client.put(
        "/api/v1/config/settings",
        json={"maxConcurrentBatches": "not-a-number"},
    )
    assert resp.status_code == 422

    again = (await client.get("/api/v1/config/settings")).json()
    assert again["maxConcurrentBatches"] == stored


async def test_settings_put_rejects_retired_retention_key(client, app):
    """Retired dataRetentionDays wire key → 422; never stored."""
    before = (await client.get("/api/v1/config/settings")).json()
    messages = before["retentionMessagesDays"]
    probe = "1" if messages != "1" else "2"

    resp = await client.put(
        "/api/v1/config/settings",
        json={**before, "dataRetentionDays": probe},
    )
    assert resp.status_code == 422
    again = (await client.get("/api/v1/config/settings")).json()
    assert again["retentionMessagesDays"] == messages
    stored = await app.state.db.fetch_value("SELECT COUNT(*) FROM system_config WHERE key = 'data_retention_days'")
    assert stored == 0


async def test_settings_put_rejects_retired_llm_provider_keys(client, app):
    """Stamp-29: retired LLM wire keys on settings PUT → 422."""
    before = (await client.get("/api/v1/config/settings")).json()
    resp = await client.put(
        "/api/v1/config/settings",
        json={
            **before,
            "llmProvider": "openai_compatible",
            "openaiApiKey": "sk-should-not-store",
            "openaiModel": "gpt-ignored",
            "assistantLlmProvider": "openai",
            "braveSearchApiKey": "brave-ignored",
        },
    )
    assert resp.status_code == 422

    for key in (
        "llm_provider",
        "openai_api_key",
        "openai_model",
        "assistant_llm_provider",
        "brave_search_api_key",
    ):
        count = await app.state.db.fetch_value("SELECT COUNT(*) FROM system_config WHERE key = ?", (key,))
        assert count == 0


async def test_assistant_identity_settings_roundtrip(client):
    before = (await client.get("/api/v1/config/settings")).json()
    assert before["assistantDisplayName"] == ""
    assert before["assistantAvatar"] == ""

    avatar = "data:image/jpeg;base64,abc123"
    saved = (
        await client.put(
            "/api/v1/config/settings",
            json={
                **before,
                "assistantDisplayName": "  Helix  ",
                "assistantAvatar": avatar,
            },
        )
    ).json()
    assert saved["assistantDisplayName"] == "Helix"
    assert saved["assistantAvatar"] == avatar

    again = (await client.get("/api/v1/config/settings")).json()
    assert again["assistantDisplayName"] == "Helix"
    assert again["assistantAvatar"] == avatar

    # Invalid avatar (not a data URL) → 422; previous value kept.
    rejected = await client.put(
        "/api/v1/config/settings",
        json={**again, "assistantAvatar": "https://example.com/x.png"},
    )
    assert rejected.status_code == 422
    assert (await client.get("/api/v1/config/settings")).json()["assistantAvatar"] == avatar

    cleared = (
        await client.put(
            "/api/v1/config/settings",
            json={**again, "assistantDisplayName": "", "assistantAvatar": ""},
        )
    ).json()
    assert cleared["assistantDisplayName"] == ""
    assert cleared["assistantAvatar"] == ""


async def test_user_profile_settings_roundtrip(client):
    before = (await client.get("/api/v1/config/settings")).json()
    assert before["userDisplayName"] == ""
    assert before["userAvatar"] == ""
    assert before["userBackground"] == ""

    avatar = "data:image/jpeg;base64,useravatar"
    saved = (
        await client.put(
            "/api/v1/config/settings",
            json={
                **before,
                "userDisplayName": "  Wing  ",
                "userAvatar": avatar,
                "userBackground": "  Ops lead  ",
            },
        )
    ).json()
    assert saved["userDisplayName"] == "Wing"
    assert saved["userAvatar"] == avatar
    assert saved["userBackground"] == "  Ops lead  "

    again = (await client.get("/api/v1/config/settings")).json()
    assert again["userDisplayName"] == "Wing"
    assert again["userAvatar"] == avatar
    assert again["userBackground"] == "  Ops lead  "

    rejected = await client.put(
        "/api/v1/config/settings",
        json={**again, "userAvatar": "https://example.com/x.png"},
    )
    assert rejected.status_code == 422
    assert (await client.get("/api/v1/config/settings")).json()["userAvatar"] == avatar

    cleared = (
        await client.put(
            "/api/v1/config/settings",
            json={
                **again,
                "userDisplayName": "",
                "userAvatar": "",
                "userBackground": "",
            },
        )
    ).json()
    assert cleared["userDisplayName"] == ""
    assert cleared["userAvatar"] == ""
    assert cleared["userBackground"] == ""
