"""Shared aiohttp stand-ins for LLM provider wire tests."""

from __future__ import annotations

from typing import Any


class FakeLlmResponse:
    def __init__(self, status: int, *, json_data: dict[str, Any] | None = None, text: str = "") -> None:
        self.status = status
        self._json = json_data
        self._text = text

    async def json(self) -> dict[str, Any]:
        assert self._json is not None
        return self._json

    async def text(self) -> str:
        return self._text

    async def __aenter__(self) -> FakeLlmResponse:
        return self

    async def __aexit__(self, *_args: object) -> bool:
        return False


class FakeLlmSession:
    def __init__(self, responder: Any) -> None:
        self._responder = responder

    def post(self, url: str, **_kwargs: Any) -> FakeLlmResponse:
        return self._responder("POST", url, **_kwargs)

    def get(self, url: str, **_kwargs: Any) -> FakeLlmResponse:
        return self._responder("GET", url, **_kwargs)
