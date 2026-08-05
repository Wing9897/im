"""Contract keys: messages & channels routes."""

from __future__ import annotations

from server.http_limits import MAX_REQUEST_BODY_BYTES
from server.tests import seed
from server.tests.contract_helpers import MESSAGE_KEYS, assert_keys


async def test_messages_page(client):
    resp = await client.get("/api/v1/messages/page", params={"limit": "2"})
    assert resp.status_code == 200
    body = resp.json()
    assert_keys(body, ["messages", "nextCursor", "hasMore", "totalCount"], "messages/page")
    assert body["totalCount"] == 3
    assert body["hasMore"] is True
    assert_keys(body["nextCursor"], ["timestamp", "id"], "nextCursor")
    for message in body["messages"]:
        assert_keys(message, MESSAGE_KEYS, "Message")

    # Cursor echo must page through without overlap.
    resp2 = await client.get(
        "/api/v1/messages/page",
        params={
            "limit": "2",
            "cursor_time": body["nextCursor"]["timestamp"],
            "cursor_id": body["nextCursor"]["id"],
        },
    )
    page2 = resp2.json()
    ids1 = {m["id"] for m in body["messages"]}
    ids2 = {m["id"] for m in page2["messages"]}
    assert not ids1 & ids2
    assert page2["hasMore"] is False


async def test_messages_page_can_skip_expensive_total_count(client):
    resp = await client.get(
        "/api/v1/messages/page",
        params={"limit": "2", "include_total": "false"},
    )
    assert resp.status_code == 200
    assert resp.json()["totalCount"] is None
    assert len(resp.json()["messages"]) == 2


async def test_messages_page_filters_by_channel_keys(client):
    telegram_key = f"{seed.TG_CHANNEL[0]}:{seed.TG_CHANNEL[1]}"
    discord_key = f"{seed.DISCORD_CHANNEL[0]}:{seed.DISCORD_CHANNEL[1]}"

    telegram = await client.get(
        "/api/v1/messages/page",
        params={"channel_ids": telegram_key},
    )
    assert telegram.status_code == 200
    assert telegram.json()["totalCount"] == 2
    assert {message["platform"] for message in telegram.json()["messages"]} == {"telegram"}

    both = await client.get(
        "/api/v1/messages/page",
        params={"channel_ids": f"{telegram_key},{discord_key}"},
    )
    assert both.status_code == 200
    assert both.json()["totalCount"] == 3

    invalid = await client.get(
        "/api/v1/messages/page",
        params={"channel_ids": "missing-separator"},
    )
    assert invalid.status_code == 422

    too_many_channels = await client.get(
        "/api/v1/messages/page",
        params={"channel_ids": ",".join(f"telegram:{index}" for index in range(101))},
    )
    assert too_many_channels.status_code == 422

    oversized_search = await client.get(
        "/api/v1/messages/page",
        params={"search": "x" * 501},
    )
    assert oversized_search.status_code == 422


async def test_messages_page_searches_sender_id_and_channel_name(client):
    by_sender_id = await client.get("/api/v1/messages/page", params={"search": "sender-1"})
    assert by_sender_id.status_code == 200
    assert [message["id"] for message in by_sender_id.json()["messages"]] == ["msg-1"]

    by_channel_name = await client.get("/api/v1/messages/page", params={"search": "TG News Channel"})
    assert by_channel_name.status_code == 200
    assert by_channel_name.json()["totalCount"] == 2


async def test_channels_with_sources(client):
    resp = await client.get("/api/v1/channels/with-sources")
    body = resp.json()
    assert len(body) == 5
    for channel in body:
        assert_keys(
            channel,
            ["id", "platform", "channelName", "sourceName"],
            "ChannelWithSource",
        )
        # Quirk #9: id must be the synthetic "platform:platformId" string.
        assert channel["id"].startswith(f"{channel['platform']}:")
    tg = next(c for c in body if c["platform"] == "telegram")
    assert tg["sourceName"]


async def test_channel_id_matches_message_synthesis(client):
    """Monitor filter compares channel.id to `${platform}:${platformId}`."""
    channels = (await client.get("/api/v1/channels/with-sources")).json()
    messages = (await client.get("/api/v1/messages/page")).json()["messages"]
    channel_ids = {c["id"] for c in channels}
    for message in messages:
        assert f"{message['platform']}:{message['platformId']}" in channel_ids


async def test_ingest_message(client):
    resp = await client.post(
        "/api/v1/messages",
        json={
            "sourceId": seed.TG_SOURCE,
            "channelId": seed.TG_CHANNEL[1],
            "platform": "telegram",
            "platformMessageId": "9001",
            "content": "external ingest test",
            "timestamp": "2026-07-01T12:30:00+00:00",
            "metadata": {"group": "news", "tags": ["test"]},
        },
    )
    assert resp.status_code == 201
    assert_keys(resp.json(), MESSAGE_KEYS, "ingested Message")

    # Duplicate must be rejected (unique platform_message_id).
    dup = await client.post(
        "/api/v1/messages",
        json={
            "channelId": seed.TG_CHANNEL[1],
            "platform": "telegram",
            "platformMessageId": "9001",
            "content": "duplicate",
        },
    )
    assert dup.status_code == 409


async def test_ingest_limits_reject_oversized_payloads(client):
    oversized_content = await client.post(
        "/api/v1/messages",
        json={
            "platform": "rss",
            "channelId": "feed",
            "content": "x" * 100_001,
        },
    )
    assert oversized_content.status_code == 422

    oversized_batch = await client.post(
        "/api/v1/messages/batch",
        json={"messages": [{"platform": "rss", "channelId": "feed", "content": str(index)} for index in range(501)]},
    )
    assert oversized_batch.status_code == 422

    oversized_body = await client.post(
        "/api/v1/messages",
        content=b"",
        headers={"content-length": str(MAX_REQUEST_BODY_BYTES + 1)},
    )
    assert oversized_body.status_code == 413


async def test_channels_latest_messages(client):
    key = f"telegram:{seed.TG_CHANNEL[1]}"
    resp = await client.get(
        "/api/v1/channels/latest-messages",
        params={"channels": key, "limit": "5"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert key in body
    assert len(body[key]) == 2
    for message in body[key]:
        assert_keys(message, MESSAGE_KEYS, "Message")


async def test_channels_latest_messages_batches_multiple_channels(client):
    telegram_key = f"telegram:{seed.TG_CHANNEL[1]}"
    discord_key = f"discord:{seed.DISCORD_CHANNEL[1]}"
    resp = await client.get(
        "/api/v1/channels/latest-messages",
        params={"channels": f"{telegram_key},{discord_key}", "limit": "1"},
    )
    assert resp.status_code == 200
    assert list(resp.json()) == [telegram_key, discord_key]
    assert len(resp.json()[telegram_key]) == 1
    assert len(resp.json()[discord_key]) == 1


async def test_message_media_errors(client, app):
    missing = await client.get("/api/v1/messages/does-not-exist/media")
    assert missing.status_code == 404

    no_media = await client.get("/api/v1/messages/msg-1/media")
    assert no_media.status_code == 404

    await app.state.db.execute(
        "UPDATE messages SET raw_data = ? WHERE id = ?",
        ('{"media": {"kind": "photo", "mime": "image/jpeg"}}', "msg-1"),
    )
    needs_collector = await client.get("/api/v1/messages/msg-1/media")
    assert needs_collector.status_code == 503
