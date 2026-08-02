"""Per-provider wire implementations (Ollama / OpenAI-style / Gemini).

OpenRouter speaks the OpenAI chat-completions protocol and shares
``complete_openai_style``. Every function returns the unified shape
``{text, prompt_tokens, completion_tokens}``.
"""

from __future__ import annotations

from typing import Any

import aiohttp


class LlmClientError(Exception):
    """Raised when an LLM HTTP request fails."""


async def check_response(resp: aiohttp.ClientResponse) -> None:
    if resp.status >= 400:
        body = await resp.text()
        raise LlmClientError(f"LLM request failed with status {resp.status}: {body[:500]}")


# ── Ollama ────────────────────────────────────────────────────────────────


async def complete_ollama(
    session: aiohttp.ClientSession,
    *,
    base_url: str,
    model: str,
    messages: list[dict],
    temperature: float,
    json_mode: bool,
    think: bool = False,
    max_output_tokens: int | None = None,
) -> dict:
    url = f"{base_url}/api/chat"
    options: dict[str, Any] = {"temperature": temperature}
    if max_output_tokens is not None:
        options["num_predict"] = max_output_tokens
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": False,
        "think": think,
        "options": options,
    }
    if json_mode:
        payload["format"] = "json"
    async with session.post(url, json=payload, allow_redirects=False) as resp:
        await check_response(resp)
        data = await resp.json()
    return {
        "text": data["message"]["content"],
        "prompt_tokens": data.get("prompt_eval_count", 0),
        "completion_tokens": data.get("eval_count", 0),
    }


async def probe_ollama(session: aiohttp.ClientSession, *, base_url: str) -> None:
    async with session.get(f"{base_url}/api/tags", allow_redirects=False) as resp:
        await check_response(resp)


# ── OpenAI-compatible (OpenAI / OpenRouter / any /chat/completions) ──────


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


# ── Gemini-compatible ─────────────────────────────────────────────────────


def convert_messages_to_gemini(messages: list[dict]) -> list[dict]:
    contents: list[dict] = []
    for msg in messages:
        role = msg.get("role", "user")
        text = msg.get("content", "")
        gemini_role = "model" if role == "assistant" else "user"
        contents.append({"role": gemini_role, "parts": [{"text": text}]})
    return contents


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
    google_search: bool = False,
) -> dict:
    url = f"{base_url}/models/{model}:generateContent?key={api_key}"
    generation_config: dict[str, Any] = {"temperature": temperature}
    if max_output_tokens is not None:
        generation_config["maxOutputTokens"] = max_output_tokens
    if json_mode:
        generation_config["responseMimeType"] = "application/json"
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
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    usage = data.get("usageMetadata", {})
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
