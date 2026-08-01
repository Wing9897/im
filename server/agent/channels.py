"""Agent channel policies: shared runtime, different prompt / history rules."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from server.prompts.assistant import A2A_AGENT_SYSTEM_PROMPT, AGENT_SYSTEM_PROMPT
from server.prompts.project import PROJECT_AGENT_SYSTEM_PROMPT

AgentChannelId = Literal["assistant", "a2a", "project"]


@dataclass(frozen=True)
class AgentChannel:
    """Pluggable channel on top of ``AgentRuntime`` (LLM + tools)."""

    id: AgentChannelId
    system_prompt: str
    #: When True: no server-side session / sticky clock; response has no sessionId.
    #: Callers may still pass ``messages`` for that request (third-party-held history).
    stateless: bool
    #: ``user_events.origin`` for ``calendar.create_event``.
    user_event_origin: str


ASSISTANT_CHANNEL = AgentChannel(
    id="assistant",
    system_prompt=AGENT_SYSTEM_PROMPT,
    stateless=False,
    user_event_origin="assistant",
)

A2A_CHANNEL = AgentChannel(
    id="a2a",
    system_prompt=A2A_AGENT_SYSTEM_PROMPT,
    stateless=True,
    user_event_origin="a2a",
)

PROJECT_CHANNEL = AgentChannel(
    id="project",
    system_prompt=PROJECT_AGENT_SYSTEM_PROMPT,
    # Sticky clock + caller-held multi-wave history within one schedule fire.
    # Tick does not persist a UI session across fires.
    stateless=False,
    user_event_origin="project",
)


def get_agent_channel(channel_id: AgentChannelId | str | None) -> AgentChannel:
    if channel_id == "a2a":
        return A2A_CHANNEL
    if channel_id == "project":
        return PROJECT_CHANNEL
    return ASSISTANT_CHANNEL
