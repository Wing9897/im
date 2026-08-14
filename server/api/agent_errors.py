"""Map agent / LLM runtime failures onto real HTTP error responses.

Shared by the assistant chat routes and the A2A channel so both report the
same status codes and vocabulary:

======================================  ======  ==========================
failure                                 status  ``error_code``
======================================  ======  ==========================
wall-clock timeout                      504     ``agent_timeout``
provider host refused / unresolvable    503     ``ai_engine_unreachable``
any other upstream LLM failure          502     ``ai_engine_failed``
======================================  ======  ==========================

Profile / slot configuration problems already raise their own ``HTTPException``
(400 / 404) inside ``server.analyzer.llm_config`` and must pass through
untouched; malformed request bodies stay on FastAPI's 422.

Codes are lowercase and scenario-specific, matching the weather routes, so
``web/src/i18n/errorCodes.ts`` can localize them.
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from server.errors import http_error

AGENT_TIMEOUT = "agent_timeout"
AI_ENGINE_UNREACHABLE = "ai_engine_unreachable"
AI_ENGINE_FAILED = "ai_engine_failed"

#: Substrings that identify "the provider host never answered" across the
#: aiohttp / OS error vocabulary of the three supported provider families.
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

_AGENT_HINT = "AI 引擎目前無法完成助手請求（設定頁「AI 測試」成功仍可能失敗：助手需要較長對話與 JSON 工具協議）。"


def _detail(exc: BaseException) -> str:
    return str(exc).strip() or exc.__class__.__name__


def is_unreachable(exc: BaseException) -> bool:
    """True when the failure means the provider host could not be reached."""
    lowered = f"{_detail(exc)} {exc.__class__.__name__}".lower()
    return any(marker in lowered for marker in _UNREACHABLE_MARKERS)


def agent_error_code(exc: BaseException) -> str:
    return AI_ENGINE_UNREACHABLE if is_unreachable(exc) else AI_ENGINE_FAILED


def agent_error_message(exc: BaseException) -> str:
    return f"{_AGENT_HINT} 詳情：{_detail(exc)}"


def agent_timeout_http_error() -> HTTPException:
    """504 for the agent wall-clock timeout."""
    return http_error(504, "Agent request timed out", error_code=AGENT_TIMEOUT)


def agent_http_error(exc: BaseException) -> HTTPException:
    """502 / 503 for an upstream LLM failure, carrying the provider detail."""
    return http_error(
        503 if is_unreachable(exc) else 502,
        agent_error_message(exc),
        error_code=agent_error_code(exc),
        details={"detail": _detail(exc)},
    )


def agent_stream_error_event(exc: BaseException, *, session_id: str | None) -> dict[str, Any]:
    """NDJSON ``error`` line for failures raised after streaming has begun.

    The response status is already committed at that point, so the stream keeps
    its in-band error contract; the same ``error`` codes are used.
    """
    return {
        "type": "error",
        "message": agent_error_message(exc),
        "sessionId": session_id,
        "toolCalls": [],
        "error": agent_error_code(exc),
    }


def agent_stream_timeout_event(*, session_id: str | None) -> dict[str, Any]:
    return {
        "type": "error",
        "message": "Agent request timed out",
        "sessionId": session_id,
        "toolCalls": [],
        "error": AGENT_TIMEOUT,
    }
