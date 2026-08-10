"""Contract keys: results trending routes."""

from __future__ import annotations

from server.api.schemas.responses import TrendingTopicResponse
from server.tests import seed
from server.tests.contract_helpers import MESSAGE_KEYS, assert_keys


async def test_trending(client):
    resp = await client.get("/api/v1/results/trending")
    body = resp.json()
    assert len(body) == 2
    for topic in body:
        assert set(topic) == set(TrendingTopicResponse.model_fields)
        assert_keys(
            topic,
            ["id", "taskId", "taskName", "rank", "topicName", "score", "summary", "createdAt"],
            "TrendingTopic",
        )
        # Quirk #10: .toFixed(1) is called on score without guards.
        assert isinstance(topic["score"], (int, float))
        assert topic["rank"] is not None
        assert 1 <= int(topic["rank"]) <= 10

    filtered = await client.get("/api/v1/results/trending", params={"taskId": seed.TASK_LEADERBOARD})
    filtered_body = filtered.json()
    assert len(filtered_body) == 2
    assert all(1 <= int(t["rank"]) <= 10 for t in filtered_body)


async def test_trending_topic_messages(client):
    resp = await client.get(f"/api/v1/results/trending/{seed.TOPIC_1}/messages")
    body = resp.json()
    assert len(body) == 1
    assert_keys(body[0], MESSAGE_KEYS, "topic Message")
