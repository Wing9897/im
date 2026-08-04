"""Prompt assembly for ``analysis_mode=web_intel`` Agent ticks (and legacy oneshot helpers)."""

from __future__ import annotations

from server.prompts.analysis import EVENT_SCHEMA_INSTRUCTION, JSON_OUTPUT_PREAMBLE
from server.prompts.locale import normalize_ui_locale, output_language_directive

WEB_INTEL_AGENT_SYSTEM_PROMPT = """你是 IntelligenceMonitor 的網路情報 Agent（web_intel tick）。
這是排程驅動的多輪工具循環：你必須用 web.search 主動搜尋公開網頁，必要時可換關鍵字多輪搜尋，
最後輸出與情報事件模式相同的 JSON items（寫入 analysis_events）。
不要寒暄；不要編造搜尋結果中不存在的事實。不要寫入日曆／用戶事件／循環任務。

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

_SYSTEM_INTRO: dict[str, str] = {
    "zh-Hant": (
        "你是網路情報分析員。根據使用者提供的搜尋查詢／關鍵詞與任務 Prompt，"
        "從公開網頁搜尋結果中抽取可追蹤的情報事件。\n"
        "不要寒暄；不要編造搜尋結果中不存在的事實。\n"
        "輸出與情報事件模式相同的 JSON items（寫入 analysis_events）。\n"
    ),
    "zh-Hans": (
        "你是网络情报分析员。根据使用者提供的搜索查询／关键词与任务 Prompt，"
        "从公开网页搜索结果中抽取可追踪的情报事件。\n"
        "不要寒暄；不要编造搜索结果中不存在的事实。\n"
        "输出与情报事件模式相同的 JSON items（写入 analysis_events）。\n"
    ),
    "en": (
        "You are a web-intel analyst. Using the search query/keywords and task prompt, "
        "extract trackable intelligence events from public web search results.\n"
        "Do not chit-chat; do not invent facts absent from the search evidence.\n"
        "Emit the same JSON items shape as intel-event mode (stored in analysis_events).\n"
    ),
}

_NATIVE_USER: dict[str, str] = {
    "zh-Hant": (
        "請先依下方查詢進行網路搜尋，再依任務 Prompt 把結果抽成事件 JSON。\n\n"
        "【搜尋查詢／關鍵詞】\n{query}\n\n"
        "【任務 Prompt（如何把搜尋結果抽成事件）】\n{prompt}\n\n"
        '請只輸出一個 JSON 物件：{{"items": [...]}}。'
    ),
    "zh-Hans": (
        "请先依下方查询进行网络搜索，再依任务 Prompt 把结果抽成事件 JSON。\n\n"
        "【搜索查询／关键词】\n{query}\n\n"
        "【任务 Prompt（如何把搜索结果抽成事件）】\n{prompt}\n\n"
        '请只输出一个 JSON 对象：{{"items": [...]}}。'
    ),
    "en": (
        "Search the web with the query below, then extract event JSON per the task prompt.\n\n"
        "[Search query / keywords]\n{query}\n\n"
        "[Task prompt (how to turn hits into events)]\n{prompt}\n\n"
        'Output only one JSON object: {{"items": [...]}}.'
    ),
}

_TOOL_USER: dict[str, str] = {
    "zh-Hant": (
        "以下是已完成的網頁搜尋結果。請依任務 Prompt 抽取事件 JSON；"
        "不要再要求搜尋；證據不足時回傳空 items。\n\n"
        "【搜尋查詢／關鍵詞】\n{query}\n\n"
        "【任務 Prompt（如何把搜尋結果抽成事件）】\n{prompt}\n\n"
        "【搜尋結果】\n{results}\n\n"
        '請只輸出一個 JSON 物件：{{"items": [...]}}。'
    ),
    "zh-Hans": (
        "以下是已完成的网页搜索结果。请依任务 Prompt 抽取事件 JSON；"
        "不要再要求搜索；证据不足时返回空 items。\n\n"
        "【搜索查询／关键词】\n{query}\n\n"
        "【任务 Prompt（如何把搜索结果抽成事件）】\n{prompt}\n\n"
        "【搜索结果】\n{results}\n\n"
        '请只输出一个 JSON 对象：{{"items": [...]}}。'
    ),
    "en": (
        "Web search results are below. Extract event JSON per the task prompt; "
        "do not request another search; return empty items when evidence is thin.\n\n"
        "[Search query / keywords]\n{query}\n\n"
        "[Task prompt (how to turn hits into events)]\n{prompt}\n\n"
        "[Search results]\n{results}\n\n"
        'Output only one JSON object: {{"items": [...]}}.'
    ),
}

_EMPTY_QUERY: dict[str, str] = {
    "zh-Hant": "(未提供)",
    "zh-Hans": "(未提供)",
    "en": "(not provided)",
}

_EMPTY_RESULTS: dict[str, str] = {
    "zh-Hant": "(無搜尋結果)",
    "zh-Hans": "(无搜索结果)",
    "en": "(no search results)",
}


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
        "(multi-round OK) then finish with {\"items\":[...]} JSON.",
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


def build_web_intel_system_prompt(*, ui_locale: str | None = None) -> str:
    """Legacy oneshot system instructions (kept for ``extract_web_intel_items``)."""
    locale = normalize_ui_locale(ui_locale)
    return (
        f"{_SYSTEM_INTRO[locale]}{EVENT_SCHEMA_INSTRUCTION}{JSON_OUTPUT_PREAMBLE}\n{output_language_directive(locale)}"
    )


def build_web_intel_native_user_prompt(
    *,
    search_query: str,
    prompt_template: str,
    ui_locale: str | None = None,
) -> str:
    """Legacy one-step native search prompt."""
    locale = normalize_ui_locale(ui_locale)
    empty = _EMPTY_QUERY[locale]
    return _NATIVE_USER[locale].format(
        query=(search_query or "").strip() or empty,
        prompt=(prompt_template or "").strip() or empty,
    )


def build_web_intel_tool_user_prompt(
    *,
    search_query: str,
    prompt_template: str,
    search_results_text: str,
    ui_locale: str | None = None,
) -> str:
    """Legacy two-step tool path prompt."""
    locale = normalize_ui_locale(ui_locale)
    empty = _EMPTY_QUERY[locale]
    results = (search_results_text or "").strip() or _EMPTY_RESULTS[locale]
    return _TOOL_USER[locale].format(
        query=(search_query or "").strip() or empty,
        prompt=(prompt_template or "").strip() or empty,
        results=results,
    )


def format_search_results_for_prompt(items: list[dict]) -> str:
    """Compact bullet list for the legacy two-step LLM pass."""
    lines: list[str] = []
    for index, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        url = str(item.get("url") or item.get("href") or "").strip()
        snippet = str(item.get("snippet") or item.get("description") or "").strip()
        head = title or url or f"result-{index}"
        line = f"{index}. {head}"
        if url and url != head:
            line += f"\n   URL: {url}"
        if snippet:
            line += f"\n   {snippet}"
        lines.append(line)
    return "\n".join(lines)
