"""Configurable multi-provider LLM client (Ollama / OpenAI-compatible /
Gemini-compatible / OpenRouter).

Provider connection details live in ``llm_profiles`` rows (stamp 29+).
The configured ``base_url`` is always honoured — the previous generation
hard-coded the OpenAI/Gemini endpoints, breaking every "-compatible" deployment.

Wire implementations live in ``server/analyzer/llm_providers.py``; JSON reply
parsing in ``server/analyzer/llm_json.py``; factory helpers in
``llm_client_factory.py``; bound handlers in ``llm_client_handlers.py``.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any, ClassVar

import aiohttp

from server.analyzer.llm_client_factory import (
    client_from_assistant_staff,
    client_from_default_profile,
    client_from_draft,
    client_from_profile,
    client_from_resolved_config,
)
from server.analyzer.llm_client_handlers import (
    complete_gemini_bound,
    complete_ollama_bound,
    complete_openai_style_bound,
    probe_gemini_bound,
    probe_ollama_bound,
    probe_openai_style_bound,
)
from server.analyzer.llm_config import load_agent_llm_config, load_llm_config
from server.analyzer.llm_providers import LlmClientError
from server.db.database import Database
from server.outbound import validate_outbound_url

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
    def _from_resolved_config(cls, config, timeout_seconds: int) -> "ConfigurableLlmClient":
        return client_from_resolved_config(cls, config, timeout_seconds)

    @classmethod
    async def from_default_profile(cls, db: Database) -> "ConfigurableLlmClient":
        """Build a client from the default ``llm_profiles`` row."""
        return await client_from_default_profile(cls, db)

    @classmethod
    async def from_assistant_staff(cls, db: Database) -> "ConfigurableLlmClient":
        """Build a client from the active ``staff_class=assistant`` profile binding."""
        return await client_from_assistant_staff(cls, db)

    @classmethod
    async def from_profile(cls, db: Database, profile_id: str | None) -> "ConfigurableLlmClient":
        """Build a client from an ``llm_profiles`` row."""
        return await client_from_profile(cls, db, profile_id)

    @classmethod
    async def from_draft(cls, db: Database, draft: dict[str, Any]) -> "ConfigurableLlmClient":
        """Build a one-off client from unsaved UI draft values."""
        return await client_from_draft(cls, db, draft)

    def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout_seconds))
        return self._session

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()

    def _wire_key(self) -> str | None:
        return _PROVIDER_WIRE_KEY.get(self.provider)

    # Bound names retained for tests that patch ``_COMPLETE_HANDLERS`` entries
    # keyed to these callables via the class attribute map below.
    _complete_ollama = complete_ollama_bound
    _complete_openai_style = complete_openai_style_bound
    _complete_gemini = complete_gemini_bound
    _probe_ollama = probe_ollama_bound
    _probe_openai_style = probe_openai_style_bound
    _probe_gemini = probe_gemini_bound

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

# Stable re-exports used by callers / tests.
__all__ = [
    "ConfigurableLlmClient",
    "load_agent_llm_config",
    "load_llm_config",
]
