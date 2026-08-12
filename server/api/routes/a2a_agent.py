"""A2A LLM agent: natural-language in, single-shot result out (internal tool loop)."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, Depends, Request

from server.agent.runtime import AgentRuntime
from server.agent.timeouts import agent_wall_timeout_seconds
from server.analyzer.llm_client import ConfigurableLlmClient
from server.api.a2a_auth import require_full_access_key
from server.api.deps import get_db
from server.api.schemas.requests import A2aAgentBody
from server.api.schemas.responses import AgentChatResponse
from server.config import get_config_int

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/a2a",
    tags=["a2a"],
    dependencies=[Depends(require_full_access_key)],
)


def _messages_from_body(body: A2aAgentBody) -> list[dict[str, Any]]:
    text = (body.input or "").strip()
    prior = list(body.messages or [])
    if text:
        return [*prior, {"role": "user", "content": text}]
    return prior


@router.post(
    "/agent",
    response_model=AgentChatResponse,
    description=(
        "A2A natural-language agent (客户经理). Same LLM + tools as the assistant; "
        "different system prompt. Server runs an internal tool loop; response is a "
        "single shot: final `message` + `toolCalls` summary. No session storage. "
        'Requires a full household access key (`["*"]`).'
    ),
)
async def a2a_agent(request: Request, body: A2aAgentBody) -> AgentChatResponse:
    db = get_db(request)
    messages = _messages_from_body(body)
    llm: ConfigurableLlmClient | None = None
    try:
        llm = await ConfigurableLlmClient.from_assistant_staff(db)
        runtime = AgentRuntime(db, llm, broadcaster=request.app.state.broadcaster)
        per_call = await get_config_int(db, "llm_generation_timeout")
        wall = agent_wall_timeout_seconds(per_call)
        result = await asyncio.wait_for(
            runtime.chat(messages, locale=body.locale, channel="a2a"),
            timeout=wall,
        )
        payload = {
            "message": result.get("message") or "",
            "sessionId": None,
            "toolCalls": result.get("toolCalls") or [],
            "error": result.get("error"),
        }
        return AgentChatResponse.model_validate(payload)
    except asyncio.TimeoutError:
        logger.warning("A2A agent wall-clock timeout")
        return AgentChatResponse(
            message="Agent request timed out",
            sessionId=None,
            toolCalls=[],
            error="agent_timeout",
        )
    except Exception as exc:  # noqa: BLE001 — agent must degrade gracefully
        logger.warning("A2A agent failed: %s", exc)
        detail = str(exc).strip() or exc.__class__.__name__
        return AgentChatResponse(
            message=f"A2A agent failed: {detail}",
            sessionId=None,
            toolCalls=[],
            error=detail,
        )
    finally:
        if llm is not None:
            await llm.close()
