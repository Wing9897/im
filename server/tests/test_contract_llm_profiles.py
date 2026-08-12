"""Contract tests for LLM profiles / staff-instances (stamp 29)."""

from __future__ import annotations

from server.llm_profiles_const import DEFAULT_LLM_PROFILE_ID, LLM_STAFF_CLASSES
from server.secrets import MASKED_SECRET
from server.tests.contract_helpers import assert_keys

PROFILE_KEYS = [
    "id",
    "name",
    "provider",
    "baseUrl",
    "model",
    "apiKey",
    "thinkingEnabled",
    "jsonMode",
    "webSearchEnabled",
    "webSearchProvider",
    "braveSearchApiKey",
    "isDefault",
    "staffClasses",
    "staffInstances",
    "createdAt",
    "updatedAt",
]

STAFF_KEYS = [
    "id",
    "staffClass",
    "profileId",
    "displayName",
    "isActive",
    "createdAt",
    "updatedAt",
]


async def test_list_profiles_includes_seeded_default_and_staff(client):
    """Test seed (not DDL) provides a complete default profile + staff bindings."""
    resp = await client.get("/api/v1/llm/profiles")
    assert resp.status_code == 200
    profiles = resp.json()
    assert len(profiles) >= 1
    default = next(p for p in profiles if p["id"] == DEFAULT_LLM_PROFILE_ID)
    assert_keys(default, PROFILE_KEYS, "LlmProfile")
    assert default["isDefault"] is True
    assert default["provider"] == "ollama"
    assert default["model"]
    assert set(default["staffClasses"]) == set(LLM_STAFF_CLASSES)

    staff = (await client.get("/api/v1/llm/staff-instances")).json()
    assert len(staff) >= 4
    for row in staff:
        assert_keys(row, STAFF_KEYS, "LlmStaffInstance")
    classes = {row["staffClass"] for row in staff if row["profileId"] == DEFAULT_LLM_PROFILE_ID}
    assert classes == set(LLM_STAFF_CLASSES)


async def test_create_patch_copy_set_default_profile_roundtrip(client, app):
    create = await client.post(
        "/api/v1/llm/profiles",
        json={
            "name": "OpenAI pack",
            "provider": "openai_compatible",
            "baseUrl": "https://api.openai.com/v1",
            "model": "gpt-test",
            "apiKey": "sk-contract-secret",
            "thinkingEnabled": False,
            "jsonMode": "disabled",
            "webSearchEnabled": True,
            "webSearchProvider": "auto",
            "staffClasses": ["agent"],
            "isDefault": False,
        },
    )
    assert create.status_code == 201
    created = create.json()
    assert_keys(created, PROFILE_KEYS, "LlmProfile create")
    profile_id = created["id"]
    assert created["apiKey"] == MASKED_SECRET
    assert created["isDefault"] is False
    assert created["staffClasses"] == ["agent"]
    # ``assistant`` on upsert is ignored — bind via global slots instead.
    assert "assistant" not in created["staffClasses"]

    raw = await app.state.db.fetch_value("SELECT api_key FROM llm_profiles WHERE id = ?", (profile_id,))
    assert str(raw).startswith("enc:v1:")
    assert "sk-contract-secret" not in str(raw)

    patch = await client.patch(
        f"/api/v1/llm/profiles/{profile_id}",
        json={
            "name": "OpenAI pack v2",
            "provider": "openai_compatible",
            "baseUrl": "https://api.openai.com/v1",
            "model": "gpt-test-2",
            "apiKey": MASKED_SECRET,
            "thinkingEnabled": False,
            "jsonMode": "disabled",
            "webSearchEnabled": False,
            "webSearchProvider": "brave",
            "staffClasses": ["agent", "leaderboard"],
        },
    )
    assert patch.status_code == 200
    patched = patch.json()
    assert patched["name"] == "OpenAI pack v2"
    assert patched["model"] == "gpt-test-2"
    assert patched["webSearchEnabled"] is False
    assert set(patched["staffClasses"]) == {"agent", "leaderboard"}
    # Masked key must preserve prior ciphertext.
    assert await app.state.db.fetch_value("SELECT api_key FROM llm_profiles WHERE id = ?", (profile_id,)) == raw

    copy = await client.post(
        f"/api/v1/llm/profiles/{profile_id}/copy",
        json={"name": "OpenAI pack copy"},
    )
    assert copy.status_code == 201
    copied = copy.json()
    assert copied["id"] != profile_id
    assert copied["name"] == "OpenAI pack copy"
    assert copied["isDefault"] is False
    assert copied["model"] == "gpt-test-2"

    set_default = await client.post(f"/api/v1/llm/profiles/{profile_id}/set-default")
    assert set_default.status_code == 200
    assert set_default.json()["isDefault"] is True
    default_id = await app.state.db.fetch_value("SELECT id FROM llm_profiles WHERE is_default = 1")
    assert default_id == profile_id

    # Restore seeded default so later tests stay predictable.
    restore = await client.post(f"/api/v1/llm/profiles/{DEFAULT_LLM_PROFILE_ID}/set-default")
    assert restore.status_code == 200
    assert restore.json()["isDefault"] is True


async def test_task_create_defaults_llm_profile_id(client):
    create = await client.post(
        "/api/v1/tasks",
        json={
            "name": "profile-bound task",
            "promptTemplate": "analyze",
            "analysisMode": "intel_event",
            "analysisTimeRange": "1d",
            "channelIds": [],
            "scheduleRrule": "FREQ=HOURLY",
        },
    )
    assert create.status_code == 201
    body = create.json()
    assert body["llmProfileId"] == DEFAULT_LLM_PROFILE_ID

    # Explicit override
    create2 = await client.post(
        "/api/v1/tasks",
        json={
            "name": "explicit profile task",
            "promptTemplate": "analyze",
            "analysisMode": "leaderboard",
            "analysisTimeRange": "all",
            "channelIds": [],
            "scheduleRrule": "FREQ=DAILY",
            "llmProfileId": DEFAULT_LLM_PROFILE_ID,
        },
    )
    assert create2.status_code == 201
    assert create2.json()["llmProfileId"] == DEFAULT_LLM_PROFILE_ID


async def test_task_create_rejects_incomplete_profile(client, app):
    incomplete_id = "profile-incomplete"
    now = "2026-07-01T12:00:00+00:00"
    await app.state.db.execute(
        "INSERT INTO llm_profiles ("
        "id, name, provider, base_url, model, api_key, thinking_enabled, json_mode, "
        "web_search_enabled, web_search_provider, brave_search_api_key, is_default, "
        "created_at, updated_at"
        ") VALUES (?, 'Incomplete', 'ollama', 'http://localhost:11434', '', '', 0, 'disabled', "
        "1, 'auto', '', 0, ?, ?)",
        (incomplete_id, now, now),
    )
    create = await client.post(
        "/api/v1/tasks",
        json={
            "name": "blocked incomplete",
            "promptTemplate": "analyze",
            "analysisMode": "leaderboard",
            "analysisTimeRange": "1d",
            "channelIds": [],
            "scheduleRrule": "FREQ=HOURLY",
            "llmProfileId": incomplete_id,
        },
    )
    assert create.status_code == 400
    assert "model" in str(create.json().get("message") or "").lower()


async def test_task_create_rejects_when_no_profiles(client, app):
    await app.state.db.execute("DELETE FROM analysis_tasks")
    await app.state.db.execute("DELETE FROM llm_staff_instances")
    await app.state.db.execute("DELETE FROM llm_profiles")
    create = await client.post(
        "/api/v1/tasks",
        json={
            "name": "no profile",
            "promptTemplate": "analyze",
            "analysisMode": "leaderboard",
            "analysisTimeRange": "1d",
            "channelIds": [],
            "scheduleRrule": "FREQ=HOURLY",
        },
    )
    assert create.status_code == 400
    message = str(create.json().get("message") or "").lower()
    assert "profile" in message

    first = await client.post(
        "/api/v1/llm/profiles",
        json={
            "name": "First pack",
            "provider": "ollama",
            "baseUrl": "http://localhost:11434",
            "model": "llama-first",
            "staffClasses": [],
            "isDefault": False,
        },
    )
    assert first.status_code == 201
    assert first.json()["isDefault"] is True


async def test_settings_put_with_llm_provider_rejected(client, app):
    before = (await client.get("/api/v1/config/settings")).json()
    resp = await client.put(
        "/api/v1/config/settings",
        json={**before, "llmProvider": "openai_compatible", "openaiApiKey": "sk-nope"},
    )
    assert resp.status_code == 422
    assert await app.state.db.fetch_value("SELECT COUNT(*) FROM system_config WHERE key = 'llm_provider'") == 0
    assert await app.state.db.fetch_value("SELECT COUNT(*) FROM system_config WHERE key = 'openai_api_key'") == 0


async def test_global_slots_list_and_rebind(client, app):
    listed = await client.get("/api/v1/llm/global-slots")
    assert listed.status_code == 200
    payload = listed.json()
    assert {row["slot"] for row in payload["slots"]} == {"assistant", "liaison", "taskEditor"}
    for row in payload["slots"]:
        assert row["profileId"] == DEFAULT_LLM_PROFILE_ID

    create = await client.post(
        "/api/v1/llm/profiles",
        json={
            "name": "Liaison pack",
            "provider": "ollama",
            "baseUrl": "http://localhost:11434",
            "model": "llama-liaison",
            "staffClasses": [],
        },
    )
    assert create.status_code == 201
    other_id = create.json()["id"]

    bind = await client.put(
        "/api/v1/llm/global-slots/liaison",
        json={"profileId": other_id},
    )
    assert bind.status_code == 200
    assert bind.json()["slot"] == "liaison"
    assert bind.json()["profileId"] == other_id

    clear = await client.put(
        "/api/v1/llm/global-slots/taskEditor",
        json={"profileId": None},
    )
    assert clear.status_code == 200
    assert clear.json()["profileId"] is None

    rebound = await client.put(
        "/api/v1/llm/global-slots/assistant",
        json={"profileId": other_id},
    )
    assert rebound.status_code == 200
    assert rebound.json()["profileId"] == other_id
    # Singleton: only one assistant staff instance remains.
    staff = await app.state.db.fetch_all(
        "SELECT profile_id FROM llm_staff_instances WHERE staff_class = 'assistant'",
    )
    assert len(staff) == 1
    assert staff[0]["profile_id"] == other_id
