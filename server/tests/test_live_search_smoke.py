"""Optional live network smoke (set RUN_LIVE_SEARCH=1 to enable)."""

from __future__ import annotations

import json
import os

import pytest

from server.agent.tools_messages import execute_messages_tool
from server.web_search.providers import search_duckduckgo

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_LIVE_SEARCH") != "1",
    reason="Set RUN_LIVE_SEARCH=1 to run outbound DuckDuckGo smoke",
)


@pytest.mark.asyncio
async def test_live_messages_search_and_duckduckgo(app) -> None:
    local = await execute_messages_tool(
        app.state.db,
        "messages.search",
        {"query": "sender-1", "limit": 5},
    )
    assert local.get("count", 0) >= 1

    web = await search_duckduckgo("OpenAI GPT-4", count=3)
    assert web.get("error") is None, web
    assert web.get("count", 0) >= 1
    assert all(str(item.get("url") or "").startswith("http") for item in web.get("items") or [])
    print(
        json.dumps(
            {
                "messagesCount": local["count"],
                "webCount": web["count"],
                "firstWebUrl": (web.get("items") or [{}])[0].get("url"),
            },
            ensure_ascii=True,
        )
    )
