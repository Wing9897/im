"""HTTP wire tests for shared LLM provider helpers."""

from __future__ import annotations

from typing import cast

import aiohttp
import pytest

from server.analyzer.llm_providers import LlmClientError, check_response
from server.tests.llm_provider_fakes import FakeLlmResponse as _FakeResponse


async def test_check_response_raises_on_4xx() -> None:
    resp = _FakeResponse(401, text='{"error":"unauthorized"}')
    with pytest.raises(LlmClientError, match="status 401") as caught:
        await check_response(cast(aiohttp.ClientResponse, resp))
    exc = caught.value
    assert exc.status_code == 401
    assert exc.response_body == '{"error":"unauthorized"}'


async def test_check_response_retains_capped_429_body() -> None:
    body = '{"error":{"message":"rate limit","details":"' + ("x" * 5000) + '"}}'
    resp = _FakeResponse(429, text=body)
    with pytest.raises(LlmClientError, match="status 429") as caught:
        await check_response(cast(aiohttp.ClientResponse, resp), provider="openai")
    exc = caught.value
    assert exc.status_code == 429
    assert exc.provider == "openai"
    assert exc.response_body is not None
    assert len(exc.response_body) == 4000
    assert exc.response_body.startswith('{"error"')
