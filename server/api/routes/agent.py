"""Agent chat endpoint: natural-language calendar Q&A via tool-calling runtime."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, AsyncIterator, Literal, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from starlette.responses import StreamingResponse

from server.agent.runtime import AgentRuntime
from server.agent.timeouts import agent_wall_timeout_seconds
from server.analyzer.llm_client import ConfigurableLlmClient
from server.api.deps import API_DEPS, get_db
from server.api.schemas.responses import AgentChatResponse, TaskDraftPayload
from server.config import get_config_int

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/agent", tags=["agent"], dependencies=API_DEPS)

_UNREACHABLE_MARKERS = (
    "cannot connect",
    "connection refused",
    "connect call failed",
    "name or service not known",
    "nodename nor servname",
    "failed to establish a new connection",
    "server disconnected",
    "clientconnectorerror",
    "客户端连接",
    "遠端電腦拒絕",
    "远程计算机拒绝",
)


class AgentChatBody(BaseModel):
    messages: list[dict[str, Any]] = Field(default_factory=list)
    sessionId: Optional[str] = None
    #: Optional UI locale (`zh-Hant` | `zh-Hans` | `en`); falls back to server ``ui_locale``.
    locale: Optional[str] = None
    #: Default target workset for calendar.create_event when the tool omits worksetId.
    #: ``__user__`` / empty / omit → builtin system workset.
    worksetId: Optional[str] = None
    #: Page gate: only ``task_editor`` enables ``tasks.consult_advisor``.
    surface: Optional[Literal["task_editor"]] = None
    #: Live task form draft for the advisor (same shape as chat-assistant).
    currentTask: Optional[TaskDraftPayload] = None


def _agent_error_payload(exc: BaseException, *, session_id: Optional[str]) -> dict[str, Any]:
    detail = str(exc).strip() or exc.__class__.__name__
    lowered = f"{detail} {exc.__class__.__name__}".lower()
    unreachable = any(marker in lowered for marker in _UNREACHABLE_MARKERS)
    error_code = "ai_engine_unreachable" if unreachable else detail
    message = (
        "AI 引擎目前無法完成助手請求（設定頁「AI 測試」成功仍可能失敗："
        "助手需要較長對話與 JSON 工具協議）。"
        f" 詳情：{detail}"
    )
    return {
        "message": message,
        "sessionId": session_id,
        "toolCalls": [],
        "error": error_code,
    }


@router.post("/chat", response_model=AgentChatResponse)
async def agent_chat(request: Request, body: AgentChatBody) -> AgentChatResponse:
    db = get_db(request)
    llm: ConfigurableLlmClient | None = None
    try:
        llm = await ConfigurableLlmClient.from_db_for_agent(db)
        runtime = AgentRuntime(db, llm, broadcaster=request.app.state.broadcaster)
        per_call = await get_config_int(db, "llm_generation_timeout")
        wall = agent_wall_timeout_seconds(per_call)
        result = await asyncio.wait_for(
            runtime.chat(
                body.messages,
                session_id=body.sessionId,
                locale=body.locale,
                workset_id=body.worksetId,
                surface=body.surface,
                current_task=body.currentTask.model_dump(exclude_none=True) if body.currentTask is not None else None,
            ),
            timeout=wall,
        )
        return AgentChatResponse.model_validate(result)
    except asyncio.TimeoutError:
        logger.warning("Agent chat wall-clock timeout (session=%s)", body.sessionId)
        return AgentChatResponse(
            message="Agent request timed out",
            sessionId=body.sessionId,
            toolCalls=[],
            error="agent_timeout",
        )
    except Exception as exc:  # noqa: BLE001 — chat must degrade gracefully
        logger.warning("Agent chat failed: %s", exc)
        return AgentChatResponse.model_validate(_agent_error_payload(exc, session_id=body.sessionId))
    finally:
        if llm is not None:
            await llm.close()


@router.post("/chat/stream")
async def agent_chat_stream(request: Request, body: AgentChatBody) -> StreamingResponse:
    """Stream agent progress as NDJSON (tool steps + final answer).

    Each line is one JSON object with a ``type`` field:
    ``llm_start`` | ``tool_start`` | ``tool_done`` | ``final`` | ``error``.
    LLM providers stay non-streaming; only tool execution progress is streamed.
    """
    db = get_db(request)

    async def event_generator() -> AsyncIterator[bytes]:
        llm: ConfigurableLlmClient | None = None
        try:
            llm = await ConfigurableLlmClient.from_db_for_agent(db)
            runtime = AgentRuntime(db, llm, broadcaster=request.app.state.broadcaster)
            per_call = await get_config_int(db, "llm_generation_timeout")
            wall = agent_wall_timeout_seconds(per_call)

            try:
                async with asyncio.timeout(wall):
                    async for event in runtime.iter_chat_events(
                        body.messages,
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
                payload = {
                    "type": "error",
                    "message": "Agent request timed out",
                    "sessionId": body.sessionId,
                    "toolCalls": [],
                    "error": "agent_timeout",
                }
                yield (json.dumps(payload, ensure_ascii=False) + "\n").encode("utf-8")
        except Exception as exc:  # noqa: BLE001 — stream must degrade gracefully
            logger.warning("Agent chat stream failed: %s", exc)
            payload = {"type": "error", **_agent_error_payload(exc, session_id=body.sessionId)}
            yield (json.dumps(payload, ensure_ascii=False) + "\n").encode("utf-8")
        finally:
            if llm is not None:
                await llm.close()

    return StreamingResponse(
        event_generator(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff"},
    )
