"""Shared wall-clock policy for AgentRuntime callers."""

from server.agent.runtime import MAX_TOOL_ROUNDS

# Hard ceiling so a misconfigured per-call timeout cannot pin a request for hours.
AGENT_WALL_TIMEOUT_CAP_SECONDS = 1200


def agent_wall_timeout_seconds(per_call_seconds: int) -> float:
    """Budget one LLM timeout per possible round plus the final response."""
    per_call = max(int(per_call_seconds), 30)
    return float(min(per_call * (MAX_TOOL_ROUNDS + 1), AGENT_WALL_TIMEOUT_CAP_SECONDS))
