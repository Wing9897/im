"""A2A LLM agent: natural-language in, single-shot result out (internal tool loop)."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from server.a2a_audit import write_a2a_audit
from server.access_keys import A2A_AGENT_SCOPE
from server.agent.runtime import AgentRuntime
from server.agent.timeouts import agent_wall_timeout_seconds
from server.analyzer.llm_client import ConfigurableLlmClient
from server.api.a2a_auth import require_a2a_agent
from server.api.deps import get_db
from server.api.schemas.responses import AgentChatResponse
from server.config import get_config_int

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/a2a",
    tags=["a2a"],
    dependencies=[Depends(require_a2a_agent)],
)


class A2aAgentBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    #: Natural-language task (preferred for OpenClaw / Hermes-style callers).
    input: str = Field(default="", max_length=8000)
    #: Optional prior turns **held by the caller** for this request only.
    #: This API does not store or resume sessions.
    messages: list[dict[str, Any]] = Field(default_factory=list)
    locale: Optional[str] = None


def _key_id(request: Request) -> str:
    return str(getattr(request.state, "access_key_id", None) or "")


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
        "Requires access key with `a2a:agent` or `*`."
    ),
)
async def a2a_agent(request: Request, body: A2aAgentBody) -> AgentChatResponse:
    db = get_db(request)
    messages = _messages_from_body(body)
    capability = A2A_AGENT_SCOPE
    llm: ConfigurableLlmClient | None = None
    try:
        llm = await ConfigurableLlmClient.from_db_for_agent(db)
        runtime = AgentRuntime(db, llm, broadcaster=request.app.state.broadcaster)
        per_call = await get_config_int(db, "llm_generation_timeout")
        wall = agent_wall_timeout_seconds(per_call)
        result = await asyncio.wait_for(
            runtime.chat(messages, locale=body.locale, channel="a2a"),
            timeout=wall,
        )
        await write_a2a_audit(
            db,
            key_id=_key_id(request),
            capability=capability,
            status="ok" if not result.get("error") else "error",
            detail=str(result.get("error") or "")[:200],
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
        await write_a2a_audit(
            db,
            key_id=_key_id(request),
            capability=capability,
            status="error",
            detail="agent_timeout",
        )
        return AgentChatResponse(
            message="Agent request timed out",
            sessionId=None,
            toolCalls=[],
            error="agent_timeout",
        )
    except Exception as exc:  # noqa: BLE001 — agent must degrade gracefully
        logger.warning("A2A agent failed: %s", exc)
        detail = str(exc).strip() or exc.__class__.__name__
        await write_a2a_audit(
            db,
            key_id=_key_id(request),
            capability=capability,
            status="error",
            detail=detail[:200],
        )
        return AgentChatResponse(
            message=f"A2A agent failed: {detail}",
            sessionId=None,
            toolCalls=[],
            error=detail,
        )
    finally:
        if llm is not None:
            await llm.close()
