"""Contract keys: actions routes."""

from __future__ import annotations

import json

from server.secrets import MASKED_SECRET, unprotect_text
from server.tests import seed
from server.tests.contract_helpers import assert_keys


async def test_actions_list(client):
    resp = await client.get("/api/v1/actions")
    body = resp.json()
    assert len(body) == 1
    action = body[0]
    assert_keys(
        action,
        ["id", "name", "actionType", "isEnabled", "lastTriggeredAt", "configuration", "triggerConditions"],
        "Action",
    )
    # configuration / triggerConditions are JSON *strings* on the wire.
    assert isinstance(action["configuration"], str)
    parsed = json.loads(action["triggerConditions"])
    assert set(parsed) >= {"score_threshold", "task_id"}


async def test_actions_crud_and_toggle(client, app):
    create = await client.post(
        "/api/v1/actions",
        json={
            "name": "tg 通知",
            "actionType": "telegram_bot",
            "configuration": '{"bot_token": "t", "chat_id": "1"}',
            "triggerConditions": None,
        },
    )
    assert create.status_code == 201
    created = create.json()
    action_id = created["id"]
    assert json.loads(created["configuration"])["bot_token"] == MASKED_SECRET

    update = await client.put(
        f"/api/v1/actions/{action_id}",
        json={
            "name": "tg 通知 v2",
            "actionType": "telegram_bot",
            "configuration": '{"bot_token": "t2", "chat_id": "2"}',
            "triggerConditions": '{"score_threshold": 0.8}',
        },
    )
    assert update.status_code == 200
    assert update.json()["name"] == "tg 通知 v2"
    masked_configuration = update.json()["configuration"]
    assert json.loads(masked_configuration)["bot_token"] == MASKED_SECRET

    preserve = await client.put(
        f"/api/v1/actions/{action_id}",
        json={
            "name": "tg 通知 v2",
            "actionType": "telegram_bot",
            "configuration": masked_configuration,
            "triggerConditions": '{"score_threshold": 0.8}',
        },
    )
    assert preserve.status_code == 200
    stored = await app.state.db.fetch_value("SELECT configuration FROM actions WHERE id = ?", (action_id,))
    assert str(stored).startswith("enc:v1:")
    assert json.loads(unprotect_text(stored))["bot_token"] == "t2"

    toggle = await client.patch(f"/api/v1/actions/{action_id}/toggle")
    assert toggle.status_code == 200
    assert_keys(toggle.json(), ["id", "isEnabled"], "toggle")
    assert toggle.json()["isEnabled"] is False

    bad_type = await client.post(
        "/api/v1/actions",
        json={"name": "x", "actionType": "carrier_pigeon", "configuration": "{}"},
    )
    assert bad_type.status_code == 422

    delete = await client.delete(f"/api/v1/actions/{action_id}")
    assert delete.status_code == 204


async def test_action_test_endpoint(client):
    """The seeded webhook points at a dead port — must fail gracefully."""
    resp = await client.post(f"/api/v1/actions/{seed.ACTION_1}/test")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is False
    assert body["error"]


async def test_action_trigger_history(client):
    resp = await client.get("/api/v1/actions/trigger-history", params={"limit": "10", "offset": "0"})
    assert resp.status_code == 200
    body = resp.json()
    assert_keys(body, ["items", "totalCount", "hasMore"], "trigger-history envelope")
    assert body["totalCount"] >= 1
    assert len(body["items"]) >= 1
    entry = body["items"][0]
    assert_keys(
        entry,
        [
            "id",
            "actionId",
            "taskId",
            "batchId",
            "triggerReason",
            "status",
            "errorMessage",
            "triggeredAt",
        ],
        "ActionTriggerHistoryEntry",
    )
    assert entry["actionId"] == seed.ACTION_1

    filtered = await client.get(
        "/api/v1/actions/trigger-history",
        params={"action_id": seed.ACTION_1, "limit": "10", "offset": "0"},
    )
    assert all(item["actionId"] == seed.ACTION_1 for item in filtered.json()["items"])
