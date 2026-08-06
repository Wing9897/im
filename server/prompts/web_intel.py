"""Prompt assembly for ``analysis_mode=web_intel`` Agent ticks."""

from __future__ import annotations

from server.prompts.analysis import EVENT_SCHEMA_INSTRUCTION, JSON_OUTPUT_PREAMBLE

WEB_INTEL_AGENT_SYSTEM_PROMPT = """你是 IntelligenceMonitor 的網路情報蒐集員（web_intel tick）。
這是排程驅動的多輪工具循環：你必須用 web.search 主動搜尋公開網頁，必要時可換關鍵字多輪搜尋，
最後輸出與情報事件模式相同的 JSON items（寫入 analysis_events）。
不要寒暄；不要編造搜尋結果中不存在的事實。不要寫入日曆／用戶事件／週期任務。

工具限制：
- web.search 已強制啟用；請至少搜尋一次（可多輪、可調整關鍵字）。
- 禁止 calendar.create_event／update_event／delete_event 與 recurring 寫入工具。
- 可讀取 calendar／messages／intelligence 輔助核實，但最終產物是 analysis_events JSON。

流程建議：
1) 依任務 Prompt 自行決定關鍵字，呼叫 web.search（可多輪調整）；
2) 若注入了來源頻道內容，以來源為線索核實／補充，勿虛構；
3) 證據不足時回傳空 items；證據足夠時輸出事件 JSON。

你必須只輸出一個 JSON 物件，二選一：
1) 呼叫工具：
{"tool_calls":[{"name":"<tool_name>","arguments":{...}}]}
2) 最終回答（事件 JSON，不要包在 message 字串裡）：
{"items":[...]}

可用 tools：
"""


def build_web_intel_base_prompt(task_prompt: str | None) -> str:
    """System base for web_intel Agent ticks: channel prompt + pinned task rules."""
    goals = (task_prompt or "").strip() or "(no web_intel prompt set)"
    return (
        WEB_INTEL_AGENT_SYSTEM_PROMPT.rstrip()
        + "\n\n## Task prompt / extraction rules (pinned — always follow)\n"
        + goals
        + "\n\n"
        + EVENT_SCHEMA_INSTRUCTION
        + JSON_OUTPUT_PREAMBLE
    )


def build_web_intel_seed_message(
    *,
    task_name: str,
    task_id: str,
    source_messages_text: str | None = None,
) -> str:
    """User-turn seed for one web_intel Agent fire."""
    name = (task_name or task_id or "web_intel").strip()
    parts = [
        f"Web intel tick for «{name}» (task_id={task_id}).",
        "Follow the pinned Task prompt / extraction rules in the system prompt.",
        "Choose search keywords yourself from the task prompt; use web.search "
        '(multi-round OK) then finish with {"items":[...]} JSON.',
    ]
    injected = (source_messages_text or "").strip()
    if injected:
        parts.extend(
            [
                "",
                "## Source channel messages (clues to verify / enrich — do not invent)",
                injected,
                "Treat these as optional grounding facts; confirm or supplement via web.search.",
            ]
        )
    else:
        parts.extend(
            [
                "",
                "## Source channel messages",
                "(none — pure scheduled fire; search from the task prompt only)",
            ]
        )
    return "\n".join(parts)
