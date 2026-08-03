"""Configurable multi-provider LLM client (Ollama / OpenAI-compatible /
Gemini-compatible / OpenRouter).

Provider connection details live in ``system_config`` under per-provider key
prefixes (``{prefix}_base_url`` / ``{prefix}_model`` / ``{prefix}_api_key``).
The configured ``base_url`` is always honoured — the previous generation
hard-coded the OpenAI/Gemini endpoints, breaking every "-compatible" deployment.

Wire implementations live in ``server/analyzer/llm_providers.py``; JSON reply
parsing in ``server/analyzer/llm_json.py``.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Any, ClassVar, NotRequired, TypedDict

import aiohttp

from server.analyzer.llm_providers import (
    LlmClientError,
    complete_gemini,
    complete_ollama,
    complete_openai_responses_web_search,
    complete_openai_style,
    probe_gemini,
    probe_ollama,
    probe_openai_style,
)
from server.config import CONFIG_DEFAULTS, get_config, get_config_int
from server.db.database import Database
from server.outbound import validate_outbound_url
from server.secrets import MASKED_SECRET
from server.util import parse_bool

logger = logging.getLogger(__name__)

#: llm_provider value -> canonical name. The canonical name doubles as the
#: system_config key prefix ({prefix}_base_url / {prefix}_model / {prefix}_api_key)
#: and the wire protocol selector.
_PROVIDER_ALIASES: dict[str, str] = {
    "ollama": "ollama",
    "openai": "openai",
    "openai_compatible": "openai",
    "gemini": "gemini",
    "gemini_compatible": "gemini",
    "openrouter": "openrouter",
}

# Canonical provider -> wire handler key (openai and openrouter share openai-style HTTP).
_PROVIDER_WIRE_KEY: dict[str, str] = {
    "ollama": "ollama",
    "openai": "openai_style",
    "openrouter": "openai_style",
    "gemini": "gemini",
}

CompleteHandler = Callable[
    [
        "ConfigurableLlmClient",
        aiohttp.ClientSession,
        list[dict],
        float,
        bool,
        int | None,
        str | None,
    ],
    Awaitable[dict],
]
ProbeHandler = Callable[["ConfigurableLlmClient", aiohttp.ClientSession], Awaitable[None]]


class LlmConfig(TypedDict):
    provider: str
    provider_raw: str
    model: str
    api_key: str
    base_url: str
    ollama_thinking_enabled: bool
    timeout: NotRequired[str]


def _canonical_provider(raw_provider: str) -> str:
    return _PROVIDER_ALIASES.get(raw_provider, raw_provider)


async def _llm_config_for_raw_provider(db: Database, raw_provider: str) -> LlmConfig:
    canonical = _canonical_provider(raw_provider)
    return {
        "provider": canonical,
        "provider_raw": raw_provider,
        "model": await get_config(db, f"{canonical}_model"),
        "api_key": await get_config(db, f"{canonical}_api_key"),
        "base_url": await get_config(db, f"{canonical}_base_url"),
        "ollama_thinking_enabled": parse_bool(await get_config(db, "ollama_thinking_enabled")),
    }


async def load_llm_config(db: Database) -> LlmConfig:
    """Resolve the active provider's connection config from ``system_config``."""
    raw_provider = (await get_config(db, "llm_provider")).strip() or "ollama"
    return await _llm_config_for_raw_provider(db, raw_provider)


async def load_agent_llm_config(db: Database) -> LlmConfig:
    """Resolve LLM config for the assistant/agent.

    ``assistant_llm_provider`` empty / ``follow`` / unknown → global ``llm_provider``.
    Otherwise use that provider id; ``assistant_llm_{base_url,model,api_key}``
    override when non-empty, else fall back to the provider's ``{canonical}_*`` keys.
    """
    override = (await get_config(db, "assistant_llm_provider")).strip()
    global_raw = (await get_config(db, "llm_provider")).strip() or "ollama"
    if not override or override.lower() == "follow" or override not in _PROVIDER_ALIASES:
        return await _llm_config_for_raw_provider(db, global_raw)

    config = await _llm_config_for_raw_provider(db, override)
    assistant_base_url = (await get_config(db, "assistant_llm_base_url")).strip()
    assistant_model = (await get_config(db, "assistant_llm_model")).strip()
    assistant_api_key = (await get_config(db, "assistant_llm_api_key")).strip()
    if assistant_base_url:
        config["base_url"] = assistant_base_url
    if assistant_model:
        config["model"] = assistant_model
    if assistant_api_key:
        config["api_key"] = assistant_api_key
    return config


class ConfigurableLlmClient:
    """Routes chat completions to the configured provider.

    Unified response shape: ``{text, prompt_tokens, completion_tokens}``.
    """

    _COMPLETE_HANDLERS: ClassVar[dict[str, CompleteHandler]]
    _PROBE_HANDLERS: ClassVar[dict[str, ProbeHandler]]

    def __init__(
        self,
        provider: str,
        model: str,
        api_key: str,
        base_url: str,
        timeout_seconds: int = 120,
        allow_loopback: bool = False,
        ollama_thinking_enabled: bool = False,
    ) -> None:
        self.provider = provider
        self.model = model
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.allow_loopback = allow_loopback
        self.ollama_thinking_enabled = ollama_thinking_enabled
        self._session: aiohttp.ClientSession | None = None

    @classmethod
    def _from_resolved_config(cls, config: LlmConfig, timeout_seconds: int) -> "ConfigurableLlmClient":
        base_url = config["base_url"]
        if not base_url:
            base_url = CONFIG_DEFAULTS.get(f"{config['provider']}_base_url", "")
        return cls(
            provider=config["provider"],
            model=config["model"],
            api_key=config["api_key"],
            base_url=base_url,
            timeout_seconds=timeout_seconds,
            allow_loopback=config["provider_raw"] in ("ollama", "openai_compatible"),
            ollama_thinking_enabled=config["ollama_thinking_enabled"],
        )

    @classmethod
    async def from_db(cls, db: Database) -> "ConfigurableLlmClient":
        config = await load_llm_config(db)
        timeout = await get_config_int(db, "llm_generation_timeout")
        return cls._from_resolved_config(config, timeout)

    @classmethod
    async def from_db_for_agent(cls, db: Database) -> "ConfigurableLlmClient":
        """Build a client using ``assistant_llm_provider`` (follow / override)."""
        config = await load_agent_llm_config(db)
        timeout = await get_config_int(db, "llm_generation_timeout")
        return cls._from_resolved_config(config, timeout)

    @classmethod
    async def from_draft(cls, db: Database, draft: dict[str, Any]) -> "ConfigurableLlmClient":
        """Build a one-off client from unsaved UI draft values."""
        saved = await load_llm_config(db)
        raw_provider = str(draft.get("llmProvider") or saved["provider_raw"] or "ollama").strip()
        canonical = _PROVIDER_ALIASES.get(raw_provider, raw_provider)
        base_url = str(draft.get("llmBaseUrl") or saved["base_url"] or "").strip()
        if not base_url:
            base_url = CONFIG_DEFAULTS.get(f"{canonical}_base_url", "")
        model = str(draft.get("llmModel") or saved["model"] or "").strip()
        draft_api_key = draft.get("llmApiKey")
        api_key = str(saved["api_key"] if draft_api_key in (None, MASKED_SECRET) else draft_api_key)
        draft_thinking = draft.get("ollamaThinkingEnabled")
        if draft_thinking is None:
            ollama_thinking_enabled = saved["ollama_thinking_enabled"]
        else:
            ollama_thinking_enabled = bool(draft_thinking)
        timeout = await get_config_int(db, "llm_generation_timeout")
        return cls(
            provider=canonical,
            model=model,
            api_key=api_key,
            base_url=base_url,
            timeout_seconds=timeout,
            allow_loopback=raw_provider in ("ollama", "openai_compatible"),
            ollama_thinking_enabled=ollama_thinking_enabled,
        )

    def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout_seconds))
        return self._session

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()

    def _wire_key(self) -> str | None:
        return _PROVIDER_WIRE_KEY.get(self.provider)

    async def _complete_ollama(
        self,
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
            base_url=self.base_url,
            model=self.model,
            messages=messages,
            temperature=temperature,
            json_mode=json_mode,
            think=self.ollama_thinking_enabled,
            max_output_tokens=max_output_tokens,
        )

    async def _complete_openai_style(
        self,
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
                base_url=self.base_url,
                api_key=self.api_key,
                model=self.model,
                messages=messages,
                temperature=temperature,
                json_mode=json_mode,
                max_output_tokens=max_output_tokens,
            )
        return await complete_openai_style(
            session,
            base_url=self.base_url,
            api_key=self.api_key,
            model=self.model,
            messages=messages,
            temperature=temperature,
            json_mode=json_mode,
            max_output_tokens=max_output_tokens,
        )

    async def _complete_gemini(
        self,
        session: aiohttp.ClientSession,
        messages: list[dict],
        temperature: float,
        json_mode: bool,
        max_output_tokens: int | None,
        native_web_search: str | None = None,
    ) -> dict:
        return await complete_gemini(
            session,
            base_url=self.base_url,
            api_key=self.api_key,
            model=self.model,
            messages=messages,
            temperature=temperature,
            json_mode=json_mode,
            max_output_tokens=max_output_tokens,
            google_search=native_web_search == "gemini",
        )

    async def _probe_ollama(self, session: aiohttp.ClientSession) -> None:
        await probe_ollama(session, base_url=self.base_url)

    async def _probe_openai_style(self, session: aiohttp.ClientSession) -> None:
        await probe_openai_style(session, base_url=self.base_url, api_key=self.api_key)

    async def _probe_gemini(self, session: aiohttp.ClientSession) -> None:
        await probe_gemini(session, base_url=self.base_url, api_key=self.api_key)

    async def complete(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        json_mode: bool = False,
        max_output_tokens: int | None = None,
        *,
        native_web_search: str | None = None,
    ) -> dict:
        await validate_outbound_url(self.base_url, allow_loopback=self.allow_loopback)
        wire_key = self._wire_key()
        if wire_key is None:
            raise LlmClientError(f"Unsupported provider: {self.provider}")
        handler = ConfigurableLlmClient._COMPLETE_HANDLERS[wire_key]
        session = self._get_session()
        try:
            return await handler(
                self,
                session,
                messages,
                temperature,
                json_mode,
                max_output_tokens,
                native_web_search,
            )
        except LlmClientError as exc:
            # Wire helpers may omit provider; attach for Settings→Logs forensics.
            if exc.provider is None:
                exc.provider = self.provider
            raise

    _TEST_PROMPT = "Reply with exactly: ok"

    async def test_completion(self) -> dict[str, Any]:
        """Run a minimal-token generation probe (about one completion token)."""
        messages = [{"role": "user", "content": self._TEST_PROMPT}]
        try:
            result = await self.complete(messages, temperature=0, json_mode=False, max_output_tokens=1)
            preview = str(result.get("text") or "").strip()[:80]
            return {
                "success": True,
                "prompt_tokens": int(result.get("prompt_tokens") or 0),
                "completion_tokens": int(result.get("completion_tokens") or 0),
                "preview": preview,
                "error": None,
            }
        except Exception as exc:  # noqa: BLE001 — diagnostics endpoint must not raise
            return {
                "success": False,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "preview": None,
                "error": str(exc),
            }

    async def health_check(self) -> dict:
        """Probe the provider; returns {status, provider, model, error}."""
        try:
            await validate_outbound_url(self.base_url, allow_loopback=self.allow_loopback)
            wire_key = self._wire_key()
            if wire_key is None:
                return {
                    "status": "error",
                    "provider": self.provider,
                    "model": self.model,
                    "error": f"Unsupported provider: {self.provider}",
                }
            handler = ConfigurableLlmClient._PROBE_HANDLERS[wire_key]
            session = self._get_session()
            await handler(self, session)
            return {
                "status": "ok",
                "provider": self.provider,
                "model": self.model,
                "error": None,
            }
        except Exception as exc:  # noqa: BLE001 — diagnostics, never raises
            return {
                "status": "error",
                "provider": self.provider,
                "model": self.model,
                "error": str(exc),
            }


ConfigurableLlmClient._COMPLETE_HANDLERS = {
    "ollama": ConfigurableLlmClient._complete_ollama,
    "openai_style": ConfigurableLlmClient._complete_openai_style,
    "gemini": ConfigurableLlmClient._complete_gemini,
}
ConfigurableLlmClient._PROBE_HANDLERS = {
    "ollama": ConfigurableLlmClient._probe_ollama,
    "openai_style": ConfigurableLlmClient._probe_openai_style,
    "gemini": ConfigurableLlmClient._probe_gemini,
}
