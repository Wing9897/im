"""Short scheduled tick for ``analysis_mode=web_intel``.

Pipeline (per fire):
- OpenAI / Gemini official (auto native route): one LLM call with hosted search
  + structured JSON (falls back to tool search → JSON if native fails).
- Ollama / OpenRouter / compatible / forced DDG|Brave: two-step —
  existing web_search routing → LLM JSON.
Writes findings via the shared ``analysis_events`` store (same as event mode).
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from server.agent.web_search_routing import resolve_web_search_route
from server.analyzer.llm_client import ConfigurableLlmClient, load_llm_config
from server.analyzer.llm_json import normalize_items, parse_json_response
from server.config import get_config, get_config_bool, get_config_int
from server.db.database import Database
from server.domain.analysis_modes import WEB_INTEL_MODE
from server.prompts.web_intel import (
    build_web_intel_native_user_prompt,
    build_web_intel_system_prompt,
    build_web_intel_tool_user_prompt,
    format_search_results_for_prompt,
)
from server.scheduler.batch_claim import load_task
from server.scheduler.result_store import store_results
from server.sse import Broadcaster
from server.util import new_id, utc_now_iso
from server.web_search import search_web

logger = logging.getLogger(__name__)

_SEARCH_RESULT_CAP = 8
_SKIP_EMPTY_QUERY = "skipped: empty web_search_query"
_SKIP_EMPTY_PROMPT = "skipped: empty prompt_template"


async def _record_web_intel_skip(
    *,
    db: Database,
    broadcaster: Broadcaster,
    task: dict[str, Any],
    task_id: str,
    reason: str,
) -> None:
    """Persist a completed skip batch + SSE so empty fires are observable."""
    batch_id = new_id()
    now = utc_now_iso()
    version = int(task.get("version") or 1)
    await db.execute(
        "INSERT INTO analysis_batches "
        "(id, task_id, version, status, message_count, agent_message, "
        "created_at, updated_at, completed_at) "
        "VALUES (?, ?, ?, 'completed', 0, ?, ?, ?, ?)",
        (batch_id, task_id, version, reason, now, now, now),
    )
    logger.info("web_intel tick skipped task=%s batch=%s: %s", task_id, batch_id, reason)
    broadcaster.publish(
        "analysis_completed",
        {
            "taskId": task_id,
            "batchId": batch_id,
            "analysisMode": WEB_INTEL_MODE,
            "findingsCount": 0,
            "hasFindings": False,
            "skipped": True,
            "skipReason": reason,
        },
    )


async def execute_web_intel_tick(
    *,
    db: Database,
    broadcaster: Broadcaster,
    task_id: str,
    analysis_paused: bool | None = None,
) -> None:
    """Run one web-intel schedule fire (no local message claim)."""
    if analysis_paused is None:
        analysis_paused = await get_config_bool(db, "analysis_paused")
    if analysis_paused:
        return

    task = await load_task(db, task_id)
    if task is None or not task.get("is_active"):
        return
    if str(task.get("analysis_mode") or "") != WEB_INTEL_MODE:
        return

    search_query = str(task.get("web_search_query") or "").strip()
    prompt_template = str(task.get("prompt_template") or "").strip()
    task_name = str(task.get("name") or "")
    version = int(task.get("version") or 1)

    if not search_query:
        await _record_web_intel_skip(
            db=db,
            broadcaster=broadcaster,
            task=task,
            task_id=task_id,
            reason=_SKIP_EMPTY_QUERY,
        )
        return
    if not prompt_template:
        await _record_web_intel_skip(
            db=db,
            broadcaster=broadcaster,
            task=task,
            task_id=task_id,
            reason=_SKIP_EMPTY_PROMPT,
        )
        return

    batch_id = new_id()
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO analysis_batches "
        "(id, task_id, version, status, message_count, created_at, updated_at) "
        "VALUES (?, ?, ?, 'processing', 0, ?, ?)",
        (batch_id, task_id, version, now, now),
    )

    llm_cfg = await load_llm_config(db)
    route = resolve_web_search_route(
        web_search_enabled=await get_config_bool(db, "assistant_web_search_enabled"),
        web_search_provider=await get_config(db, "web_search_provider"),
        llm_provider=llm_cfg["provider"],
        llm_base_url=llm_cfg["base_url"],
    )

    broadcaster.publish(
        "analysis_started",
        {
            "taskId": task_id,
            "taskName": task_name,
            "batchId": batch_id,
            "messageCount": 0,
            "estimatedTokens": 0,
            "llmProvider": llm_cfg["provider"],
            "llmModel": llm_cfg["model"],
            "webSearchMode": route.mode,
        },
    )

    llm_timeout = await get_config_int(db, "llm_generation_timeout")
    ui_locale = await get_config(db, "ui_locale")
    client: ConfigurableLlmClient | None = None
    try:
        client = await ConfigurableLlmClient.from_db(db)
        items, prompt_tokens, completion_tokens, used_mode = await asyncio.wait_for(
            _run_web_intel_pipeline(
                db=db,
                client=client,
                route_mode=route.mode,
                native_kind=route.native_web_search,
                tool_provider=route.tool_provider,
                search_query=search_query,
                prompt_template=prompt_template,
                ui_locale=ui_locale,
                web_search_enabled=route.enabled,
            ),
            timeout=llm_timeout * 2,
        )
    except Exception as exc:  # noqa: BLE001 — complete batch as error; next fire retries
        logger.exception("web_intel tick failed task=%s batch=%s", task_id, batch_id)
        err_now = utc_now_iso()
        await db.execute(
            "UPDATE analysis_batches SET status = 'completed', error_message = ?, "
            "updated_at = ?, completed_at = ? WHERE id = ?",
            (str(exc)[:2000], err_now, err_now, batch_id),
        )
        broadcaster.publish(
            "analysis_failed",
            {"taskId": task_id, "batchId": batch_id, "error": str(exc)[:500]},
        )
        return
    finally:
        if client is not None:
            await client.close()

    needs_geocode = [
        item
        for item in items
        if isinstance(item, dict) and item.get("latitude") is None and item.get("longitude") is None
    ]
    if needs_geocode:
        from server.analyzer.geocoding import geocode_analysis_items

        for item in items:
            if isinstance(item, dict):
                item.setdefault("latitude", None)
                item.setdefault("longitude", None)
        try:
            items = await geocode_analysis_items(items)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Geocoding skipped for web_intel batch %s: %s", batch_id, exc)

    done = utc_now_iso()
    async with db.transaction() as conn:
        findings_count = await store_results(
            conn,
            task=task,
            batch_id=batch_id,
            items=items,
            channel_names=[],
        )
        await conn.execute(
            "UPDATE analysis_batches SET status = 'completed', prompt_tokens = ?, "
            "completion_tokens = ?, error_message = NULL, message_count = ?, "
            "updated_at = ?, completed_at = ? WHERE id = ?",
            (prompt_tokens, completion_tokens, 0, done, done, batch_id),
        )

    broadcaster.publish(
        "analysis_completed",
        {
            "taskId": task_id,
            "batchId": batch_id,
            "analysisMode": WEB_INTEL_MODE,
            "findingsCount": findings_count,
            "hasFindings": findings_count > 0,
            "webSearchMode": used_mode,
        },
    )


async def _run_web_intel_pipeline(
    *,
    db: Database,
    client: ConfigurableLlmClient,
    route_mode: str,
    native_kind: str | None,
    tool_provider: str,
    search_query: str,
    prompt_template: str,
    ui_locale: str | None,
    web_search_enabled: bool,
) -> tuple[list[dict[str, Any]], int, int, str]:
    system = build_web_intel_system_prompt(ui_locale=ui_locale)

    if web_search_enabled and native_kind in {"openai", "gemini"}:
        try:
            items, pt, ct = await _native_one_step(
                client,
                system=system,
                search_query=search_query,
                prompt_template=prompt_template,
                native_kind=native_kind,
            )
            return items, pt, ct, f"{native_kind}_native"
        except Exception as exc:  # noqa: BLE001 — fall back to tool search
            logger.warning(
                "web_intel native search failed (%s); falling back to tool path: %s",
                native_kind,
                exc,
            )

    if not web_search_enabled:
        raise RuntimeError("assistant web search is disabled")

    items, pt, ct = await _tool_two_step(
        db,
        client,
        system=system,
        search_query=search_query,
        prompt_template=prompt_template,
        tool_provider=tool_provider,
    )
    return items, pt, ct, f"tool:{tool_provider}"


async def _native_one_step(
    client: ConfigurableLlmClient,
    *,
    system: str,
    search_query: str,
    prompt_template: str,
    native_kind: str,
) -> tuple[list[dict[str, Any]], int, int]:
    user = build_web_intel_native_user_prompt(
        search_query=search_query,
        prompt_template=prompt_template,
    )
    result = await client.complete(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        json_mode=True,
        temperature=0.2,
        native_web_search=native_kind,
    )
    parsed = parse_json_response(result["text"])
    return (
        [item for item in normalize_items(parsed) if isinstance(item, dict)],
        int(result.get("prompt_tokens") or 0),
        int(result.get("completion_tokens") or 0),
    )


async def _tool_two_step(
    db: Database,
    client: ConfigurableLlmClient,
    *,
    system: str,
    search_query: str,
    prompt_template: str,
    tool_provider: str,
) -> tuple[list[dict[str, Any]], int, int]:
    brave_key = await get_config(db, "brave_search_api_key")
    search = await search_web(
        search_query,
        provider=tool_provider,
        api_key=brave_key,
        count=_SEARCH_RESULT_CAP,
    )
    if search.get("error") and not search.get("items"):
        raise RuntimeError(str(search["error"]))

    results_text = format_search_results_for_prompt(list(search.get("items") or []))
    user = build_web_intel_tool_user_prompt(
        search_query=search_query,
        prompt_template=prompt_template,
        search_results_text=results_text,
    )
    result = await client.complete(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        json_mode=True,
        temperature=0.2,
    )
    parsed = parse_json_response(result["text"])
    return (
        [item for item in normalize_items(parsed) if isinstance(item, dict)],
        int(result.get("prompt_tokens") or 0),
        int(result.get("completion_tokens") or 0),
    )
