"""OpenAI-compatible chat completions, Responses web_search, and models probe."""

from __future__ import annotations

from typing import Any

import aiohttp

from server.analyzer.llm_providers_common import check_response


async def complete_openai_style(
    session: aiohttp.ClientSession,
    *,
    base_url: str,
    api_key: str,
    model: str,
    messages: list[dict],
    temperature: float,
    json_mode: bool,
    max_output_tokens: int | None = None,
) -> dict:
    url = f"{base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    if max_output_tokens is not None:
        payload["max_tokens"] = max_output_tokens
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    async with session.post(
        url,
        json=payload,
        headers=headers,
        allow_redirects=False,
    ) as resp:
        await check_response(resp)
        data = await resp.json()
    return {
        "text": data["choices"][0]["message"]["content"],
        "prompt_tokens": data.get("usage", {}).get("prompt_tokens", 0),
        "completion_tokens": data.get("usage", {}).get("completion_tokens", 0),
    }


def _split_system_messages(messages: list[dict]) -> tuple[str | None, list[dict]]:
    """Pull leading system messages into Responses ``instructions``."""
    instructions_parts: list[str] = []
    rest: list[dict] = []
    for msg in messages:
        role = msg.get("role", "user")
        content = str(msg.get("content") or "")
        if role == "system" and not rest:
            if content.strip():
                instructions_parts.append(content)
            continue
        mapped_role = "assistant" if role == "assistant" else "user"
        rest.append({"role": mapped_role, "content": content})
    instructions = "\n\n".join(instructions_parts) if instructions_parts else None
    return instructions, rest


def extract_openai_responses_text(data: dict[str, Any]) -> str:
    """Normalize Responses API payload to a single assistant text string."""
    direct = data.get("output_text")
    if isinstance(direct, str) and direct:
        return direct
    chunks: list[str] = []
    for item in data.get("output") or []:
        if not isinstance(item, dict):
            continue
        if item.get("type") != "message":
            continue
        for part in item.get("content") or []:
            if not isinstance(part, dict):
                continue
            if part.get("type") in {"output_text", "text"} and part.get("text"):
                chunks.append(str(part["text"]))
    return "".join(chunks)


async def complete_openai_responses_web_search(
    session: aiohttp.ClientSession,
    *,
    base_url: str,
    api_key: str,
    model: str,
    messages: list[dict],
    temperature: float,
    json_mode: bool,
    max_output_tokens: int | None = None,
) -> dict:
    """OpenAI Responses API with hosted ``web_search`` (official OpenAI only)."""
    url = f"{base_url.rstrip('/')}/responses"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    instructions, input_messages = _split_system_messages(messages)
    payload: dict[str, Any] = {
        "model": model,
        "input": input_messages or [{"role": "user", "content": ""}],
        "tools": [{"type": "web_search"}],
        "temperature": temperature,
    }
    if instructions:
        payload["instructions"] = instructions
    if max_output_tokens is not None:
        payload["max_output_tokens"] = max_output_tokens
    if json_mode:
        # Prefer JSON object so the agent JSON tool protocol still parses.
        payload["text"] = {"format": {"type": "json_object"}}
    async with session.post(
        url,
        json=payload,
        headers=headers,
        allow_redirects=False,
    ) as resp:
        await check_response(resp)
        data = await resp.json()
    usage = data.get("usage") or {}
    return {
        "text": extract_openai_responses_text(data),
        "prompt_tokens": int(usage.get("input_tokens") or usage.get("prompt_tokens") or 0),
        "completion_tokens": int(usage.get("output_tokens") or usage.get("completion_tokens") or 0),
    }


async def probe_openai_style(session: aiohttp.ClientSession, *, base_url: str, api_key: str) -> None:
    headers = {"Authorization": f"Bearer {api_key}"}
    async with session.get(
        f"{base_url}/models",
        headers=headers,
        allow_redirects=False,
    ) as resp:
        await check_response(resp)
