"""Agent system-prompt assembly (tools + clock + locale + web search notes)."""

from __future__ import annotations

import json
from datetime import datetime

from server.agent.tools_registry import build_tool_schemas
from server.prompts.assistant import (
    AGENT_SYSTEM_PROMPT,
    task_advisor_prompt_note,
    user_background_prompt_note,
    web_search_prompt_note,
)
from server.prompts.clock import ASSISTANT_CLOCK_NOTE, current_time_prompt_block
from server.prompts.locale import normalize_ui_locale, output_language_directive


def _tools_prompt_block(
    *,
    inject_web_search_tool: bool,
    task_advisor_enabled: bool = False,
    calendar_writes_enabled: bool = True,
) -> str:
    return json.dumps(
        build_tool_schemas(
            web_search_enabled=inject_web_search_tool,
            task_advisor_enabled=task_advisor_enabled,
            calendar_writes_enabled=calendar_writes_enabled,
        ),
        ensure_ascii=False,
        indent=2,
    )


def build_system_prompt(
    *,
    now: datetime | None = None,
    locale: str | None = None,
    web_search_enabled: bool = True,
    web_search_provider: str = "duckduckgo",
    web_search_mode: str | None = None,
    inject_web_search_tool: bool | None = None,
    task_advisor_enabled: bool = False,
    calendar_writes_enabled: bool = True,
    user_background: str | None = None,
    base_prompt: str | None = None,
) -> str:
    inject_tool = web_search_enabled if inject_web_search_tool is None else inject_web_search_tool
    return (
        (base_prompt if base_prompt is not None else AGENT_SYSTEM_PROMPT)
        + current_time_prompt_block(now, authority_note=ASSISTANT_CLOCK_NOTE)
        + user_background_prompt_note(user_background)
        + web_search_prompt_note(
            web_search_enabled=web_search_enabled,
            provider=web_search_provider,
            mode=web_search_mode,
        )
        + task_advisor_prompt_note(task_advisor_enabled=task_advisor_enabled)
        + _tools_prompt_block(
            inject_web_search_tool=inject_tool,
            task_advisor_enabled=task_advisor_enabled,
            calendar_writes_enabled=calendar_writes_enabled,
        )
        + "\n\n"
        + output_language_directive(normalize_ui_locale(locale))
    )
