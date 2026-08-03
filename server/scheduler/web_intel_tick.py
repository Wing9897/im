"""Short scheduled tick for ``analysis_mode=web_intel``.

Pipeline (per fire):
- OpenAI / Gemini official (auto native route): one LLM call with hosted search
  + structured JSON (falls back to tool search → JSON if native fails).
- Ollama / OpenRouter / compatible / forced DDG|Brave: two-step —
  existing web_search routing → LLM JSON.
Writes findings via the shared ``analysis_events`` store (same as event mode).

Failure semantics (intentional vs message-batch):
- Keep ``completed`` + ``error_message`` (not ``pending`` / marker retry).
- One in-fire retry on transient extract failures.
- Log via ``write_batch_failure_log``; SSE includes ``analysisMode`` / ``retrying``.
- Consecutive failed fires reaching ``max_batch_retries`` set ``is_active=false``
  (task-local fuse; not global analysis pause). Successful fires clear the streak.
"""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING, Any

from server.agent.web_search_routing import resolve_web_search_route
from server.analyzer.llm_client import ConfigurableLlmClient, load_llm_config
from server.app_logging import failure_details_from_exc, write_batch_failure_log
from server.config import get_config, get_config_bool, get_config_int
from server.db.database import Database
from server.domain.analysis_modes import WEB_INTEL_MODE
from server.queries.tasks_queries import set_task_active
from server.scheduler.batch_claim import load_task
from server.scheduler.result_store import store_results
from server.sse import Broadcaster
from server.util import new_id, utc_now_iso
from server.web_search.execution import WEB_INTEL_SEARCH_COUNT, WebSearchExecutionService

if TYPE_CHECKING:
    from server.scheduler.manager import SchedulerManager

logger = logging.getLogger(__name__)

_SKIP_EMPTY_QUERY = "skipped: empty web_search_query"
_SKIP_EMPTY_PROMPT = "skipped: empty prompt_template"
#: One immediate re-run inside the same schedule fire after a transient extract error.
_IN_FIRE_RETRIES = 1


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


async def _count_consecutive_failures(db: Database, *, task_id: str, version: int) -> int:
    """Count trailing completed batches with ``error_message`` (skips break the streak)."""
    rows = await db.fetch_all(
        "SELECT error_message, agent_message FROM analysis_batches "
        "WHERE task_id = ? AND version = ? AND status = 'completed' "
        # rowid is insertion-monotonic; UUID id order is not reliable within the same second.
        "ORDER BY COALESCE(completed_at, updated_at) DESC, rowid DESC "
        "LIMIT 50",
        (task_id, version),
    )
    count = 0
    for row in rows:
        agent = str(row.get("agent_message") or "")
        if agent.startswith("skipped:"):
            break
        if row.get("error_message"):
            count += 1
        else:
            break
    return count


async def _extract_with_in_fire_retry(
    *,
    service: WebSearchExecutionService,
    client: ConfigurableLlmClient,
    route: Any,
    search_query: str,
    prompt_template: str,
    ui_locale: str,
    llm_timeout: int,
) -> tuple[list[Any], int, int, str]:
    """Run extract; retry once on failure within the same fire."""
    last_exc: BaseException | None = None
    for attempt in range(_IN_FIRE_RETRIES + 1):
        try:
            return await asyncio.wait_for(
                service.extract_web_intel_items(
                    client,
                    route=route,
                    search_query=search_query,
                    prompt_template=prompt_template,
                    ui_locale=ui_locale,
                    count=WEB_INTEL_SEARCH_COUNT,
                ),
                timeout=llm_timeout * 2,
            )
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 — in-fire retry then complete as error
            last_exc = exc
            if attempt < _IN_FIRE_RETRIES:
                logger.warning(
                    "web_intel extract failed (in-fire retry %d/%d): %s",
                    attempt + 1,
                    _IN_FIRE_RETRIES,
                    exc,
                )
                continue
            raise
    assert last_exc is not None
    raise last_exc


async def _complete_web_intel_failure(
    *,
    db: Database,
    broadcaster: Broadcaster,
    task_id: str,
    task_name: str,
    batch_id: str,
    version: int,
    error_message: str,
    scheduler: SchedulerManager | None,
    failure_details: dict[str, Any] | None = None,
) -> None:
    """Mark batch completed+error, log, SSE, and optionally fuse the task."""
    err_now = utc_now_iso()
    await db.execute(
        "UPDATE analysis_batches SET status = 'completed', error_message = ?, "
        "updated_at = ?, completed_at = ? WHERE id = ?",
        (error_message[:2000], err_now, err_now, batch_id),
    )

    max_retries = await get_config_int(db, "max_batch_retries")
    consecutive = await _count_consecutive_failures(db, task_id=task_id, version=version)
    retries_exhausted = consecutive >= max_retries
    ui_locale = await get_config(db, "ui_locale")

    await write_batch_failure_log(
        db,
        task_id=task_id,
        task_name=task_name,
        batch_id=batch_id,
        error_message=error_message,
        retries_exhausted=retries_exhausted,
        current_retry=consecutive,
        max_retries=max_retries,
        ui_locale=ui_locale,
        failure_details=failure_details,
    )

    if retries_exhausted:
        await set_task_active(db, task_id, 0, err_now)
        if scheduler is not None:
            await scheduler.unregister_task(task_id)
        logger.warning(
            "web_intel task %s deactivated after %d consecutive failure(s) (max_batch_retries=%d)",
            task_id,
            consecutive,
            max_retries,
        )

    broadcaster.publish(
        "analysis_failed",
        {
            "taskId": task_id,
            "taskName": task_name,
            "batchId": batch_id,
            "error": error_message[:500],
            "analysisMode": WEB_INTEL_MODE,
            # True means wait for the next schedule fire (not message-batch pending).
            "retrying": not retries_exhausted,
            "currentRetry": consecutive,
            "maxRetries": max_retries,
            "retriesExhausted": retries_exhausted,
            "taskDeactivated": retries_exhausted,
        },
    )


async def execute_web_intel_tick(
    *,
    db: Database,
    broadcaster: Broadcaster,
    task_id: str,
    analysis_paused: bool | None = None,
    scheduler: SchedulerManager | None = None,
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
    # Scheduled web_intel always searches; only the provider/native path is shared
    # with assistant settings. The assistant master switch must not pause ticks.
    route = resolve_web_search_route(
        web_search_enabled=True,
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
            "analysisMode": WEB_INTEL_MODE,
        },
    )

    llm_timeout = await get_config_int(db, "llm_generation_timeout")
    ui_locale = await get_config(db, "ui_locale")
    brave_key = await get_config(db, "brave_search_api_key")
    client: ConfigurableLlmClient | None = None
    try:
        client = await ConfigurableLlmClient.from_db(db)
        service = WebSearchExecutionService(brave_api_key=brave_key or "")
        items, prompt_tokens, completion_tokens, used_mode = await _extract_with_in_fire_retry(
            service=service,
            client=client,
            route=route,
            search_query=search_query,
            prompt_template=prompt_template,
            ui_locale=ui_locale,
            llm_timeout=llm_timeout,
        )
    except Exception as exc:  # noqa: BLE001 — complete batch as error; next fire retries
        logger.exception("web_intel tick failed task=%s batch=%s", task_id, batch_id)
        await _complete_web_intel_failure(
            db=db,
            broadcaster=broadcaster,
            task_id=task_id,
            task_name=task_name,
            batch_id=batch_id,
            version=version,
            error_message=str(exc),
            scheduler=scheduler,
            failure_details=failure_details_from_exc(exc),
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

    # Successful tick clears consecutive-failure streak (DB-derived: null error_message).
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
