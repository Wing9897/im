"""Agent chat endpoint: natural-language calendar Q&A via tool-calling runtime."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator

from fastapi import APIRouter, HTTPException, Request
from starlette.responses import StreamingResponse

from server.agent.runtime import AgentRuntime
from server.agent.timeouts import agent_wall_timeout_seconds
from server.analyzer.llm_client import ConfigurableLlmClient
from server.api.agent_errors import (
    agent_http_error,
    agent_stream_error_event,
    agent_stream_timeout_event,
    agent_timeout_http_error,
)
from server.api.deps import API_DEPS, get_db
from server.api.schemas.requests import AgentChatBody
from server.api.schemas.responses import AgentChatResponse
from server.config import get_config_int

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/agent", tags=["agent"], dependencies=API_DEPS)


@router.post("/chat", response_model=AgentChatResponse)
async def agent_chat(request: Request, body: AgentChatBody) -> AgentChatResponse:
    """Run one assistant turn.

    LLM failures are real HTTP errors (504 timeout / 503 unreachable / 502
    other upstream failure); profile problems keep their own 400 / 404.
    """
    db = get_db(request)
    llm: ConfigurableLlmClient | None = None
    try:
        llm = await ConfigurableLlmClient.from_assistant_slot(
            db,
            profile_id=body.llmProfileId,
        )
        runtime = AgentRuntime(db, llm, broadcaster=request.app.state.broadcaster)
        per_call = await get_config_int(db, "llm_generation_timeout")
        wall = agent_wall_timeout_seconds(per_call)
        result = await asyncio.wait_for(
            runtime.chat(
                [message.model_dump() for message in body.messages],
                session_id=body.sessionId,
                locale=body.locale,
                workset_id=body.worksetId,
                surface=body.surface,
                current_task=body.currentTask.model_dump(exclude_none=True) if body.currentTask is not None else None,
            ),
            timeout=wall,
        )
        return AgentChatResponse.model_validate(result)
    except TimeoutError as exc:
        logger.warning("Agent chat wall-clock timeout (session=%s)", body.sessionId)
        raise agent_timeout_http_error() from exc
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 — classified into 502 / 503 below
        logger.warning("Agent chat failed: %s", exc)
        raise agent_http_error(exc) from exc
    finally:
        if llm is not None:
            await llm.close()


@router.post("/chat/stream")
async def agent_chat_stream(request: Request, body: AgentChatBody) -> StreamingResponse:
    """Stream agent progress as NDJSON (tool steps + final answer).

    Each line is one JSON object with a ``type`` field
    (``AgentStreamEvent`` in OpenAPI / ``server/api/schemas/responses/agents.py``):
    ``llm_start`` | ``tool_start`` | ``tool_done`` | ``final`` | ``error``.
    LLM providers stay non-streaming; only tool execution progress is streamed.

    Resolving the profile happens before the response starts, so configuration
    errors are real HTTP errors. Once the 200 is committed, later failures can
    only be reported in band as an ``error`` line.
    """
    db = get_db(request)

    try:
        llm = await ConfigurableLlmClient.from_assistant_slot(
            db,
            profile_id=body.llmProfileId,
        )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 — classified into 502 / 503
        logger.warning("Agent chat stream setup failed: %s", exc)
        raise agent_http_error(exc) from exc

    async def event_generator() -> AsyncIterator[bytes]:
        try:
            runtime = AgentRuntime(db, llm, broadcaster=request.app.state.broadcaster)
            per_call = await get_config_int(db, "llm_generation_timeout")
            wall = agent_wall_timeout_seconds(per_call)

            try:
                async with asyncio.timeout(wall):
                    async for event in runtime.iter_chat_events(
                        [message.model_dump() for message in body.messages],
                        session_id=body.sessionId,
                        locale=body.locale,
                        workset_id=body.worksetId,
                        surface=body.surface,
                        current_task=(
                            body.currentTask.model_dump(exclude_none=True) if body.currentTask is not None else None
                        ),
                    ):
                        yield (json.dumps(event, ensure_ascii=False) + "\n").encode("utf-8")
            except TimeoutError:
                logger.warning("Agent chat stream wall-clock timeout (session=%s)", body.sessionId)
                payload = agent_stream_timeout_event(session_id=body.sessionId)
                yield (json.dumps(payload, ensure_ascii=False) + "\n").encode("utf-8")
        except Exception as exc:  # noqa: BLE001 — status is committed; report in band
            logger.warning("Agent chat stream failed: %s", exc)
            payload = agent_stream_error_event(exc, session_id=body.sessionId)
            yield (json.dumps(payload, ensure_ascii=False) + "\n").encode("utf-8")
        finally:
            await llm.close()

    return StreamingResponse(
        event_generator(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff"},
    )
