"""Analysis engine: LLM orchestration + chat assistant.

The engine owns ConfigurableLlmClient instances keyed by profile id and
hot-reloads when the profile row / timeout changes (hash comparison per call).
Batch persistence lives in the scheduler package; this module only turns
(prompt, messages) into parsed structured items.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from typing import Any

from server.analyzer.llm_client import ConfigurableLlmClient
from server.analyzer.llm_config import (
    load_llm_config_for_profile,
    resolve_assistant_diagnostic_profile_id,
)
from server.analyzer.llm_json import normalize_items, parse_json_response
from server.analyzer.prompt import AssembledPrompt
from server.config import get_config, get_config_int
from server.db.database import Database
from server.errors import diagnostic_error_fields
from server.prompts import CHAT_ASSISTANT_SYSTEM_PROMPT
from server.prompts.locale import normalize_ui_locale, output_language_directive
from server.util import is_openai_json_mode_enabled

logger = logging.getLogger(__name__)

#: Form fields sent as draft context (channelIds intentionally omitted).
_CURRENT_TASK_CONTEXT_KEYS = (
    "name",
    "description",
    "promptTemplate",
    "analysisMode",
    "analysisTimeRange",
    "scheduleRrule",
    "rrule",
    "eventStartTime",
    "eventEndTime",
    "eventIsAllDay",
    "eventLocation",
    "eventDescription",
    "llmProfileId",
)


class AnalysisEngine:
    """Owns LLM clients and provides analyze/chat entry points.

    Clients are created lazily on first use so startup never blocks on
    LLM configuration; each call re-checks the config hash and hot-reloads.
    """

    def __init__(self, db: Database) -> None:
        self._db = db
        self._clients: dict[str, ConfigurableLlmClient] = {}
        self._config_hashes: dict[str, str] = {}
        self._client_lock = asyncio.Lock()
        self._last_profile_id = ""

    @property
    def provider(self) -> str:
        client = self._clients.get(self._last_profile_id)
        return client.provider if client is not None else ""

    @property
    def model(self) -> str:
        client = self._clients.get(self._last_profile_id)
        return client.model if client is not None else ""

    async def close(self) -> None:
        for client in self._clients.values():
            await client.close()
        self._clients.clear()
        self._config_hashes.clear()

    @staticmethod
    def _setup_diagnostic(exc: BaseException) -> dict[str, str]:
        code, message = diagnostic_error_fields(exc)
        return {"error_code": code, "error": message}

    async def health_check(self) -> dict:
        try:
            profile_id = await resolve_assistant_diagnostic_profile_id(self._db)
            client = await self._ensure_client(profile_id)
        except Exception as exc:  # noqa: BLE001 — diagnostics endpoint never raises
            return {"status": "error", "provider": "", "model": "", **self._setup_diagnostic(exc)}
        return await client.health_check()

    async def test_completion(self, draft: dict[str, Any] | None = None) -> dict[str, Any]:
        """Minimal-token generation probe using saved or draft profile fields."""
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
            profile_id = await resolve_assistant_diagnostic_profile_id(self._db)
            client = await self._ensure_client(profile_id)
        except Exception as exc:  # noqa: BLE001 — diagnostics endpoint never raises
            return {
                "success": False,
                "provider": "",
                "model": "",
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "preview": None,
                **self._setup_diagnostic(exc),
            }
        result = await client.test_completion()
        return {
            **result,
            "provider": client.provider,
            "model": client.model,
        }

    # ── batch analysis ──────────────────────────────────────────────────

    async def analyze(self, prompt: AssembledPrompt, *, profile_id: str | None = None) -> dict[str, Any]:
        """Run one assembled prompt through the LLM and parse mode items.

        Returns ``{items, prompt_tokens, completion_tokens}``.
        Raises LlmClientError / ValueError on failure (caller handles retry).
        """
        client = await self._ensure_client(profile_id)
        json_mode = await self._json_mode_for_analyze(client, profile_id)
        result = await client.complete(prompt.llm_messages, json_mode=json_mode)
        parsed = parse_json_response(result["text"])
        return {
            "items": normalize_items(parsed),
            "prompt_tokens": int(result.get("prompt_tokens") or 0),
            "completion_tokens": int(result.get("completion_tokens") or 0),
        }

    # ── task advisor (agent tool tasks.consult_advisor) ─────────────────

    async def consult_task_advisor(
        self,
        message: str,
        current_task: dict[str, Any] | None = None,
        locale: str | None = None,
    ) -> dict[str, Any]:
        """Product surface: agent tool ``tasks.consult_advisor``. Returns {message, taskConfig}."""
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
        # Task advisor uses its fixed global slot (not the task form's llmProfileId).
        from server.llm_global_slots import require_slot_profile_id

        advisor_profile_id = await require_slot_profile_id(self._db, "taskEditor")
        client = await self._ensure_client(advisor_profile_id)
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
    async def _config_hash_for_profile(db: Database, profile_id: str | None) -> tuple[str, str]:
        config = await load_llm_config_for_profile(db, profile_id)
        config["timeout"] = str(await get_config_int(db, "llm_generation_timeout"))
        resolved_id = config["profile_id"]
        return resolved_id, hashlib.md5(json.dumps(config, sort_keys=True).encode()).hexdigest()

    async def _json_mode_for_analyze(self, client: ConfigurableLlmClient, profile_id: str | None) -> bool:
        """Batch analysis always needs JSON; Ollama uses ``format: json`` even when OpenAI mode is off."""
        if client.provider == "ollama":
            return True
        config = await load_llm_config_for_profile(self._db, profile_id)
        return is_openai_json_mode_enabled(config.get("json_mode") or "disabled")

    async def _ensure_client(self, profile_id: str | None) -> ConfigurableLlmClient:
        """Create/reload the client for a profile id (None → first complete profile)."""
        async with self._client_lock:
            resolved_id, new_hash = await self._config_hash_for_profile(self._db, profile_id)
            existing = self._clients.get(resolved_id)
            if existing is not None and self._config_hashes.get(resolved_id) == new_hash:
                self._last_profile_id = resolved_id
                return existing
            try:
                new_client = await ConfigurableLlmClient.from_profile(self._db, resolved_id)
            except Exception as exc:  # noqa: BLE001 — keep last working client
                if existing is not None:
                    logger.warning(
                        "Failed to reload LLM client for profile %s, retaining previous: %s",
                        resolved_id,
                        exc,
                    )
                    self._last_profile_id = resolved_id
                    return existing
                raise
            if existing is not None:
                await existing.close()
            self._clients[resolved_id] = new_client
            self._config_hashes[resolved_id] = new_hash
            self._last_profile_id = resolved_id
            return new_client
