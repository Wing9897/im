"""Gemini generateContent wire helpers and models probe."""

from __future__ import annotations

from typing import Any

import aiohttp

from server.analyzer.llm_providers_common import LLM_RESPONSE_BODY_CAP, LlmClientError, check_response

#: Stable summary when Gemini hits the output cap with no usable reply text.
#: Batch ``error_message`` stores this string; the UI maps it to zh-Hant copy.
GEMINI_MAX_TOKENS_MESSAGE = (
    "Gemini response was truncated (MAX_TOKENS). Increase max output tokens or shorten the prompt."
)

#: Gemini 3 thinking level used when the profile has thinking turned off.
GEMINI_THINKING_LEVEL_MINIMAL = "MINIMAL"


def gemini_thinking_config(*, thinking_enabled: bool) -> dict[str, Any] | None:
    """Build Gemini 3 ``thinkingConfig`` (never mix with Gemini 2.5 ``thinkingBudget``).

    Off → ``thinkingLevel: MINIMAL`` so default thinking cannot exhaust the
    output budget. On → omit the block so the model uses its default thinking.
    """
    if thinking_enabled:
        return None
    return {"thinkingLevel": GEMINI_THINKING_LEVEL_MINIMAL}


def convert_messages_to_gemini(messages: list[dict]) -> list[dict]:
    contents: list[dict] = []
    for msg in messages:
        role = msg.get("role", "user")
        text = msg.get("content", "")
        gemini_role = "model" if role == "assistant" else "user"
        contents.append({"role": gemini_role, "parts": [{"text": text}]})
    return contents


def _gemini_output_texts(parts: object) -> list[str]:
    """Collect non-thought ``text`` parts; thinking traces are not reply content."""
    texts: list[str] = []
    if not isinstance(parts, list):
        return texts
    for part in parts:
        if not isinstance(part, dict):
            continue
        if part.get("thought") is True:
            continue
        text_part = part.get("text")
        if isinstance(text_part, str):
            texts.append(text_part)
    return texts


def extract_gemini_text(data: dict[str, Any]) -> str:
    """Pull reply text from generateContent JSON; never raise raw KeyError repr.

    ``finishReason=MAX_TOKENS`` with truncated but non-empty output is returned
    as-is so downstream JSON-mode / analysis parsing can still succeed. Empty
    or thought-only MAX_TOKENS responses raise a dedicated truncation error.
    """
    prompt_feedback = data.get("promptFeedback")
    if isinstance(prompt_feedback, dict):
        block_reason = prompt_feedback.get("blockReason")
        if block_reason:
            raise LlmClientError(
                f"Gemini blocked the request ({block_reason})",
                provider="gemini",
                response_body=str(data)[:LLM_RESPONSE_BODY_CAP],
            )

    candidates = data.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        raise LlmClientError(
            "Gemini response has no usable candidates",
            provider="gemini",
            response_body=str(data)[:LLM_RESPONSE_BODY_CAP],
        )

    first = candidates[0] if isinstance(candidates[0], dict) else {}
    finish_reason = str(first.get("finishReason") or "")
    content = first.get("content") if isinstance(first.get("content"), dict) else {}
    parts = content.get("parts") if isinstance(content, dict) else None
    text = "".join(_gemini_output_texts(parts))
    if text.strip():
        return text
    if finish_reason.upper() == "MAX_TOKENS":
        raise LlmClientError(
            GEMINI_MAX_TOKENS_MESSAGE,
            provider="gemini",
            response_body=str(data)[:LLM_RESPONSE_BODY_CAP],
        )
    reason = finish_reason or "empty"
    raise LlmClientError(
        f"Gemini response has no usable candidates ({reason})",
        provider="gemini",
        response_body=str(data)[:LLM_RESPONSE_BODY_CAP],
    )


async def complete_gemini(
    session: aiohttp.ClientSession,
    *,
    base_url: str,
    api_key: str,
    model: str,
    messages: list[dict],
    temperature: float,
    json_mode: bool,
    max_output_tokens: int | None = None,
    thinking_enabled: bool = False,
    google_search: bool = False,
) -> dict:
    url = f"{base_url}/models/{model}:generateContent?key={api_key}"
    generation_config: dict[str, Any] = {"temperature": temperature}
    if max_output_tokens is not None:
        generation_config["maxOutputTokens"] = max_output_tokens
    if json_mode:
        generation_config["responseMimeType"] = "application/json"
    thinking_config = gemini_thinking_config(thinking_enabled=thinking_enabled)
    if thinking_config is not None:
        generation_config["thinkingConfig"] = thinking_config
    payload: dict[str, Any] = {
        "contents": convert_messages_to_gemini(messages),
        "generationConfig": generation_config,
    }
    if google_search:
        # generateContent grounding tool (official Gemini API).
        payload["tools"] = [{"google_search": {}}]
    async with session.post(url, json=payload, allow_redirects=False) as resp:
        await check_response(resp)
        data = await resp.json()
    text = extract_gemini_text(data if isinstance(data, dict) else {})
    usage = data.get("usageMetadata", {}) if isinstance(data, dict) else {}
    return {
        "text": text,
        "prompt_tokens": usage.get("promptTokenCount", 0),
        "completion_tokens": usage.get("candidatesTokenCount", 0),
    }


async def probe_gemini(session: aiohttp.ClientSession, *, base_url: str, api_key: str) -> None:
    async with session.get(
        f"{base_url}/models?key={api_key}",
        allow_redirects=False,
    ) as resp:
        await check_response(resp)
