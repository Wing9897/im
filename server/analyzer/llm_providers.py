"""Per-provider wire implementations (Ollama / OpenAI-style / Gemini).

OpenRouter speaks the OpenAI chat-completions protocol and shares
``complete_openai_style``. Every function returns the unified shape
``{text, prompt_tokens, completion_tokens}``.

Implementations live in ``llm_providers_common`` / ``_ollama`` / ``_openai`` /
``_gemini``; this module re-exports the public surface.
"""

from __future__ import annotations

from server.analyzer.llm_providers_common import (
    LLM_RESPONSE_BODY_CAP,
    LlmClientError,
    check_response,
)
from server.analyzer.llm_providers_gemini import (
    GEMINI_MAX_TOKENS_MESSAGE,
    GEMINI_THINKING_LEVEL_MINIMAL,
    complete_gemini,
    convert_messages_to_gemini,
    extract_gemini_text,
    gemini_thinking_config,
    probe_gemini,
)
from server.analyzer.llm_providers_ollama import complete_ollama, probe_ollama
from server.analyzer.llm_providers_openai import (
    complete_openai_responses_web_search,
    complete_openai_style,
    extract_openai_responses_text,
    probe_openai_style,
)

__all__ = [
    "GEMINI_MAX_TOKENS_MESSAGE",
    "GEMINI_THINKING_LEVEL_MINIMAL",
    "LLM_RESPONSE_BODY_CAP",
    "LlmClientError",
    "check_response",
    "complete_gemini",
    "complete_ollama",
    "complete_openai_responses_web_search",
    "complete_openai_style",
    "convert_messages_to_gemini",
    "extract_gemini_text",
    "extract_openai_responses_text",
    "gemini_thinking_config",
    "probe_gemini",
    "probe_ollama",
    "probe_openai_style",
]
