"""Unit tests for Agent history compaction."""

from __future__ import annotations

from server.agent.context_compact import compact_agent_history

NOTICE = "（系統：較早的對話內容已省略）"


def test_keeps_short_history_unchanged() -> None:
    messages = [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello"},
    ]
    assert compact_agent_history(messages, max_messages=10, max_chars=10_000, omit_notice=NOTICE) == messages


def test_drops_oldest_by_message_cap_and_inserts_notice() -> None:
    messages = [{"role": "system", "content": "sys"}]
    for i in range(6):
        messages.append({"role": "user", "content": f"u{i}"})
        messages.append({"role": "assistant", "content": f"a{i}"})

    out = compact_agent_history(messages, max_messages=4, max_chars=50_000, omit_notice=NOTICE)
    assert out[0]["role"] == "system"
    assert out[1] == {"role": "user", "content": NOTICE}
    # Notice counts toward max_messages, so 3 newest dialogue msgs remain.
    assert [m["content"] for m in out[2:]] == ["a4", "u5", "a5"]


def test_drops_oldest_by_char_cap() -> None:
    messages = [
        {"role": "system", "content": "S" * 100},
        {"role": "user", "content": "old-" + ("x" * 200)},
        {"role": "assistant", "content": "mid-" + ("y" * 200)},
        {"role": "user", "content": "new"},
    ]
    out = compact_agent_history(messages, max_messages=20, max_chars=250, omit_notice=NOTICE)
    assert out[0]["role"] == "system"
    assert any(m.get("content") == NOTICE for m in out)
    assert out[-1]["content"] == "new"
    assert not any(m.get("content", "").startswith("old-") for m in out)


def test_truncates_oversized_newest_message() -> None:
    messages = [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "Z" * 5000},
    ]
    out = compact_agent_history(messages, max_messages=10, max_chars=800, omit_notice=NOTICE)
    assert out[-1]["role"] == "user"
    assert out[-1]["content"].endswith("…")
    assert len(out[-1]["content"]) <= 800
