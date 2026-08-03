"""Analysis engine: LLM orchestration + chat assistant.

The engine owns one ConfigurableLlmClient and hot-reloads it when the
LLM-related ``system_config`` values change (hash comparison per call).
Batch persistence lives in the scheduler package; this module only turns
(prompt, messages) into parsed structured items.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from typing import Any

from server.analyzer.llm_client import ConfigurableLlmClient, load_llm_config
from server.analyzer.llm_json import normalize_items, parse_json_response
from server.analyzer.prompt import AssembledPrompt
from server.config import get_config, get_config_int
from server.db.database import Database
from server.prompts import CHAT_ASSISTANT_SYSTEM_PROMPT
from server.prompts.locale import normalize_ui_locale, output_language_directive
from server.util import is_openai_json_mode_enabled

logger = logging.getLogger(__name__)

#: Form fields sent as draft context (channelIds intentionally omitted).
_CURRENT_TASK_CONTEXT_KEYS = (
    "name",
    "description",
    "promptTemplate",
    "webSearchQuery",
    "analysisMode",
    "analysisTimeRange",
    "scheduleRrule",
    "rrule",
    "eventStartTime",
    "eventEndTime",
    "eventIsAllDay",
    "eventLocation",
    "eventDescription",
)


class AnalysisEngine:
    """Owns the LLM client and provides analyze/chat entry points.

    The client is created lazily on first use so startup never blocks on
    LLM configuration; each call re-checks the config hash and hot-reloads.
    """

    def __init__(self, db: Database) -> None:
        self._db = db
        self._client: ConfigurableLlmClient | None = None
        self._config_hash = ""
        self._client_lock = asyncio.Lock()

    @property
    def provider(self) -> str:
        return self._client.provider if self._client is not None else ""

    @property
    def model(self) -> str:
        return self._client.model if self._client is not None else ""

    async def close(self) -> None:
        if self._client is not None:
            await self._client.close()
            self._client = None

    async def health_check(self) -> dict:
        try:
            client = await self._ensure_client()
        except Exception as exc:  # noqa: BLE001 — diagnostics endpoint never raises
            return {"status": "error", "provider": "", "model": "", "error": str(exc)}
        return await client.health_check()

    async def test_completion(self, draft: dict[str, Any] | None = None) -> dict[str, Any]:
        """Minimal-token generation probe using saved or draft provider settings."""
        if draft:
            client = await ConfigurableLlmClient.from_draft(self._db, draft)
            try:
                result = await client.test_completion()
            finally:
                await client.close()
            return {
                **result,
                "provider": client.provider,
                "model": client.model,
            }

        try:
            client = await self._ensure_client()
        except Exception as exc:  # noqa: BLE001 — diagnostics endpoint never raises
            return {
                "success": False,
                "provider": "",
                "model": "",
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "preview": None,
                "error": str(exc),
            }
        result = await client.test_completion()
        return {
            **result,
            "provider": client.provider,
            "model": client.model,
        }

    # ── batch analysis ──────────────────────────────────────────────────

    async def analyze(self, prompt: AssembledPrompt) -> dict[str, Any]:
        """Run one assembled prompt through the LLM and parse mode items.

        Returns ``{items, prompt_tokens, completion_tokens}``.
        Raises LlmClientError / ValueError on failure (caller handles retry).
        """
        client = await self._ensure_client()
        json_mode = await self._json_mode_for_analyze(client)
        result = await client.complete(prompt.llm_messages, json_mode=json_mode)
        parsed = parse_json_response(result["text"])
        return {
            "items": normalize_items(parsed),
            "prompt_tokens": int(result.get("prompt_tokens") or 0),
            "completion_tokens": int(result.get("completion_tokens") or 0),
        }

    # ── task advisor (agent tool tasks.consult_advisor) ─────────────────

    async def handle_chat_assistant(
        self,
        message: str,
        current_task: dict[str, Any] | None = None,
        locale: str | None = None,
    ) -> dict[str, Any]:
        """Returns {message, taskConfig} (taskConfig may be None)."""
        resolved_locale = (
            normalize_ui_locale(locale)
            if locale is not None and str(locale).strip()
            else normalize_ui_locale(await get_config(self._db, "ui_locale"))
        )
        system_prompt = CHAT_ASSISTANT_SYSTEM_PROMPT + "\n\n" + output_language_directive(resolved_locale)
        user_content = message
        draft = self._sanitize_current_task(current_task)
        if draft:
            user_content = (
                "Current task form draft (JSON). Use this as context; do not "
                "clear filled fields unless the user asks:\n"
                f"{json.dumps(draft, ensure_ascii=False, indent=2)}\n\n"
                f"User message:\n{message}"
            )
        client = await self._ensure_client()
        result = await client.complete(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ]
        )
        response_text = result["text"]
        return {
            "message": response_text,
            "taskConfig": self._extract_task_config(response_text),
        }

    @staticmethod
    def _sanitize_current_task(current_task: Any) -> dict[str, Any] | None:
        """Keep assistant-relevant draft fields; drop channelIds and empties."""
        if not isinstance(current_task, dict):
            return None
        draft: dict[str, Any] = {}
        for key in _CURRENT_TASK_CONTEXT_KEYS:
            if key not in current_task:
                continue
            value = current_task[key]
            if value is None:
                continue
            if isinstance(value, str) and not value.strip():
                continue
            draft[key] = value
        return draft or None

    @staticmethod
    def _extract_task_config(text: str) -> dict | None:
        """Parse assistant reply JSON via shared llm_json helpers (batch-aligned)."""
        try:
            data = parse_json_response(text)
        except ValueError:
            return None
        if not isinstance(data, dict):
            return None
        if "taskConfig" in data and isinstance(data["taskConfig"], dict):
            return data["taskConfig"]
        if "name" in data and "promptTemplate" in data:
            return data
        return None

    # ── lazy creation + hot reload ───────────────────────────────────────

    @staticmethod
    async def _current_config_hash(db: Database) -> str:
        config = await load_llm_config(db)
        config["timeout"] = str(await get_config_int(db, "llm_generation_timeout"))
        return hashlib.md5(json.dumps(config, sort_keys=True).encode()).hexdigest()

    async def _json_mode_enabled(self) -> bool:
        return is_openai_json_mode_enabled(await get_config(self._db, "openai_json_mode"))

    async def _json_mode_for_analyze(self, client: ConfigurableLlmClient) -> bool:
        """Batch analysis always needs JSON; Ollama uses ``format: json`` even when OpenAI mode is off."""
        if client.provider == "ollama":
            return True
        return await self._json_mode_enabled()

    async def _ensure_client(self) -> ConfigurableLlmClient:
        """Create the client on first use; hot-reload when config changed."""
        async with self._client_lock:
            new_hash = await self._current_config_hash(self._db)
            if self._client is not None and new_hash == self._config_hash:
                return self._client
            try:
                new_client = await ConfigurableLlmClient.from_db(self._db)
            except Exception as exc:  # noqa: BLE001 — keep last working client
                if self._client is not None:
                    logger.warning(
                        "Failed to reload LLM client with new config, retaining previous: %s",
                        exc,
                    )
                    return self._client
                raise
            if self._client is not None:
                await self._client.close()
            self._client = new_client
            self._config_hash = new_hash
            return self._client
