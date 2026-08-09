"""Web search providers + schema gating."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from server.agent.tools_registry import build_tool_schemas, execute_tool
from server.web_search.providers import search_brave, search_duckduckgo, search_web, unwrap_ddg_redirect


def test_unwrap_ddg_redirect() -> None:
    wrapped = "https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpath&rut=abc"
    assert unwrap_ddg_redirect(wrapped) == "https://example.com/path"
    assert unwrap_ddg_redirect("https://example.com/direct") == "https://example.com/direct"


def test_normalize_protocol_relative_ddg_href() -> None:
    from server.web_search.providers import _normalize_href

    href = _normalize_href("//duckduckgo.com/l/?uddg=https%3A%2F%2Fopenai.com%2Fgpt-4")
    assert href == "https://openai.com/gpt-4"


def test_build_tool_schemas_omits_web_when_disabled() -> None:
    enabled = {s["name"] for s in build_tool_schemas(web_search_enabled=True)}
    disabled = {s["name"] for s in build_tool_schemas(web_search_enabled=False)}
    assert "web.search" in enabled
    assert "messages.search" in enabled
    assert "intelligence.search_events" in enabled
    assert "web.search" not in disabled
    assert "messages.search" in disabled
    assert "intelligence.search_events" in disabled
    assert "calendar.upcoming" in disabled


def test_build_tool_schemas_gates_read_tools() -> None:
    names = {
        s["name"]
        for s in build_tool_schemas(
            web_search_enabled=False,
            calendar_read_enabled=False,
            analysis_events_read_enabled=False,
            items_read_enabled=False,
        )
    }
    assert "calendar.upcoming" not in names
    assert "intelligence.search_events" not in names
    assert "items.list_expiring" not in names
    assert "items.list" not in names
    assert "messages.search" in names
    assert "items.create" in names


def test_build_tool_schemas_gates_items_writes() -> None:
    names = {
        s["name"]
        for s in build_tool_schemas(
            web_search_enabled=False,
            items_writes_enabled=False,
        )
    }
    assert "items.create" not in names
    assert "items.update" not in names
    assert "items.list" in names
    assert "items.list_expiring" in names


def test_agent_channel_disables_items_writes() -> None:
    from server.agent.channels import AGENT_CHANNEL, ASSISTANT_CHANNEL, channel_from_agent_spec
    from server.domain.agent_task_spec import agent_preset_spec

    assert ASSISTANT_CHANNEL.items_writes_enabled is True
    assert AGENT_CHANNEL.items_writes_enabled is False
    policy = channel_from_agent_spec(agent_preset_spec("project_reconcile", has_channels=True), stateless=False)
    assert policy.items_writes_enabled is False
    assert policy.items_read_enabled is True


async def test_execute_tool_blocks_items_writes_when_disabled(app) -> None:
    db = app.state.db
    created = await execute_tool(
        db,
        "items.create",
        {"title": "Should not create"},
        context={"items_writes_enabled": False},
    )
    assert created == {"error": "items_writes_disabled"}
    updated = await execute_tool(
        db,
        "items.update",
        {"id": "missing", "title": "Nope"},
        context={"items_writes_enabled": False},
    )
    assert updated == {"error": "items_writes_disabled"}


async def test_duckduckgo_parses_instant_answer() -> None:
    payload = {
        "Heading": "Example",
        "AbstractText": "An example abstract.",
        "AbstractURL": "https://example.com/page",
        "RelatedTopics": [{"Text": "Related topic", "FirstURL": "https://example.com/related"}],
        "Results": [],
    }

    class _Resp:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        def raise_for_status(self):
            return None

        async def json(self, content_type=None):
            return payload

        async def text(self):
            return ""

    class _Session:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        def get(self, url, headers=None, allow_redirects=None):
            return _Resp()

    with (
        patch("server.web_search.providers.aiohttp.ClientSession", _Session),
        patch("server.web_search.providers.validate_outbound_url", AsyncMock()),
    ):
        result = await search_duckduckgo("example", count=5)

    assert result["provider"] == "duckduckgo"
    assert result["count"] >= 1
    assert result["items"][0]["url"] == "https://example.com/page"


async def test_brave_requires_api_key() -> None:
    result = await search_brave("query", api_key="")
    assert result["error"] == "brave_search_api_key not configured"
    assert result["count"] == 0


async def test_brave_parses_results_with_key() -> None:
    payload = {
        "web": {
            "results": [
                {
                    "title": "Brave Hit",
                    "url": "https://example.com/brave",
                    "description": "Snippet",
                }
            ]
        }
    }

    class _Resp:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        def raise_for_status(self):
            return None

        async def json(self, content_type=None):
            return payload

    class _Session:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        def get(self, url, headers=None, allow_redirects=None):
            assert headers and "X-Subscription-Token" in headers
            return _Resp()

    with (
        patch("server.web_search.providers.aiohttp.ClientSession", _Session),
        patch("server.web_search.providers.validate_outbound_url", AsyncMock()),
    ):
        result = await search_brave("query", api_key="test-key", count=3)

    assert result["provider"] == "brave"
    assert result["count"] == 1
    assert result["items"][0]["title"] == "Brave Hit"


async def test_search_web_empty_query() -> None:
    result = await search_web("  ")
    assert "error" in result


async def test_execute_web_search_disabled_returns_error(app) -> None:
    result = await execute_tool(
        app.state.db,
        "web.search",
        {"query": "news"},
        context={"web_search_enabled": False, "web_search_provider": "duckduckgo"},
    )
    assert result["error"] == "web search is disabled"


async def test_execute_web_search_uses_provider(app) -> None:
    mock_result = {
        "items": [{"title": "T", "url": "https://example.com", "snippet": "S"}],
        "provider": "duckduckgo",
        "count": 1,
    }
    with patch("server.web_search.execution.search_web", AsyncMock(return_value=mock_result)) as mocked:
        result = await execute_tool(
            app.state.db,
            "web.search",
            {"query": "hello", "count": 3},
            context={
                "web_search_enabled": True,
                "web_search_provider": "duckduckgo",
                "brave_search_api_key": "",
            },
        )
    assert result["count"] == 1
    mocked.assert_awaited_once()
    assert mocked.await_args is not None
    assert mocked.await_args.kwargs["provider"] == "duckduckgo"


async def test_web_search_execution_service_respects_enabled_and_count() -> None:
    from server.web_search.execution import (
        ASSISTANT_TOOL_DEFAULT_COUNT,
        WebSearchExecutionService,
    )
    from server.web_search.providers import MAX_COUNT

    service = WebSearchExecutionService()
    disabled = await service.tool_search("q", provider="duckduckgo", enabled=False)
    assert disabled["error"] == "web search is disabled"
    assert ASSISTANT_TOOL_DEFAULT_COUNT == 5
    assert MAX_COUNT == 8

    with patch(
        "server.web_search.execution.search_web",
        AsyncMock(return_value={"items": [], "provider": "duckduckgo", "count": 0}),
    ) as mocked:
        await service.tool_search(
            "hello",
            provider="duckduckgo",
            count=MAX_COUNT,
            enabled=True,
        )
    assert mocked.await_args is not None
    assert mocked.await_args.kwargs["count"] == MAX_COUNT
