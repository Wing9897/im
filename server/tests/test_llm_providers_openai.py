"""HTTP wire tests for OpenAI-style LLM provider helpers."""

from __future__ import annotations

from typing import Any

import pytest

from server.analyzer.llm_providers import (
    LlmClientError,
    complete_openai_responses_web_search,
    complete_openai_style,
    extract_openai_responses_text,
    probe_openai_style,
)
from server.tests.llm_provider_fakes import FakeLlmResponse as _FakeResponse
from server.tests.llm_provider_fakes import FakeLlmSession as _FakeSession


async def test_complete_openai_style_returns_unified_shape() -> None:
    def responder(method: str, url: str, **_kwargs: Any) -> _FakeResponse:
        assert method == "POST"
        assert url.endswith("/chat/completions")
        return _FakeResponse(
            200,
            json_data={
                "choices": [{"message": {"content": "ok"}}],
                "usage": {"prompt_tokens": 5, "completion_tokens": 1},
            },
        )

    session = _FakeSession(responder)
    result = await complete_openai_style(
        session,  # type: ignore[arg-type]
        base_url="https://api.example.com/v1",
        api_key="sk-test",
        model="gpt-test",
        messages=[{"role": "user", "content": "ping"}],
        temperature=0.0,
        json_mode=True,
        max_output_tokens=16,
    )
    assert result == {"text": "ok", "prompt_tokens": 5, "completion_tokens": 1}


async def test_complete_openai_style_raises_on_http_error() -> None:
    session = _FakeSession(lambda *_a, **_k: _FakeResponse(429, text="rate limited"))
    with pytest.raises(LlmClientError, match="status 429") as caught:
        await complete_openai_style(
            session,  # type: ignore[arg-type]
            base_url="https://api.example.com/v1",
            api_key="sk-test",
            model="gpt-test",
            messages=[{"role": "user", "content": "ping"}],
            temperature=0.0,
            json_mode=False,
        )
    assert caught.value.status_code == 429
    assert caught.value.response_body == "rate limited"


async def test_complete_openai_responses_web_search() -> None:
    captured: dict[str, Any] = {}

    def responder(method: str, url: str, **_kwargs: Any) -> _FakeResponse:
        assert method == "POST"
        assert url.endswith("/responses")
        captured["json"] = _kwargs.get("json")
        return _FakeResponse(
            200,
            json_data={
                "output_text": '{"message":"grounded"}',
                "usage": {"input_tokens": 9, "output_tokens": 3},
            },
        )

    session = _FakeSession(responder)
    result = await complete_openai_responses_web_search(
        session,  # type: ignore[arg-type]
        base_url="https://api.openai.com/v1",
        api_key="sk-test",
        model="gpt-test",
        messages=[
            {"role": "system", "content": "sys"},
            {"role": "user", "content": "latest news"},
        ],
        temperature=0.2,
        json_mode=True,
    )
    assert result["text"] == '{"message":"grounded"}'
    assert result["prompt_tokens"] == 9
    assert captured["json"]["tools"] == [{"type": "web_search"}]
    assert captured["json"]["instructions"] == "sys"
    assert extract_openai_responses_text({"output": []}) == ""


async def test_probe_openai_style_ok_and_error() -> None:
    session = _FakeSession(lambda method, url, **_k: _FakeResponse(200, json_data={"data": []}))
    await probe_openai_style(session, base_url="https://api.example.com/v1", api_key="sk")  # type: ignore[arg-type]

    bad = _FakeSession(lambda *_a, **_k: _FakeResponse(403, text="forbidden"))
    with pytest.raises(LlmClientError, match="status 403"):
        await probe_openai_style(bad, base_url="https://api.example.com/v1", api_key="sk")  # type: ignore[arg-type]
