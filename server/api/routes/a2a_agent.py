"""A2A LLM agent: natural-language in, single-shot result out (internal tool loop)."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request

from server.agent.runtime import AgentRuntime
from server.agent.timeouts import agent_wall_timeout_seconds
from server.analyzer.llm_client import ConfigurableLlmClient
from server.api.a2a_auth import require_full_access_key
from server.api.agent_errors import agent_http_error, agent_timeout_http_error
from server.api.deps import get_db
from server.api.schemas.requests import A2aAgentBody
from server.api.schemas.responses import AgentChatResponse
from server.config import get_config_int
from server.errors import VALIDATION_ERROR, http_error

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/a2a",
    tags=["a2a"],
    dependencies=[Depends(require_full_access_key)],
)


def _messages_from_body(body: A2aAgentBody) -> list[dict[str, Any]]:
    """Flatten the typed body into the plain-dict turns the runtime consumes."""
    text = (body.input or "").strip()
    messages: list[dict[str, Any]] = [message.model_dump() for message in body.messages]
    if text:
        messages.append({"role": "user", "content": text})
    return messages


@router.post(
    "/agent",
    response_model=AgentChatResponse,
    description=(
        "A2A natural-language agent (客户经理). Uses the dedicated liaison LLM "
        "global slot (separate from the assistant slot); same tool surface as the "
        "assistant with a different system prompt. Server runs an internal tool "
        "loop; response is a single shot: final `message` + `toolCalls` summary. "
        'No session storage. Requires a full household access key (`["*"]`). '
        "Failures are real HTTP errors: 422 empty input, 400/404 liaison slot "
        "misconfigured, 503 `ai_engine_unreachable`, 502 `ai_engine_failed`, "
        "504 `agent_timeout`."
    ),
)
async def a2a_agent(request: Request, body: A2aAgentBody) -> AgentChatResponse:
    db = get_db(request)
    messages = _messages_from_body(body)
    if not any(str(m.get("role") or "") == "user" for m in messages):
        raise http_error(
            422,
            "Provide `input` text or at least one message with role `user`",
            error_code=VALIDATION_ERROR,
        )
    llm: ConfigurableLlmClient | None = None
    try:
        llm = await ConfigurableLlmClient.from_liaison_slot(db)
        runtime = AgentRuntime(db, llm, broadcaster=request.app.state.broadcaster)
        per_call = await get_config_int(db, "llm_generation_timeout")
        wall = agent_wall_timeout_seconds(per_call)
        result = await asyncio.wait_for(
            runtime.chat(messages, locale=body.locale, channel="a2a"),
            timeout=wall,
        )
        return AgentChatResponse.model_validate(
            {
                "message": result.get("message") or "",
                "sessionId": None,
                "toolCalls": result.get("toolCalls") or [],
            }
        )
    except TimeoutError as exc:
        logger.warning("A2A agent wall-clock timeout")
        raise agent_timeout_http_error() from exc
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 — classified into 502 / 503
        logger.warning("A2A agent failed: %s", exc)
        raise agent_http_error(exc) from exc
    finally:
        if llm is not None:
            await llm.close()
