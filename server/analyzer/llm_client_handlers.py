"""Provider-bound complete/probe methods for ``ConfigurableLlmClient``.

Keeps the client class focused on routing; wire HTTP stays in ``llm_providers``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import aiohttp

from server.analyzer.llm_providers import (
    complete_gemini,
    complete_ollama,
    complete_openai_responses_web_search,
    complete_openai_style,
    probe_gemini,
    probe_ollama,
    probe_openai_style,
)

if TYPE_CHECKING:
    from server.analyzer.llm_client import ConfigurableLlmClient


async def complete_ollama_bound(
    client: ConfigurableLlmClient,
    session: aiohttp.ClientSession,
    messages: list[dict],
    temperature: float,
    json_mode: bool,
    max_output_tokens: int | None,
    native_web_search: str | None = None,
) -> dict:
    del native_web_search  # Ollama has no hosted web search.
    return await complete_ollama(
        session,
        base_url=client.base_url,
        model=client.model,
        messages=messages,
        temperature=temperature,
        json_mode=json_mode,
        think=client.ollama_thinking_enabled,
        max_output_tokens=max_output_tokens,
    )


async def complete_openai_style_bound(
    client: ConfigurableLlmClient,
    session: aiohttp.ClientSession,
    messages: list[dict],
    temperature: float,
    json_mode: bool,
    max_output_tokens: int | None,
    native_web_search: str | None = None,
) -> dict:
    if native_web_search == "openai":
        return await complete_openai_responses_web_search(
            session,
            base_url=client.base_url,
            api_key=client.api_key,
            model=client.model,
            messages=messages,
            temperature=temperature,
            json_mode=json_mode,
            max_output_tokens=max_output_tokens,
        )
    return await complete_openai_style(
        session,
        base_url=client.base_url,
        api_key=client.api_key,
        model=client.model,
        messages=messages,
        temperature=temperature,
        json_mode=json_mode,
        max_output_tokens=max_output_tokens,
    )


async def complete_gemini_bound(
    client: ConfigurableLlmClient,
    session: aiohttp.ClientSession,
    messages: list[dict],
    temperature: float,
    json_mode: bool,
    max_output_tokens: int | None,
    native_web_search: str | None = None,
) -> dict:
    return await complete_gemini(
        session,
        base_url=client.base_url,
        api_key=client.api_key,
        model=client.model,
        messages=messages,
        temperature=temperature,
        json_mode=json_mode,
        max_output_tokens=max_output_tokens,
        thinking_enabled=client.ollama_thinking_enabled,
        google_search=native_web_search == "gemini",
    )


async def probe_ollama_bound(client: ConfigurableLlmClient, session: aiohttp.ClientSession) -> None:
    await probe_ollama(session, base_url=client.base_url)


async def probe_openai_style_bound(client: ConfigurableLlmClient, session: aiohttp.ClientSession) -> None:
    await probe_openai_style(session, base_url=client.base_url, api_key=client.api_key)


async def probe_gemini_bound(client: ConfigurableLlmClient, session: aiohttp.ClientSession) -> None:
    await probe_gemini(session, base_url=client.base_url, api_key=client.api_key)
