"""HTTP wire tests for LLM provider helpers."""

from __future__ import annotations

import asyncio
from typing import Any, cast

import aiohttp
import pytest

from server.analyzer.llm_providers import (
    LlmClientError,
    check_response,
    complete_gemini,
    complete_ollama,
    complete_openai_responses_web_search,
    complete_openai_style,
    convert_messages_to_gemini,
    extract_openai_responses_text,
    probe_gemini,
    probe_ollama,
    probe_openai_style,
)


class _FakeResponse:
    def __init__(self, status: int, *, json_data: dict[str, Any] | None = None, text: str = "") -> None:
        self.status = status
        self._json = json_data
        self._text = text

    async def json(self) -> dict[str, Any]:
        assert self._json is not None
        return self._json

    async def text(self) -> str:
        return self._text

    async def __aenter__(self) -> _FakeResponse:
        return self

    async def __aexit__(self, *_args: object) -> bool:
        return False


class _FakeSession:
    def __init__(self, responder: Any) -> None:
        self._responder = responder

    def post(self, url: str, **_kwargs: Any) -> _FakeResponse:
        return self._responder("POST", url, **_kwargs)

    def get(self, url: str, **_kwargs: Any) -> _FakeResponse:
        return self._responder("GET", url, **_kwargs)


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


async def test_complete_ollama_returns_unified_shape() -> None:
    captured: dict[str, Any] = {}

    def responder(method: str, url: str, **_kwargs: Any) -> _FakeResponse:
        assert method == "POST"
        assert url.endswith("/api/chat")
        captured["json"] = _kwargs.get("json")
        return _FakeResponse(
            200,
            json_data={
                "message": {"content": "hello"},
                "prompt_eval_count": 3,
                "eval_count": 2,
            },
        )

    session = _FakeSession(responder)
    result = await complete_ollama(
        session,  # type: ignore[arg-type]
        base_url="http://127.0.0.1:11434",
        model="llama3",
        messages=[{"role": "user", "content": "hi"}],
        temperature=0.1,
        json_mode=False,
    )
    assert result == {"text": "hello", "prompt_tokens": 3, "completion_tokens": 2}
    assert captured["json"]["think"] is False


async def test_complete_ollama_passes_think_true_when_enabled() -> None:
    captured: dict[str, Any] = {}

    def responder(method: str, url: str, **_kwargs: Any) -> _FakeResponse:
        captured["json"] = _kwargs.get("json")
        return _FakeResponse(
            200,
            json_data={
                "message": {"content": "hello", "thinking": "reasoning"},
                "prompt_eval_count": 1,
                "eval_count": 1,
            },
        )

    session = _FakeSession(responder)
    await complete_ollama(
        session,  # type: ignore[arg-type]
        base_url="http://127.0.0.1:11434",
        model="qwen3:8b",
        messages=[{"role": "user", "content": "hi"}],
        temperature=0.1,
        json_mode=True,
        think=True,
    )
    assert captured["json"]["think"] is True
    assert captured["json"]["format"] == "json"


async def test_complete_ollama_raises_on_http_error() -> None:
    session = _FakeSession(lambda *_a, **_k: _FakeResponse(503, text="busy"))
    with pytest.raises(LlmClientError, match="status 503"):
        await complete_ollama(
            session,  # type: ignore[arg-type]
            base_url="http://127.0.0.1:11434",
            model="llama3",
            messages=[{"role": "user", "content": "hi"}],
            temperature=0.1,
            json_mode=False,
        )


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


async def test_complete_gemini_returns_unified_shape() -> None:
    def responder(method: str, url: str, **_kwargs: Any) -> _FakeResponse:
        assert method == "POST"
        assert ":generateContent" in url
        return _FakeResponse(
            200,
            json_data={
                "candidates": [{"content": {"parts": [{"text": "gemini-reply"}]}}],
                "usageMetadata": {"promptTokenCount": 4, "candidatesTokenCount": 6},
            },
        )

    session = _FakeSession(responder)
    result = await complete_gemini(
        session,  # type: ignore[arg-type]
        base_url="https://generativelanguage.googleapis.com/v1beta",
        api_key="gem-key",
        model="gemini-test",
        messages=[{"role": "assistant", "content": "prior"}, {"role": "user", "content": "go"}],
        temperature=0.2,
        json_mode=True,
    )
    assert result == {"text": "gemini-reply", "prompt_tokens": 4, "completion_tokens": 6}


async def test_complete_gemini_google_search_tool_flag() -> None:
    captured: dict[str, Any] = {}

    def responder(method: str, url: str, **_kwargs: Any) -> _FakeResponse:
        captured["json"] = _kwargs.get("json")
        return _FakeResponse(
            200,
            json_data={
                "candidates": [{"content": {"parts": [{"text": '{"message":"ok"}'}]}}],
                "usageMetadata": {"promptTokenCount": 1, "candidatesTokenCount": 1},
            },
        )

    session = _FakeSession(responder)
    await complete_gemini(
        session,  # type: ignore[arg-type]
        base_url="https://generativelanguage.googleapis.com/v1beta",
        api_key="gem-key",
        model="gemini-test",
        messages=[{"role": "user", "content": "news"}],
        temperature=0.2,
        json_mode=True,
        google_search=True,
    )
    assert captured["json"]["tools"] == [{"google_search": {}}]


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


async def test_complete_gemini_raises_on_http_error() -> None:
    session = _FakeSession(lambda *_a, **_k: _FakeResponse(400, text="bad request"))
    with pytest.raises(LlmClientError, match="status 400"):
        await complete_gemini(
            session,  # type: ignore[arg-type]
            base_url="https://generativelanguage.googleapis.com/v1beta",
            api_key="gem-key",
            model="gemini-test",
            messages=[{"role": "user", "content": "go"}],
            temperature=0.2,
            json_mode=False,
        )


async def test_probe_ollama_ok_and_error() -> None:
    session = _FakeSession(lambda method, url, **_k: _FakeResponse(200, json_data={"models": []}))
    await probe_ollama(session, base_url="http://127.0.0.1:11434")  # type: ignore[arg-type]

    bad = _FakeSession(lambda *_a, **_k: _FakeResponse(502, text="bad gateway"))
    with pytest.raises(LlmClientError, match="status 502"):
        await probe_ollama(bad, base_url="http://127.0.0.1:11434")  # type: ignore[arg-type]


async def test_probe_openai_style_ok_and_error() -> None:
    session = _FakeSession(lambda method, url, **_k: _FakeResponse(200, json_data={"data": []}))
    await probe_openai_style(session, base_url="https://api.example.com/v1", api_key="sk")  # type: ignore[arg-type]

    bad = _FakeSession(lambda *_a, **_k: _FakeResponse(403, text="forbidden"))
    with pytest.raises(LlmClientError, match="status 403"):
        await probe_openai_style(bad, base_url="https://api.example.com/v1", api_key="sk")  # type: ignore[arg-type]


async def test_probe_gemini_ok_and_error() -> None:
    session = _FakeSession(lambda method, url, **_k: _FakeResponse(200, json_data={"models": []}))
    await probe_gemini(session, base_url="https://generativelanguage.googleapis.com/v1beta", api_key="k")  # type: ignore[arg-type]

    bad = _FakeSession(lambda *_a, **_k: _FakeResponse(404, text="missing"))
    with pytest.raises(LlmClientError, match="status 404"):
        await probe_gemini(bad, base_url="https://generativelanguage.googleapis.com/v1beta", api_key="k")  # type: ignore[arg-type]


def test_convert_messages_to_gemini_maps_roles() -> None:
    converted = convert_messages_to_gemini(
        [
            {"role": "user", "content": "hello"},
            {"role": "assistant", "content": "hi"},
        ]
    )
    assert converted == [
        {"role": "user", "parts": [{"text": "hello"}]},
        {"role": "model", "parts": [{"text": "hi"}]},
    ]


async def test_complete_ollama_timeout_propagates() -> None:
    class _SlowResponse:
        async def __aenter__(self) -> _SlowResponse:
            await asyncio.sleep(0.2)
            raise TimeoutError()

        async def __aexit__(self, *_args: object) -> bool:
            return False

        status = 200

        async def json(self) -> dict[str, Any]:
            return {"message": {"content": "late"}}

    class _SlowSession:
        def post(self, *_args: Any, **_kwargs: Any) -> _SlowResponse:
            return _SlowResponse()

    with pytest.raises(asyncio.TimeoutError):
        await complete_ollama(
            _SlowSession(),  # type: ignore[arg-type]
            base_url="http://127.0.0.1:11434",
            model="llama3",
            messages=[{"role": "user", "content": "hi"}],
            temperature=0.1,
            json_mode=False,
        )
