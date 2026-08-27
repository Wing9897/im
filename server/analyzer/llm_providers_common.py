"""Shared LLM HTTP error type and response-status check."""

from __future__ import annotations

import aiohttp

#: Max chars retained on ``LlmClientError.response_body`` for failure forensics.
LLM_RESPONSE_BODY_CAP = 4000


class LlmClientError(Exception):
    """Raised when an LLM HTTP request fails (or provider config is invalid)."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        response_body: str | None = None,
        provider: str | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body
        self.provider = provider


async def check_response(
    resp: aiohttp.ClientResponse,
    *,
    provider: str | None = None,
) -> None:
    if resp.status >= 400:
        body = await resp.text()
        capped = body[:LLM_RESPONSE_BODY_CAP]
        raise LlmClientError(
            f"LLM request failed with status {resp.status}: {body[:500]}",
            status_code=resp.status,
            response_body=capped,
            provider=provider,
        )
