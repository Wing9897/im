"""Public-import compatibility for Phase C file splits."""

from __future__ import annotations

from server.agent.runtime import MAX_TOOL_ROUNDS, AgentRuntime, LlmCompleter, build_system_prompt
from server.analyzer.llm_providers import (
    GEMINI_MAX_TOKENS_MESSAGE,
    GEMINI_THINKING_LEVEL_MINIMAL,
    LLM_RESPONSE_BODY_CAP,
    LlmClientError,
    check_response,
    complete_gemini,
    complete_ollama,
    complete_openai_responses_web_search,
    complete_openai_style,
    convert_messages_to_gemini,
    extract_gemini_text,
    extract_openai_responses_text,
    gemini_thinking_config,
    probe_gemini,
    probe_ollama,
    probe_openai_style,
)
from server.api.schemas.responses import (
    ActionResponse,
    AgentChatResponse,
    AnalysisEventResponse,
    CalendarSharePublishStateResponse,
    FocalBackgroundResponse,
    HealthResponse,
    MessageResponse,
    SystemSettingsSnapshot,
    TaskResponse,
    UserEventResponse,
    WorksetResponse,
)
from server.api.schemas.responses.items import ItemCategoryResponse
from server.queries.items_queries import (
    delete_category,
    delete_item,
    fetch_active_items_with_dates,
    fetch_all_category_rows,
    fetch_category_by_slug,
    fetch_category_row,
    fetch_expiring_items,
    fetch_item_row,
    fetch_item_rows,
    insert_category,
    insert_item,
    sync_linked_calendars_workset,
    update_category,
    update_item,
)


def test_agent_runtime_facade_exports() -> None:
    assert MAX_TOOL_ROUNDS == 8
    assert AgentRuntime.__name__ == "AgentRuntime"
    assert LlmCompleter.__name__ == "LlmCompleter"
    assert callable(build_system_prompt)


def test_llm_providers_facade_exports() -> None:
    assert LLM_RESPONSE_BODY_CAP == 4000
    assert GEMINI_THINKING_LEVEL_MINIMAL == "MINIMAL"
    assert "MAX_TOKENS" in GEMINI_MAX_TOKENS_MESSAGE
    assert issubclass(LlmClientError, Exception)
    for fn in (
        check_response,
        complete_gemini,
        complete_ollama,
        complete_openai_responses_web_search,
        complete_openai_style,
        convert_messages_to_gemini,
        extract_gemini_text,
        extract_openai_responses_text,
        gemini_thinking_config,
        probe_gemini,
        probe_ollama,
        probe_openai_style,
    ):
        assert callable(fn)


def test_items_queries_facade_exports() -> None:
    for fn in (
        delete_category,
        delete_item,
        fetch_active_items_with_dates,
        fetch_all_category_rows,
        fetch_category_by_slug,
        fetch_category_row,
        fetch_expiring_items,
        fetch_item_row,
        fetch_item_rows,
        insert_category,
        insert_item,
        sync_linked_calendars_workset,
        update_category,
        update_item,
    ):
        assert callable(fn)


def test_responses_barrel_all_is_explicit_and_complete() -> None:
    """``__all__`` is a hand-written sorted list; it must name every public model and nothing else."""
    import server.api.schemas.responses as barrel

    exported = list(barrel.__all__)
    public_models = sorted(name for name in vars(barrel) if name[:1].isupper())
    assert exported == sorted(exported), "__all__ must stay sorted"
    assert exported == public_models


def test_responses_barrel_representative_models() -> None:
    assert ActionResponse.__name__ == "ActionResponse"
    assert AgentChatResponse.__name__ == "AgentChatResponse"
    assert AnalysisEventResponse.__name__ == "AnalysisEventResponse"
    assert CalendarSharePublishStateResponse.__name__ == "CalendarSharePublishStateResponse"
    assert FocalBackgroundResponse.__name__ == "FocalBackgroundResponse"
    assert HealthResponse.__name__ == "HealthResponse"
    assert MessageResponse.__name__ == "MessageResponse"
    assert SystemSettingsSnapshot.__name__ == "SystemSettingsSnapshot"
    assert TaskResponse.__name__ == "TaskResponse"
    assert UserEventResponse.__name__ == "UserEventResponse"
    assert WorksetResponse.__name__ == "WorksetResponse"
    # items.py stays a direct import (never on the barrel).
    assert ItemCategoryResponse.__name__ == "ItemCategoryResponse"
