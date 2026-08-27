"""HTTP wire tests for Ollama LLM provider helpers."""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from server.analyzer.llm_providers import LlmClientError, complete_ollama, probe_ollama
from server.tests.llm_provider_fakes import FakeLlmResponse as _FakeResponse
from server.tests.llm_provider_fakes import FakeLlmSession as _FakeSession


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


async def test_probe_ollama_ok_and_error() -> None:
    session = _FakeSession(lambda method, url, **_k: _FakeResponse(200, json_data={"models": []}))
    await probe_ollama(session, base_url="http://127.0.0.1:11434")  # type: ignore[arg-type]

    bad = _FakeSession(lambda *_a, **_k: _FakeResponse(502, text="bad gateway"))
    with pytest.raises(LlmClientError, match="status 502"):
        await probe_ollama(bad, base_url="http://127.0.0.1:11434")  # type: ignore[arg-type]


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
