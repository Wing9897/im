"""Prompt assembly for ``analysis_mode=web_intel`` short ticks."""

from __future__ import annotations

from server.prompts.analysis import EVENT_SCHEMA_INSTRUCTION, JSON_OUTPUT_PREAMBLE
from server.prompts.locale import normalize_ui_locale, output_language_directive


def build_web_intel_system_prompt(*, ui_locale: str | None = None) -> str:
    """System instructions: extract analysis events from web search evidence."""
    locale = normalize_ui_locale(ui_locale)
    return (
        "你是網路情報分析員。根據使用者提供的搜尋查詢／關鍵詞與任務 Prompt，"
        "從公開網頁搜尋結果中抽取可追蹤的情報事件。\n"
        "不要寒暄；不要編造搜尋結果中不存在的事實。\n"
        "輸出與關鍵事件模式相同的 JSON items（寫入 analysis_events）。\n"
        f"{EVENT_SCHEMA_INSTRUCTION}"
        f"{JSON_OUTPUT_PREAMBLE}\n"
        f"{output_language_directive(locale)}"
    )


def build_web_intel_native_user_prompt(
    *,
    search_query: str,
    prompt_template: str,
) -> str:
    """One-step native search: LLM should search then emit event JSON."""
    query = (search_query or "").strip()
    prompt = (prompt_template or "").strip()
    return (
        "請先依下方查詢進行網路搜尋，再依任務 Prompt 把結果抽成事件 JSON。\n\n"
        f"【搜尋查詢／關鍵詞】\n{query or '(未提供)'}\n\n"
        f"【任務 Prompt（如何把搜尋結果抽成事件）】\n{prompt or '(未提供)'}\n\n"
        "請只輸出一個 JSON 物件：{\"items\": [...]}。"
    )


def build_web_intel_tool_user_prompt(
    *,
    search_query: str,
    prompt_template: str,
    search_results_text: str,
) -> str:
    """Two-step path: search already done; LLM only structures events."""
    query = (search_query or "").strip()
    prompt = (prompt_template or "").strip()
    results = (search_results_text or "").strip() or "(無搜尋結果)"
    return (
        "以下是已完成的網頁搜尋結果。請依任務 Prompt 抽取事件 JSON；"
        "不要再要求搜尋；證據不足時回傳空 items。\n\n"
        f"【搜尋查詢／關鍵詞】\n{query or '(未提供)'}\n\n"
        f"【任務 Prompt（如何把搜尋結果抽成事件）】\n{prompt or '(未提供)'}\n\n"
        f"【搜尋結果】\n{results}\n\n"
        "請只輸出一個 JSON 物件：{\"items\": [...]}。"
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
