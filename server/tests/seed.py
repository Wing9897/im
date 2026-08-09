"""Deterministic seed data covering every entity the contract tests read."""

from __future__ import annotations

import json
from typing import Any

from server.collector.email_config import build_email_credentials, email_channel_platform_id
from server.secrets import protect_text

NOW = "2026-07-01T12:00:00+00:00"
EARLIER = "2026-07-01T11:00:00+00:00"

TG_SOURCE = "acc-tg"
DISCORD_SOURCE = "acc-dc"
RSS_SOURCE = "acc-rss"
MQTT_SOURCE = "acc-mqtt"
EMAIL_SOURCE = "acc-email"
EMAIL_USERNAME = "user@example.com"

TG_CHANNEL = ("telegram", "10001")
DISCORD_CHANNEL = ("discord", "20002")
RSS_CHANNEL = ("rss", "https://example.com/feed.xml")
MQTT_CHANNEL = ("mqtt", "mqtt://broker.example:1883")
EMAIL_CHANNEL = (
    "email",
    email_channel_platform_id("imap.example.com", 993, EMAIL_USERNAME, "INBOX"),
)

TASK_LEADERBOARD = "task-lb"
TASK_EVENT = "task-cm"
TASK_EVENT_TIMED = "task-tl"
TASK_CALENDAR = "task-cal"
TASK_WEB_INTEL = "task-wi"
TASK_PROJECT = "task-proj"

BATCH_LEADERBOARD = "batch-lb"
BATCH_EVENT = "batch-cm"
BATCH_EVENT_TIMED = "batch-tl"
BATCH_WEB_INTEL = "batch-wi"
BATCH_WEB_INTEL_SKIPPED = "batch-wi-skip"

ITEM_PASSPORT = "item-passport"
ITEM_FOOD = "item-food"

TOPIC_1 = "topic-1"
MESSAGE_1 = "msg-1"

ACTION_1 = "act-1"


async def seed_database(db: Any) -> None:
    now = NOW

    # ── sources ──────────────────────────────────────────────────────
    email_creds = build_email_credentials(
        imap_host="imap.example.com",
        imap_port=993,
        use_ssl=True,
        username=EMAIL_USERNAME,
        password="seed-app-password",
        folders=["INBOX"],
        poll_interval_seconds=300,
        initial_sync_days=7,
        initial_sync_max_messages=100,
        sender_allowlist=[],
        mark_as_read=False,
        folder_cursors={"INBOX": 5},
    )
    sources = [
        (
            TG_SOURCE,
            "telegram",
            "+886912345678",
            "connected",
            json.dumps({"api_id": 12345, "api_hash": "hash", "phone": "+886912345678"}),
        ),
        (DISCORD_SOURCE, "discord", "My Discord Bot", "connected", json.dumps({"bot_token": "token"})),
        (
            RSS_SOURCE,
            "rss",
            "Example Feed",
            "connected",
            json.dumps({"feed_url": RSS_CHANNEL[1], "poll_interval_seconds": 300}),
        ),
        (
            MQTT_SOURCE,
            "mqtt",
            MQTT_CHANNEL[1],
            "connected",
            json.dumps({"broker_url": MQTT_CHANNEL[1], "topics": ["news/#", "alerts/hk"]}),
        ),
        (
            EMAIL_SOURCE,
            "email",
            EMAIL_USERNAME,
            "connected",
            protect_text(json.dumps(email_creds, ensure_ascii=False)),
        ),
    ]
    for source_id, platform, name, status, credentials in sources:
        await db.execute(
            "INSERT INTO sources (id, platform, name, status, credentials, "
            "last_connected_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (source_id, platform, name, status, credentials, now, now, now),
        )

    # ── channels + account links ──────────────────────────────────────
    channels = [
        (*TG_CHANNEL, "TG News Channel"),
        (*DISCORD_CHANNEL, "general"),
        (*RSS_CHANNEL, "Example Feed"),
        (*MQTT_CHANNEL, MQTT_CHANNEL[1]),
        (*EMAIL_CHANNEL, "INBOX"),
    ]
    for platform, platform_id, channel_name in channels:
        await db.execute(
            "INSERT INTO channels (platform, platform_id, channel_name, created_at) VALUES (?, ?, ?, ?)",
            (platform, platform_id, channel_name, now),
        )
    links = [
        (TG_SOURCE, *TG_CHANNEL),
        (DISCORD_SOURCE, *DISCORD_CHANNEL),
        (RSS_SOURCE, *RSS_CHANNEL),
        (MQTT_SOURCE, *MQTT_CHANNEL),
        (EMAIL_SOURCE, *EMAIL_CHANNEL),
    ]
    for source_id, platform, platform_id in links:
        await db.execute(
            "INSERT INTO source_channels (source_id, platform, platform_id) VALUES (?, ?, ?)",
            (source_id, platform, platform_id),
        )

    # ── messages ──────────────────────────────────────────────────────
    messages = [
        (
            MESSAGE_1,
            TG_SOURCE,
            *TG_CHANNEL,
            "1001",
            "sender-1",
            "Alice",
            "地震速報:規模5.1",
            "2026-07-01T10:00:00+00:00",
        ),
        ("msg-2", TG_SOURCE, *TG_CHANNEL, "1002", "sender-2", "Bob", "演唱會門票開賣", "2026-07-01T10:05:00+00:00"),
        (
            "msg-3",
            DISCORD_SOURCE,
            *DISCORD_CHANNEL,
            "2001",
            "sender-3",
            "Carol",
            "server maintenance tonight",
            "2026-07-01T10:10:00+00:00",
        ),
    ]
    for message_id, source_id, platform, platform_id, pmid, sender_id, sender_name, content, timestamp in messages:
        await db.execute(
            "INSERT INTO messages (id, source_id, platform, platform_id, "
            "platform_message_id, sender_id, sender_name, content, timestamp, "
            "raw_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)",
            (message_id, source_id, platform, platform_id, pmid, sender_id, sender_name, content, timestamp, now),
        )

    # ── analysis tasks (leaderboard / event / calendar / agent presets) ─
    from server.domain.agent_task_spec import agent_preset_spec, agent_spec_to_db_kwargs

    _web_scout = agent_spec_to_db_kwargs(agent_preset_spec("web_scout"))
    _project_reconcile = agent_spec_to_db_kwargs(
        agent_preset_spec("project_reconcile", has_channels=True)
    )
    # (id, name, mode, time_range, schedule_rrule, rrule, start, end, all_day,
    #  location, description, agent_policy_or_None)
    tasks = [
        (
            TASK_LEADERBOARD,
            "熱門話題排行",
            "leaderboard",
            "1d",
            "FREQ=SECONDLY;INTERVAL=10",
            None,
            None,
            None,
            0,
            None,
            None,
            None,
        ),
        (TASK_EVENT, "關鍵情報", "intel_event", "1d", "FREQ=HOURLY", None, None, None, 0, None, None, None),
        (
            TASK_EVENT_TIMED,
            "行程提取",
            "intel_event",
            "7d",
            "FREQ=DAILY;BYHOUR=9;BYMINUTE=0",
            None,
            None,
            None,
            0,
            None,
            None,
            None,
        ),
        (
            TASK_CALENDAR,
            "每週例會",
            "recurring",
            "all",
            None,
            "FREQ=WEEKLY;BYDAY=MO",
            "2026-07-06T10:00:00+00:00",
            "2026-07-06T11:00:00+00:00",
            0,
            "會議室A",
            "週會",
            None,
        ),
        (
            TASK_WEB_INTEL,
            "定價監管情報",
            "agent",
            "all",
            "FREQ=HOURLY",
            None,
            None,
            None,
            0,
            None,
            None,
            _web_scout,
        ),
        (
            TASK_PROJECT,
            "專案殼",
            "agent",
            "7d",
            "FREQ=HOURLY",
            None,
            None,
            None,
            0,
            None,
            None,
            _project_reconcile,
        ),
    ]
    for (
        task_id,
        name,
        mode,
        time_range,
        schedule_rrule,
        rrule,
        event_start,
        event_end,
        all_day,
        location,
        description,
        agent_policy,
    ) in tasks:
        prompt = (
            "從搜尋結果抽出官方定價變更"
            if task_id == TASK_WEB_INTEL
            else ("對帳專案日程" if task_id == TASK_PROJECT else "分析以下訊息")
        )
        policy = agent_policy or {
            "trigger_mode": "schedule",
            "cap_calendar_read": 1,
            "cap_calendar_writes": 0,
            "cap_web_search": 0,
            "cap_force_web_search": 0,
            "cap_read_analysis_events": 1,
            "cap_read_items": 1,
            "output_calendar": 0,
            "output_analysis_events": 0,
        }
        await db.execute(
            "INSERT INTO analysis_tasks (id, name, description, prompt_template, "
            "analysis_mode, analysis_time_range, version, is_active, "
            "schedule_rrule, trigger_mode, cap_calendar_read, cap_calendar_writes, "
            "cap_web_search, cap_force_web_search, cap_read_analysis_events, cap_read_items, "
            "output_calendar, output_analysis_events, "
            "created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                task_id,
                name,
                f"{name} description",
                prompt,
                mode,
                time_range,
                schedule_rrule,
                policy["trigger_mode"],
                policy["cap_calendar_read"],
                policy["cap_calendar_writes"],
                policy["cap_web_search"],
                policy["cap_force_web_search"],
                policy.get("cap_read_analysis_events", 1),
                policy.get("cap_read_items", 1),
                policy["output_calendar"],
                policy["output_analysis_events"],
                now,
                now,
            ),
        )
        if rrule:
            await db.execute(
                "INSERT INTO recurring_schedules "
                "(task_id, rrule, dtstart, dtend, is_all_day, location, description, "
                "timezone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'UTC', ?, ?)",
                (task_id, rrule, event_start, event_end, all_day, location, description, now, now),
            )
    for task_id in (TASK_LEADERBOARD, TASK_EVENT, TASK_EVENT_TIMED, TASK_PROJECT):
        await db.execute(
            "INSERT INTO task_channels (task_id, platform, platform_id) VALUES (?, ?, ?)",
            (task_id, *TG_CHANNEL),
        )

    # ── batches ───────────────────────────────────────────────────────
    batches = [
        (BATCH_LEADERBOARD, TASK_LEADERBOARD, "completed", 2, None, None),
        (BATCH_EVENT, TASK_EVENT, "completed", 2, None, None),
        (BATCH_EVENT_TIMED, TASK_EVENT_TIMED, "completed", 1, None, None),
        (BATCH_WEB_INTEL, TASK_WEB_INTEL, "completed", 0, None, None),
        (
            BATCH_WEB_INTEL_SKIPPED,
            TASK_WEB_INTEL,
            "completed",
            0,
            None,
            "skipped: empty prompt_template",
        ),
    ]
    for batch_id, task_id, status, count, error, agent_message in batches:
        await db.execute(
            "INSERT INTO analysis_batches (id, task_id, version, status, "
            "message_count, retry_count, error_message, agent_message, created_at, "
            "updated_at, completed_at) VALUES (?, ?, 1, ?, ?, 0, ?, ?, ?, ?, ?)",
            (
                batch_id,
                task_id,
                status,
                count,
                error,
                agent_message,
                EARLIER,
                now,
                now if status == "completed" else None,
            ),
        )

    # ── markers ───────────────────────────────────────────────────────
    await db.execute(
        "INSERT INTO analysis_markers (id, message_id, task_id, version, batch_id, "
        "analyzed_at) VALUES ('marker-1', ?, ?, 1, ?, ?)",
        (MESSAGE_1, TASK_LEADERBOARD, BATCH_LEADERBOARD, now),
    )

    # ── results: trending / analysis_events ───────────────────────────
    topics = [
        (TOPIC_1, 1, "地震討論", 0.92, "regional earthquake chatter"),
        ("topic-2", 2, "演唱會", 0.71, None),
    ]
    for topic_id, rank, topic_name, score, summary in topics:
        await db.execute(
            "INSERT INTO trending_topics (id, task_id, version, batch_id, rank, "
            "topic_name, score, summary, created_at, updated_at) "
            "VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)",
            (topic_id, TASK_LEADERBOARD, BATCH_LEADERBOARD, rank, topic_name, score, summary, now, now),
        )
    await db.execute(
        "INSERT INTO topic_messages (topic_id, message_id) VALUES (?, ?)",
        (TOPIC_1, MESSAGE_1),
    )

    await db.execute(
        "INSERT INTO analysis_events (id, task_id, version, batch_id, title, body, "
        "start_time, end_time, location, latitude, longitude, participants_json, "
        "source_message_id, batch_source_channel_names, content_hash, semantic_hash, "
        "event_key, created_at, updated_at) "
        "VALUES ('ben-1', ?, 1, ?, '免費演唱會', '7/10 中環海濱免費入場', "
        "NULL, NULL, '中環海濱', 22.28, 114.16, '[]', ?, ?, 'hash-1', 'sem-1', "
        "NULL, ?, ?)",
        (TASK_EVENT, BATCH_EVENT, MESSAGE_1, json.dumps(["TG News Channel"]), now, now),
    )

    await db.execute(
        "INSERT INTO analysis_events (id, task_id, version, batch_id, title, body, "
        "start_time, end_time, location, latitude, longitude, participants_json, "
        "source_message_id, batch_source_channel_names, content_hash, semantic_hash, "
        "event_key, created_at, updated_at) "
        "VALUES ('ev-1', ?, 1, ?, '季度會議', 'Q3 檢討', "
        "'2026-07-15T09:00:00+00:00', '2026-07-15T10:00:00+00:00', '台北', NULL, NULL, "
        "?, ?, NULL, 'ev-key-1', '', 'ev-key-1', ?, ?)",
        (TASK_EVENT_TIMED, BATCH_EVENT_TIMED, json.dumps(["Alice", "Bob"]), MESSAGE_1, now, now),
    )

    await db.execute(
        "INSERT INTO analysis_events (id, task_id, version, batch_id, title, body, "
        "start_time, end_time, location, latitude, longitude, participants_json, "
        "source_message_id, batch_source_channel_names, content_hash, semantic_hash, "
        "event_key, created_at, updated_at) "
        "VALUES ('wi-1', ?, 1, ?, 'API 定價更新', '官方調降輸入 token 價格', "
        "NULL, NULL, '', NULL, NULL, '[]', NULL, ?, 'wi-hash-1', 'wi-sem-1', "
        "NULL, ?, ?)",
        (TASK_WEB_INTEL, BATCH_WEB_INTEL, json.dumps(["Web"]), now, now),
    )

    # ── sample items (DDL seed categories + __user__ workset) ─────────
    await db.execute(
        "INSERT INTO items (id, title, category_id, workset_id, "
        "expires_at, remind_before_days, notes, status, emoji, attributes_json, "
        "created_at, updated_at) VALUES (?, ?, 'seed_passport_docs', '__user__', "
        "'2029-06-01', 90, 'seed passport', 'active', NULL, ?, ?, ?)",
        (ITEM_PASSPORT, "護照樣本", json.dumps({"id_number": "A123456789"}, ensure_ascii=False), now, now),
    )
    await db.execute(
        "INSERT INTO items (id, title, category_id, workset_id, "
        "expires_at, remind_before_days, notes, status, emoji, attributes_json, "
        "created_at, updated_at) VALUES (?, ?, 'seed_food', '__user__', "
        "'2027-03-15', 3, 'seed food', 'active', NULL, ?, ?, ?)",
        (ITEM_FOOD, "牛奶樣本", json.dumps({"brand": "SeedDairy"}, ensure_ascii=False), now, now),
    )

    # ── actions + history ─────────────────────────────────────────────
    await db.execute(
        "INSERT INTO actions (id, name, action_type, configuration, "
        "trigger_conditions, is_enabled, last_triggered_at, created_at, updated_at) "
        "VALUES (?, '推播到 webhook', 'http_webhook', ?, ?, 1, ?, ?, ?)",
        (
            ACTION_1,
            json.dumps({"url": "http://127.0.0.1:9/hook"}),
            json.dumps({"score_threshold": 0.5, "task_id": TASK_LEADERBOARD}),
            now,
            now,
            now,
        ),
    )
    await db.execute(
        "INSERT INTO action_trigger_history (id, action_id, task_id, batch_id, "
        "trigger_reason, status, error_message, triggered_at) "
        "VALUES ('hist-1', ?, ?, ?, 'auto', 'success', NULL, ?)",
        (ACTION_1, TASK_LEADERBOARD, BATCH_LEADERBOARD, now),
    )

    # ── app logs ──────────────────────────────────────────────────────
    for i in (1, 2, 3):
        await db.execute(
            "INSERT INTO app_logs (id, time, level, category, kind, message, details) "
            "VALUES (?, ?, 'info', 'system', 'system', ?, NULL)",
            (f"log-{i}", f"2026-07-01T1{i}:00:00+00:00", f"log entry {i}"),
        )
