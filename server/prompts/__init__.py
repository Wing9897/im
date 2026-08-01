"""Version-controlled system / schema prompt texts (not user task templates).

Task ``promptTemplate`` values live in SQLite ``analysis_tasks``.
Assembly and LLM orchestration stay in ``server.analyzer.prompt``,
``server.agent.runtime``, and ``server.analyzer.engine``.

``clock`` and ``locale`` are intentional deep-imports (not listed in ``__all__``).
"""

from __future__ import annotations

from server.prompts.analysis import (
    EVENT_SCHEMA_INSTRUCTION,
    JSON_OUTPUT_PREAMBLE,
    LEADERBOARD_CONTEXT_HEADER,
    LEADERBOARD_SCHEMA_INSTRUCTION,
    STRATEGY_INSTRUCTIONS,
)
from server.prompts.assistant import (
    A2A_AGENT_SYSTEM_PROMPT,
    AGENT_SYSTEM_PROMPT,
    CHAT_ASSISTANT_SYSTEM_PROMPT,
    TASK_CONFIG_SCHEMA_PROMPT,
    web_search_prompt_note,
)

__all__ = (
    "A2A_AGENT_SYSTEM_PROMPT",
    "AGENT_SYSTEM_PROMPT",
    "CHAT_ASSISTANT_SYSTEM_PROMPT",
    "EVENT_SCHEMA_INSTRUCTION",
    "JSON_OUTPUT_PREAMBLE",
    "LEADERBOARD_CONTEXT_HEADER",
    "LEADERBOARD_SCHEMA_INSTRUCTION",
    "STRATEGY_INSTRUCTIONS",
    "TASK_CONFIG_SCHEMA_PROMPT",
    "web_search_prompt_note",
)
