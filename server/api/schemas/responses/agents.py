"""NDJSON line models for ``POST /api/v1/agent/chat/stream``.

The route yields plain dicts (same as SSE publish sites). These models are the
OpenAPI / contract SoT — injected as components by ``server/api/openapi_ext.py``
and guarded by ``server/tests/test_contract_agent.py``.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from server.api.schemas.responses.tasks import AgentToolCallSummary, TaskDraftPayload

#: Mirrors the five ``type`` values emitted by ``runtime_tool_round`` /
#: ``agent_stream_*_event``. Drift-tested in ``test_contract_agent.py``.
AgentStreamEventType = Literal["llm_start", "tool_start", "tool_done", "final", "error"]


class AgentStreamLlmStartEvent(BaseModel):
    """``llm_start`` — a new non-streaming LLM round is about to run."""

    model_config = ConfigDict(extra="forbid")

    type: Literal["llm_start"]
    round: int


class AgentStreamToolStartEvent(BaseModel):
    """``tool_start`` — a tool is about to execute."""

    model_config = ConfigDict(extra="forbid")

    type: Literal["tool_start"]
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)


class AgentStreamToolDoneEvent(BaseModel):
    """``tool_done`` — a tool finished (``resultSummary`` is the UI one-liner)."""

    model_config = ConfigDict(extra="forbid")

    type: Literal["tool_done"]
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    resultSummary: str


class AgentStreamFinalEvent(BaseModel):
    """``final`` — same fields as ``AgentChatResponse``, with ``type`` required.

    ``error`` is only present when ``final_event(..., error=...)`` is used;
    the success path omits it. In-band failures after the 200 is committed use
    ``AgentStreamErrorEvent`` instead.
    """

    model_config = ConfigDict(extra="forbid")

    type: Literal["final"]
    message: str
    sessionId: str | None = None
    toolCalls: list[AgentToolCallSummary] = Field(default_factory=list)
    error: str | None = None
    taskConfig: TaskDraftPayload | None = None


class AgentStreamErrorEvent(BaseModel):
    """In-band ``error`` line (status already committed). See ``agent_errors``."""

    model_config = ConfigDict(extra="forbid")

    type: Literal["error"]
    message: str
    sessionId: str | None = None
    toolCalls: list[AgentToolCallSummary] = Field(default_factory=list)
    error: str


AgentStreamEvent = (
    AgentStreamLlmStartEvent
    | AgentStreamToolStartEvent
    | AgentStreamToolDoneEvent
    | AgentStreamFinalEvent
    | AgentStreamErrorEvent
)
