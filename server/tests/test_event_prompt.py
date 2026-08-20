"""Event-mode JSON schema and preset intent checks."""

from __future__ import annotations

from datetime import UTC

from server.analyzer.prompt import (
    build_analysis_prompt,
    build_json_instruction,
    format_messages,
)
from server.presets.task_presets import BUILTIN_PRESETS


def test_event_json_instruction_covers_optional_time_location_rules():
    instruction = build_json_instruction("intel_event")
    assert "title" in instruction and "body" in instruction
    assert "禁止自造 JSON key" in instruction
    assert "寫進 body" in instruction
    assert "禁止無依據猜測" in instruction or "禁止猜測" in instruction
    assert "盡可能依上下文推斷" in instruction
    assert "國家／州省" in instruction or "國家/州省" in instruction
    assert "易歧義" in instruction
    assert "0,0" in instruction
    assert "時間線" in instruction and "地圖" in instruction
    assert "群組驗證" in instruction


def test_format_messages_includes_timestamp():
    text = format_messages(
        [
            {
                "id": "m1",
                "sender_name": "Alice",
                "timestamp": "2026-07-18T12:00:00Z",
                "content": "明天台北開會",
            }
        ]
    )
    assert "[id=m1]" in text
    assert "[time=2026-07-18T12:00:00Z]" in text
    assert "[Alice]" in text
    assert "明天台北開會" in text


def test_event_prompt_assembly_appends_schema_after_template():
    from datetime import datetime

    prompt = build_analysis_prompt(
        prompt_template="提取關鍵情報。",
        analysis_mode="intel_event",
        primary_messages=[
            {
                "id": "m1",
                "content": "台北明天開會",
                "timestamp": "2026-07-18T08:00:00Z",
            }
        ],
        max_tokens=1000,
        strategy_mode="balanced",
        now=datetime(2026, 7, 21, 2, 30, tzinfo=UTC),
    )
    assert prompt.system_prompt.startswith("提取關鍵情報。")
    assert "當前時間（權威" in prompt.system_prompt
    assert "本輪分析開始時由本機系統時鐘注入一次" in prompt.system_prompt
    assert "2026-07-21T02:30:00Z" in prompt.system_prompt
    assert "Analysis strategy: balanced" in prompt.system_prompt
    assert "盡可能依上下文推斷" in prompt.system_prompt
    assert "禁止自造 JSON key" in prompt.system_prompt
    assert "台北明天開會" in prompt.user_content
    assert "[time=2026-07-18T08:00:00Z]" in prompt.user_content
    assert "Traditional Chinese" in prompt.system_prompt


def test_event_prompt_appends_english_output_locale_directive():
    prompt = build_analysis_prompt(
        prompt_template="提取關鍵情報。",
        analysis_mode="intel_event",
        primary_messages=[{"id": "m1", "content": "hello", "timestamp": "2026-07-18T08:00:00Z"}],
        max_tokens=1000,
        ui_locale="en",
    )
    assert prompt.system_prompt.endswith("Write all user-facing text in English.")
    assert "Traditional Chinese" not in prompt.system_prompt


def test_event_prompt_omits_json_schema_when_intel_off():
    prompt = build_analysis_prompt(
        prompt_template="提取關鍵情報。",
        analysis_mode="intel_event",
        primary_messages=[{"id": "m1", "content": "hello", "timestamp": "2026-07-18T08:00:00Z"}],
        max_tokens=1000,
        output_analysis_events=False,
    )
    assert '{"items":' not in prompt.system_prompt
    assert "禁止自造 JSON key" not in prompt.system_prompt
    assert prompt.system_prompt.startswith("提取關鍵情報。")


def test_event_presets_are_intent_only_not_schema_duplicates():
    event_presets = [p for p in BUILTIN_PRESETS if p["analysisMode"] == "intel_event"]
    assert event_presets
    for preset in event_presets:
        text = preset["promptTemplate"]
        assert "ISO 8601" not in text
        assert "JSON" not in text
        assert "source_message_id" not in text
        assert len(text) > 20


def test_leaderboard_presets_are_intent_only_not_schema_duplicates():
    leaderboard_presets = [p for p in BUILTIN_PRESETS if p["analysisMode"] == "leaderboard"]
    assert leaderboard_presets
    for preset in leaderboard_presets:
        text = preset["promptTemplate"]
        assert "JSON" not in text
        assert "related_message_ids" not in text
        assert "不要輸出 rank" not in text
        assert len(text) > 20


def test_event_presets_expected_ids():
    by_id = {p["id"]: p for p in BUILTIN_PRESETS}
    intel_ids = {p["id"] for p in BUILTIN_PRESETS if p["analysisMode"] == "intel_event"}
    assert intel_ids == {
        "key-insights",
        "schedule-events",
        "schedule-time-inference",
        "crypto-airdrop-deals",
        "iot-device-alerts",
        "security-scam-watch",
        "policy-regulation",
        "finance-markets",
    }
    agent_ids = {p["id"] for p in BUILTIN_PRESETS if p["analysisMode"] == "agent"}
    assert agent_ids == {
        "agent-work-shift",
        "agent-project-schedule",
        "agent-source-verify",
        "agent-pure-web-search",
    }
    leaderboard_ids = {p["id"] for p in BUILTIN_PRESETS if p["analysisMode"] == "leaderboard"}
    assert leaderboard_ids == {
        "leaderboard-hot-topics",
        "leaderboard-discussion-heat",
    }
    assert by_id["schedule-time-inference"]["name"] == "時間行程推理"
    assert by_id["iot-device-alerts"]["name"] == "IoT 設備告警"
    assert by_id["key-insights"]["name"] == "關鍵情報摘要"
    assert by_id["agent-work-shift"]["name"] == "工作輪更"
    assert by_id["agent-project-schedule"]["name"] == "專案日程"
    assert by_id["agent-source-verify"]["name"] == "來源核實"
    assert by_id["leaderboard-hot-topics"]["name"] == "熱門話題排行"
    assert by_id["leaderboard-discussion-heat"]["name"] == "討論熱度"
