"""Agent channel policies: shared runtime, different prompt / history rules."""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Literal

from server.domain.agent_task_spec import AgentTaskSpec
from server.prompts.agent_task import AGENT_TASK_SYSTEM_PROMPT_BASE
from server.prompts.assistant import A2A_AGENT_SYSTEM_PROMPT, AGENT_SYSTEM_PROMPT

AgentChannelId = Literal["assistant", "a2a", "agent"]


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
    #: When True, scheduled ticks always enable search (ignore assistant master switch).
    force_web_search: bool = False
    #: When False, calendar write tools are omitted from schemas and blocked at dispatch.
    calendar_writes_enabled: bool = True
    #: When False, calendar read tools are omitted / blocked.
    calendar_read_enabled: bool = True
    #: When False, ``web.search`` tool is omitted unless force_web_search is set.
    web_search_enabled: bool = True
    #: When False, ``intelligence.search_events`` is omitted / blocked.
    analysis_events_read_enabled: bool = True
    #: When False, ``items.list`` / ``items.list_expiring`` are omitted / blocked.
    items_read_enabled: bool = True
    #: When False, ``items.create`` / ``items.update`` are omitted / blocked.
    #: Agent ticks always disable writes so inventory is not mutated by reconcile/scout.
    items_writes_enabled: bool = True


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

AGENT_CHANNEL = AgentChannel(
    id="agent",
    system_prompt=AGENT_TASK_SYSTEM_PROMPT_BASE,
    # Default; agent_tick overrides via ``channel_from_agent_spec``.
    stateless=True,
    user_event_origin="agent",
    force_web_search=False,
    calendar_writes_enabled=False,
    calendar_read_enabled=True,
    web_search_enabled=False,
    analysis_events_read_enabled=True,
    items_read_enabled=True,
    items_writes_enabled=False,
)


def channel_from_agent_spec(spec: AgentTaskSpec, *, stateless: bool) -> AgentChannel:
    """Build a runtime channel policy from a normalized task AgentTaskSpec."""
    return replace(
        AGENT_CHANNEL,
        system_prompt=AGENT_TASK_SYSTEM_PROMPT_BASE,
        stateless=stateless,
        user_event_origin=spec.user_event_origin(),
        force_web_search=spec.cap_force_web_search,
        calendar_writes_enabled=spec.cap_calendar_writes,
        calendar_read_enabled=spec.cap_calendar_read,
        web_search_enabled=spec.cap_web_search or spec.cap_force_web_search,
        analysis_events_read_enabled=spec.cap_read_analysis_events,
        items_read_enabled=spec.cap_read_items,
    )


def get_agent_channel(channel_id: AgentChannelId | str | None) -> AgentChannel:
    if channel_id == "a2a":
        return A2A_CHANNEL
    if channel_id == "agent":
        return AGENT_CHANNEL
    return ASSISTANT_CHANNEL
