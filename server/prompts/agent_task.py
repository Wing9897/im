"""Composable system prompts for ``analysis_mode=agent`` ticks."""

from __future__ import annotations

from server.domain.agent_task_spec import AgentTaskSpec
from server.prompts.analysis import EVENT_SCHEMA_INSTRUCTION, JSON_OUTPUT_PREAMBLE

AGENT_TASK_SYSTEM_PROMPT_BASE = """你是 IntelligenceMonitor 的可配置 Agent 任務執行者。
這是排程驅動的多輪工具循環：依任務置頂目標與本回合工具權限完成工作。
不要寒暄；以完成任務目標為優先。

你必須只輸出一個 JSON 物件，二選一：
1) 呼叫工具：
{"tool_calls":[{"name":"<tool_name>","arguments":{...}}]}
2) 最終回答（格式見下方輸出條款）

可用 tools：
"""


def _calendar_clause(spec: AgentTaskSpec) -> str:
    if not spec.output_calendar and not spec.cap_calendar_writes:
        if spec.cap_calendar_read:
            return (
                "## 日曆\n"
                "- 禁止 calendar.create_event／update_event／delete_event 與 recurring 寫入工具。\n"
                "- 可讀取 calendar 輔助核實（若工具可用）。\n"
            )
        return "## 日曆\n- 本任務未授權日曆讀寫工具。\n"
    read_note = (
        "- 讀取工具可用；寫入鎖定在本任務範圍（有 agent_scope 時）。\n"
        if spec.cap_calendar_read
        else "- 本任務未授權日曆讀取工具；僅可寫入。\n"
    )
    return (
        "## 日曆寫入\n"
        "- 可用 calendar.create_event／update_event／delete_event 與子週期任務工具。\n"
        f"{read_note}"
        "- 流程：先了解現況 → 對照來源與目標 → 新增／調整／停用 → 簡短總結。\n"
    )


def _search_clause(spec: AgentTaskSpec) -> str:
    if spec.cap_web_search or spec.cap_force_web_search:
        return (
            "## 網搜\n"
            "- web.search 已強制啟用；請至少搜尋一次（可多輪、可調整關鍵字）。\n"
            "- 不要編造搜尋結果中不存在的事實。\n"
        )
    return "## 網搜\n- 本任務未授權 web.search。\n"


def _output_clause(spec: AgentTaskSpec) -> str:
    if spec.output_calendar and spec.output_analysis_events:
        return (
            "## 輸出（雙寫面）\n"
            "- 可用工具寫入日曆／子週期任務。\n"
            "- 最終回答若產出情報事件，使用 "
            '{"items":[...]}'
            "（不要包在 message 字串裡）；若本回合僅改日曆，可用 "
            '{"message":"..."}\n'
            "- 證據不足時 items 可為空陣列。\n"
        )
    if spec.output_analysis_events:
        return (
            "## 輸出（情報事件）\n"
            "- 最終產物是 analysis_events JSON：\n"
            '{"items":[...]}\n'
            "- 不要包在 message 字串裡。證據不足時回傳空 items。\n"
        )
    return (
        "## 輸出（日曆）\n"
        "- 不要寫入 analysis_events／排行榜。\n"
        "- 最終用簡短 "
        '{"message":"..."}\n'
        " 總結改動（無改動也要說明）。\n"
    )


def build_agent_base_prompt(task_prompt: str | None, spec: AgentTaskSpec) -> str:
    """System base for agent ticks: channel prompt + policy clauses + pinned goals."""
    goals = (task_prompt or "").strip() or "(no agent prompt set)"
    parts = [
        AGENT_TASK_SYSTEM_PROMPT_BASE.rstrip(),
        "",
        _calendar_clause(spec).rstrip(),
        "",
        _search_clause(spec).rstrip(),
        "",
        _output_clause(spec).rstrip(),
        "",
        "## Task goals / rules (pinned — always follow)",
        goals,
    ]
    if spec.output_analysis_events:
        parts.extend(["", EVENT_SCHEMA_INSTRUCTION, JSON_OUTPUT_PREAMBLE])
    return "\n".join(parts) + "\n"


def build_agent_seed_message(
    *,
    task_name: str,
    task_id: str,
    spec: AgentTaskSpec,
    source_messages_text: str | None = None,
    calendar_summary: str | None = None,
    message_lines: list[str] | None = None,
    cursor_label: str | None = None,
    wave_index: int | None = None,
    wave_total_hint: str | None = None,
) -> str:
    """User-turn seed for one agent fire / drain wave."""
    name = (task_name or task_id or "agent").strip()
    parts = [
        f"Agent tick for «{name}» (task_id={task_id}).",
        "Follow the pinned Task goals / rules in the system prompt.",
    ]
    if wave_index is not None:
        parts.append(
            f"Drain wave {wave_index}"
            + (f" ({wave_total_hint})" if wave_total_hint else "")
            + "."
        )
    if calendar_summary is not None and spec.cap_calendar_read:
        parts.extend(["", "## Current calendar summary", calendar_summary])
    if message_lines is not None:
        parts.extend(["", "## Incremental source messages"])
        if message_lines:
            parts.append(f"New messages since cursor {cursor_label or '(start)'}:")
            parts.extend(message_lines)
            parts.append(
                "Process these messages now before finishing. "
                "Stay consistent with earlier waves in this same conversation."
            )
        else:
            parts.append(
                f"No new messages since cursor {cursor_label or '(start)'}. "
                "Do not invent work; finish with a short message."
            )
    else:
        injected = (source_messages_text or "").strip()
        parts.extend(["", "## Source channel messages"])
        if injected:
            parts.extend(
                [
                    "(clues to verify / enrich — do not invent)",
                    injected,
                ]
            )
        else:
            parts.append("(none — pure scheduled fire; work from the task prompt only)")
    if spec.cap_force_web_search or spec.cap_web_search:
        parts.append(
            'Choose search keywords from the task prompt when needed; use web.search '
            "(multi-round OK)."
        )
    if spec.output_analysis_events and not spec.output_calendar:
        parts.append('Finish with {"items":[...]} JSON.')
    elif spec.output_calendar and not spec.output_analysis_events:
        parts.append('Finish with a short {"message":"..."} summary.')
    else:
        parts.append(
            'Finish with {"items":[...]} when producing intel events, '
            'or {"message":"..."} when only calendar changed.'
        )
    return "\n".join(parts)
