"""Contract keys: tasks mode-specific create paths."""

from __future__ import annotations

from server.tests import seed
from server.tests.contract_helpers import assert_keys
from server.tests.contract_tasks_helpers import TASK_KEYS

_AGENT_WEB_SCOUT = {
    "triggerMode": "schedule",
    "capCalendarRead": True,
    "capCalendarWrites": False,
    "capWebSearch": True,
    "capForceWebSearch": True,
    "capReadAnalysisEvents": True,
    "capReadItems": True,
    "outputCalendar": False,
    "outputAnalysisEvents": True,
}

_AGENT_PROJECT_RECONCILE = {
    "triggerMode": "message_cursor",
    "capCalendarRead": True,
    "capCalendarWrites": True,
    "capWebSearch": False,
    "capForceWebSearch": False,
    "capReadAnalysisEvents": True,
    "capReadItems": True,
    "outputCalendar": True,
    "outputAnalysisEvents": False,
}


async def test_create_agent_requires_prompt_and_outputs(client):
    missing_prompt = await client.post(
        "/api/v1/tasks",
        json={
            "name": "agent missing prompt",
            "promptTemplate": "",
            "analysisMode": "agent",
            "channelIds": [],
            **_AGENT_WEB_SCOUT,
        },
    )
    assert missing_prompt.status_code == 422
    assert "promptTemplate" in missing_prompt.json()["message"]

    missing_outputs = await client.post(
        "/api/v1/tasks",
        json={
            "name": "agent missing outputs",
            "promptTemplate": "Do something useful",
            "analysisMode": "agent",
            "channelIds": [],
            "triggerMode": "schedule",
            "outputCalendar": False,
            "outputAnalysisEvents": False,
        },
    )
    assert missing_outputs.status_code == 422

    ok = await client.post(
        "/api/v1/tasks",
        json={
            "name": "agent web scout",
            "promptTemplate": "Search for pricing changes and emit events",
            "analysisMode": "agent",
            "channelIds": [],
            **_AGENT_WEB_SCOUT,
        },
    )
    assert ok.status_code == 201
    body = ok.json()
    assert body["analysisMode"] == "agent"
    assert body["outputAnalysisEvents"] is True
    assert body["outputCalendar"] is False
    assert body["webSearchQuery"] == ""


async def test_create_agent_web_scout_defaults_hourly(client):
    create = await client.post(
        "/api/v1/tasks",
        json={
            "name": "agent create",
            "promptTemplate": "Extract official pricing notes only",
            "webSearchQuery": "OpenAI pricing",
            "analysisMode": "agent",
            "channelIds": [],
            **_AGENT_WEB_SCOUT,
        },
    )
    assert create.status_code == 201
    body = create.json()
    assert_keys(body, TASK_KEYS, "AnalysisTask agent create")
    assert body["analysisMode"] == "agent"
    assert body["webSearchQuery"] == ""
    assert body["scheduleRrule"] == "FREQ=HOURLY"
    assert body["channelIds"] == []
    assert body["triggerMode"] == "schedule"
    assert body["capForceWebSearch"] is True
    assert body["capWebSearch"] is True
    assert body["capReadAnalysisEvents"] is True
    assert body["capReadItems"] is True
    assert body["outputAnalysisEvents"] is True


async def test_create_agent_may_bind_channels_for_threshold(client):
    create = await client.post(
        "/api/v1/tasks",
        json={
            "name": "agent with channels",
            "promptTemplate": "Verify rumours via web search",
            "analysisMode": "agent",
            "channelIds": [f"{seed.TG_CHANNEL[0]}:{seed.TG_CHANNEL[1]}"],
            "analysisTriggerThreshold": 2,
            "triggerMode": "message_threshold",
            "capCalendarRead": True,
            "capWebSearch": True,
            "capForceWebSearch": True,
            "outputCalendar": False,
            "outputAnalysisEvents": True,
        },
    )
    assert create.status_code == 201
    body = create.json()
    assert body["analysisMode"] == "agent"
    assert body["channelIds"]
    assert body["analysisTriggerThreshold"] == 2
    assert body["triggerMode"] == "message_threshold"


async def test_update_to_agent_keeps_channels(client):
    create = await client.post(
        "/api/v1/tasks",
        json={
            "name": "agent keep channels",
            "promptTemplate": "Extract official pricing notes only",
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
            "name": "agent keep channels",
            "promptTemplate": "Extract official pricing notes only",
            "analysisMode": "agent",
            "channelIds": [f"{seed.TG_CHANNEL[0]}:{seed.TG_CHANNEL[1]}"],
            "scheduleRrule": "FREQ=HOURLY",
            **_AGENT_WEB_SCOUT,
            "triggerMode": "message_threshold",
        },
    )
    assert update.status_code == 200
    assert update.json()["analysisMode"] == "agent"
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


async def test_create_agent_project_reconcile_happy_path(client):
    create = await client.post(
        "/api/v1/tasks",
        json={
            "name": "project reconcile create",
            "promptTemplate": "Reconcile project dates",
            "analysisMode": "agent",
            "channelIds": [f"{seed.TG_CHANNEL[0]}:{seed.TG_CHANNEL[1]}"],
            "scheduleRrule": "FREQ=HOURLY",
            **_AGENT_PROJECT_RECONCILE,
        },
    )
    assert create.status_code == 201
    body = create.json()
    assert body["analysisMode"] == "agent"
    assert body["scheduleRrule"] == "FREQ=HOURLY"
    assert body["webSearchQuery"] == ""
    assert body["triggerMode"] == "message_cursor"
    assert body["outputCalendar"] is True
    assert body["outputAnalysisEvents"] is False


async def test_task_templates_include_agent_presets(client):
    resp = await client.get("/api/v1/tasks/templates")
    assert resp.status_code == 200
    body = resp.json()
    agent_presets = [p for p in body if p.get("analysisMode") == "agent"]
    assert len(agent_presets) >= 2
    for preset in agent_presets:
        assert preset.get("webSearchQuery", "") == ""
        assert preset.get("promptTemplate")
