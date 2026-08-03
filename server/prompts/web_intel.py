"""Prompt assembly for ``analysis_mode=web_intel`` short ticks."""

from __future__ import annotations

from server.prompts.analysis import EVENT_SCHEMA_INSTRUCTION, JSON_OUTPUT_PREAMBLE
from server.prompts.locale import normalize_ui_locale, output_language_directive

_SYSTEM_INTRO: dict[str, str] = {
    "zh-Hant": (
        "你是網路情報分析員。根據使用者提供的搜尋查詢／關鍵詞與任務 Prompt，"
        "從公開網頁搜尋結果中抽取可追蹤的情報事件。\n"
        "不要寒暄；不要編造搜尋結果中不存在的事實。\n"
        "輸出與關鍵事件模式相同的 JSON items（寫入 analysis_events）。\n"
    ),
    "zh-Hans": (
        "你是网络情报分析员。根据使用者提供的搜索查询／关键词与任务 Prompt，"
        "从公开网页搜索结果中抽取可追踪的情报事件。\n"
        "不要寒暄；不要编造搜索结果中不存在的事实。\n"
        "输出与关键事件模式相同的 JSON items（写入 analysis_events）。\n"
    ),
    "en": (
        "You are a web-intel analyst. Using the search query/keywords and task prompt, "
        "extract trackable intelligence events from public web search results.\n"
        "Do not chit-chat; do not invent facts absent from the search evidence.\n"
        "Emit the same JSON items shape as key-event mode (stored in analysis_events).\n"
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


def build_web_intel_system_prompt(*, ui_locale: str | None = None) -> str:
    """System instructions: extract analysis events from web search evidence."""
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
    """One-step native search: LLM should search then emit event JSON."""
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
    """Two-step path: search already done; LLM only structures events."""
    locale = normalize_ui_locale(ui_locale)
    empty = _EMPTY_QUERY[locale]
    results = (search_results_text or "").strip() or _EMPTY_RESULTS[locale]
    return _TOOL_USER[locale].format(
        query=(search_query or "").strip() or empty,
        prompt=(prompt_template or "").strip() or empty,
        results=results,
    )


def format_search_results_for_prompt(items: list[dict]) -> str:
    """Compact bullet list for the two-step LLM pass."""
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
