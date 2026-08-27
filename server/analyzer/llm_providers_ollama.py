"""Ollama ``/api/chat`` and tags probe."""

from __future__ import annotations

from typing import Any

import aiohttp

from server.analyzer.llm_providers_common import check_response


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
