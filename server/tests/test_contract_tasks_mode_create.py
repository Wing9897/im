"""Contract keys: tasks mode-specific create paths."""

from __future__ import annotations

from server.tests import seed
from server.tests.contract_helpers import assert_keys
from server.tests.contract_tasks_helpers import TASK_KEYS


async def test_create_web_intel_requires_prompt_query_optional(client):
    missing_prompt = await client.post(
        "/api/v1/tasks",
        json={
            "name": "web intel missing prompt",
            "promptTemplate": "",
            "webSearchQuery": "OpenAI pricing",
            "analysisMode": "web_intel",
            "channelIds": [],
        },
    )
    assert missing_prompt.status_code == 422
    assert "promptTemplate" in missing_prompt.json()["message"]

    ok = await client.post(
        "/api/v1/tasks",
        json={
            "name": "web intel no query",
            "promptTemplate": "Search for pricing changes and emit events",
            "analysisMode": "web_intel",
            "channelIds": [],
        },
    )
    assert ok.status_code == 201
    assert ok.json()["webSearchQuery"] == ""


async def test_create_web_intel_defaults_hourly_and_clears_query(client):
    create = await client.post(
        "/api/v1/tasks",
        json={
            "name": "web intel create",
            "promptTemplate": "Extract official pricing notes only",
            "webSearchQuery": "OpenAI pricing",
            "analysisMode": "web_intel",
            "channelIds": [],
        },
    )
    assert create.status_code == 201
    body = create.json()
    assert_keys(body, TASK_KEYS, "AnalysisTask web_intel create")
    assert body["analysisMode"] == "web_intel"
    assert body["webSearchQuery"] == ""
    assert body["scheduleRrule"] == "FREQ=HOURLY"
    assert body["channelIds"] == []


async def test_create_web_intel_may_bind_channels(client):
    create = await client.post(
        "/api/v1/tasks",
        json={
            "name": "web intel with channels",
            "promptTemplate": "Verify rumours via web search",
            "webSearchQuery": "optional seed",
            "analysisMode": "web_intel",
            "channelIds": [f"{seed.TG_CHANNEL[0]}:{seed.TG_CHANNEL[1]}"],
            "analysisTriggerThreshold": 2,
        },
    )
    assert create.status_code == 201
    body = create.json()
    assert body["analysisMode"] == "web_intel"
    assert body["channelIds"]
    assert body["analysisTriggerThreshold"] == 2


async def test_update_web_intel_keeps_channels(client):
    create = await client.post(
        "/api/v1/tasks",
        json={
            "name": "web intel keep channels",
            "promptTemplate": "Extract official pricing notes only",
            "webSearchQuery": "OpenAI pricing",
            "analysisMode": "intel_event",
            "channelIds": [f"{seed.TG_CHANNEL[0]}:{seed.TG_CHANNEL[1]}"],
            "scheduleRrule": "FREQ=HOURLY",
        },
    )
    assert create.status_code == 201
    task_id = create.json()["id"]
    assert create.json()["channelIds"]

    update = await client.put(
        f"/api/v1/tasks/{task_id}",
        json={
            "name": "web intel keep channels",
            "promptTemplate": "Extract official pricing notes only",
            "webSearchQuery": "OpenAI pricing",
            "analysisMode": "web_intel",
            "channelIds": [f"{seed.TG_CHANNEL[0]}:{seed.TG_CHANNEL[1]}"],
            "scheduleRrule": "FREQ=HOURLY",
        },
    )
    assert update.status_code == 200
    assert update.json()["analysisMode"] == "web_intel"
    assert update.json()["channelIds"]


async def test_create_leaderboard_happy_path(client):
    create = await client.post(
        "/api/v1/tasks",
        json={
            "name": "leaderboard create",
            "promptTemplate": "Rank hot topics",
            "analysisMode": "leaderboard",
            "analysisTimeRange": "1d",
            "channelIds": [f"{seed.TG_CHANNEL[0]}:{seed.TG_CHANNEL[1]}"],
            "scheduleRrule": "FREQ=HOURLY",
        },
    )
    assert create.status_code == 201
    body = create.json()
    assert body["analysisMode"] == "leaderboard"
    assert body["name"] == "leaderboard create"
    assert body["channelIds"]


async def test_create_project_happy_path(client):
    create = await client.post(
        "/api/v1/tasks",
        json={
            "name": "project create",
            "promptTemplate": "Reconcile project dates",
            "analysisMode": "project",
            "channelIds": [f"{seed.TG_CHANNEL[0]}:{seed.TG_CHANNEL[1]}"],
            "scheduleRrule": "FREQ=HOURLY",
        },
    )
    assert create.status_code == 201
    body = create.json()
    assert body["analysisMode"] == "project"
    assert body["scheduleRrule"] == "FREQ=HOURLY"
    assert body["webSearchQuery"] == ""


async def test_task_templates_include_web_intel_presets(client):
    resp = await client.get("/api/v1/tasks/templates")
    assert resp.status_code == 200
    body = resp.json()
    web_intel = [p for p in body if p.get("analysisMode") == "web_intel"]
    assert len(web_intel) >= 2
    for preset in web_intel:
        assert preset.get("webSearchQuery", "") == ""
        assert preset.get("promptTemplate")
