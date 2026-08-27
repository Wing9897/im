"""HTTP wire tests for Gemini LLM provider helpers."""

from __future__ import annotations

from typing import Any

import pytest

from server.analyzer.llm_providers import (
    GEMINI_MAX_TOKENS_MESSAGE,
    GEMINI_THINKING_LEVEL_MINIMAL,
    LlmClientError,
    complete_gemini,
    convert_messages_to_gemini,
    extract_gemini_text,
    gemini_thinking_config,
    probe_gemini,
)
from server.tests.llm_provider_fakes import FakeLlmResponse as _FakeResponse
from server.tests.llm_provider_fakes import FakeLlmSession as _FakeSession


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


def _ok_gemini_response() -> _FakeResponse:
    return _FakeResponse(
        200,
        json_data={
            "candidates": [{"content": {"parts": [{"text": "ok"}]}}],
            "usageMetadata": {"promptTokenCount": 1, "candidatesTokenCount": 1},
        },
    )


def test_gemini_thinking_config_off_is_minimal_without_budget() -> None:
    config = gemini_thinking_config(thinking_enabled=False)
    assert config is not None
    assert config == {"thinkingLevel": GEMINI_THINKING_LEVEL_MINIMAL}
    assert "thinkingBudget" not in config


def test_gemini_thinking_config_on_omits_block() -> None:
    assert gemini_thinking_config(thinking_enabled=True) is None


async def test_complete_gemini_thinking_off_sends_minimal_level() -> None:
    captured: dict[str, Any] = {}

    def responder(method: str, url: str, **_kwargs: Any) -> _FakeResponse:
        captured["json"] = _kwargs.get("json")
        return _ok_gemini_response()

    session = _FakeSession(responder)
    await complete_gemini(
        session,  # type: ignore[arg-type]
        base_url="https://generativelanguage.googleapis.com/v1beta",
        api_key="gem-key",
        model="gemini-3.1-flash-lite",
        messages=[{"role": "user", "content": "hi"}],
        temperature=0.2,
        json_mode=False,
        thinking_enabled=False,
    )
    thinking = captured["json"]["generationConfig"]["thinkingConfig"]
    assert thinking == {"thinkingLevel": "MINIMAL"}
    assert "thinkingBudget" not in thinking
    assert "thinkingBudget" not in captured["json"]["generationConfig"]
    assert "maxOutputTokens" not in captured["json"]["generationConfig"]


async def test_complete_gemini_thinking_on_omits_thinking_config() -> None:
    captured: dict[str, Any] = {}

    def responder(method: str, url: str, **_kwargs: Any) -> _FakeResponse:
        captured["json"] = _kwargs.get("json")
        return _ok_gemini_response()

    session = _FakeSession(responder)
    await complete_gemini(
        session,  # type: ignore[arg-type]
        base_url="https://generativelanguage.googleapis.com/v1beta",
        api_key="gem-key",
        model="gemini-3.1-flash-lite",
        messages=[{"role": "user", "content": "hi"}],
        temperature=0.2,
        json_mode=False,
        thinking_enabled=True,
    )
    generation = captured["json"]["generationConfig"]
    assert "thinkingConfig" not in generation
    assert "thinkingBudget" not in generation


async def test_complete_gemini_max_output_tokens_is_opt_in() -> None:
    captured: dict[str, Any] = {}

    def responder(method: str, url: str, **_kwargs: Any) -> _FakeResponse:
        captured["json"] = _kwargs.get("json")
        return _ok_gemini_response()

    session = _FakeSession(responder)
    await complete_gemini(
        session,  # type: ignore[arg-type]
        base_url="https://generativelanguage.googleapis.com/v1beta",
        api_key="gem-key",
        model="gemini-3.1-flash-lite",
        messages=[{"role": "user", "content": "hi"}],
        temperature=0.2,
        json_mode=False,
        max_output_tokens=2048,
        thinking_enabled=False,
    )
    generation = captured["json"]["generationConfig"]
    assert generation["maxOutputTokens"] == 2048
    assert generation["thinkingConfig"] == {"thinkingLevel": "MINIMAL"}


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


def test_extract_gemini_text_missing_candidates_is_friendly() -> None:
    with pytest.raises(LlmClientError, match="no usable candidates") as caught:
        extract_gemini_text({"usageMetadata": {}})
    assert "'candidates'" not in str(caught.value)
    assert caught.value.provider == "gemini"


def test_extract_gemini_text_blocked_prompt() -> None:
    with pytest.raises(LlmClientError, match="blocked") as caught:
        extract_gemini_text({"promptFeedback": {"blockReason": "SAFETY"}})
    assert caught.value.provider == "gemini"


def test_extract_gemini_text_empty_parts() -> None:
    with pytest.raises(LlmClientError, match="no usable candidates"):
        extract_gemini_text(
            {"candidates": [{"finishReason": "SAFETY", "content": {"parts": []}}]},
        )


def test_extract_gemini_text_max_tokens_empty_is_truncation_error() -> None:
    with pytest.raises(LlmClientError, match="truncated \\(MAX_TOKENS\\)") as caught:
        extract_gemini_text(
            {"candidates": [{"finishReason": "MAX_TOKENS", "content": {"parts": []}}]},
        )
    assert str(caught.value) == GEMINI_MAX_TOKENS_MESSAGE
    assert "no usable candidates" not in str(caught.value)
    assert caught.value.provider == "gemini"


def test_extract_gemini_text_max_tokens_truncated_text_is_kept() -> None:
    truncated = '{"items":[{"title":"partial"}]}'
    assert (
        extract_gemini_text(
            {
                "candidates": [
                    {
                        "finishReason": "MAX_TOKENS",
                        "content": {"parts": [{"text": truncated}]},
                    }
                ]
            },
        )
        == truncated
    )


def test_extract_gemini_text_max_tokens_skips_thought_keeps_output() -> None:
    assert (
        extract_gemini_text(
            {
                "candidates": [
                    {
                        "finishReason": "MAX_TOKENS",
                        "content": {
                            "parts": [
                                {"thought": True, "text": "internal reasoning"},
                                {"text": '{"message":"ok"}'},
                            ]
                        },
                    }
                ]
            },
        )
        == '{"message":"ok"}'
    )


def test_extract_gemini_text_max_tokens_thought_only_is_truncation_error() -> None:
    with pytest.raises(LlmClientError, match="truncated \\(MAX_TOKENS\\)"):
        extract_gemini_text(
            {
                "candidates": [
                    {
                        "finishReason": "MAX_TOKENS",
                        "content": {"parts": [{"thought": True, "text": "used all tokens thinking"}]},
                    }
                ]
            },
        )


async def test_complete_gemini_missing_candidates_raises_llm_error() -> None:
    session = _FakeSession(
        lambda *_a, **_k: _FakeResponse(200, json_data={"promptFeedback": {"blockReason": "OTHER"}}),
    )
    with pytest.raises(LlmClientError, match="blocked") as caught:
        await complete_gemini(
            session,  # type: ignore[arg-type]
            base_url="https://generativelanguage.googleapis.com/v1beta",
            api_key="gem-key",
            model="gemini-test",
            messages=[{"role": "user", "content": "go"}],
            temperature=0.2,
            json_mode=False,
        )
    assert "'candidates'" not in str(caught.value)


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
