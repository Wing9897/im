"""Contract keys: tasks mode-specific create paths."""

from __future__ import annotations

from server.tests import seed
from server.tests.contract_helpers import assert_keys
from server.tests.contract_tasks_helpers import TASK_KEYS


async def test_create_web_intel_requires_query_and_prompt(client):
    missing_query = await client.post(
        "/api/v1/tasks",
        json={
            "name": "web intel missing query",
            "promptTemplate": "Extract pricing changes",
            "analysisMode": "web_intel",
            "channelIds": [],
        },
    )
    assert missing_query.status_code == 422
    assert "webSearchQuery" in missing_query.json()["message"]

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


async def test_create_web_intel_defaults_hourly_and_echoes_query(client):
    create = await client.post(
        "/api/v1/tasks",
        json={
            "name": "web intel create",
            "promptTemplate": "Extract official pricing notes only",
            "webSearchQuery": "OpenAI pricing",
            "analysisMode": "web_intel",
            "channelIds": [f"{seed.TG_CHANNEL[0]}:{seed.TG_CHANNEL[1]}"],
        },
    )
    assert create.status_code == 201
    body = create.json()
    assert_keys(body, TASK_KEYS, "AnalysisTask web_intel create")
    assert body["analysisMode"] == "web_intel"
    assert body["webSearchQuery"] == "OpenAI pricing"
    assert body["scheduleRrule"] == "FREQ=HOURLY"
    # Channels may be stored but are unused by web_intel ticks / FE clears them in UX.
    assert isinstance(body["channelIds"], list)


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
        assert preset.get("webSearchQuery")
        assert preset.get("promptTemplate")
