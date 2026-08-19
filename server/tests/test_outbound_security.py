"""SSRF policy and request quota tests."""

from __future__ import annotations

import asyncio
import json
import socket

import pytest

from server.http_limits import RateLimitMiddleware
from server.outbound import OutboundUrlError, validate_outbound_host, validate_outbound_url


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/admin",
        "http://10.0.0.4/internal",
        "http://169.254.169.254/latest/meta-data",
        "file:///etc/passwd",
        "https://user:password@example.com",
    ],
)
async def test_outbound_policy_rejects_internal_or_unsafe_urls(url):
    with pytest.raises(OutboundUrlError):
        await validate_outbound_url(url)


async def test_outbound_policy_allows_public_and_explicit_loopback():
    await validate_outbound_url("https://8.8.8.8/path")
    await validate_outbound_url("http://127.0.0.1:11434", allow_loopback=True)


def _addrinfo_records(*hosts: str, port: int = 443):
    records = []
    for host in hosts:
        if ":" in host:
            records.append((socket.AF_INET6, socket.SOCK_STREAM, 6, "", (host, port, 0, 0)))
        else:
            records.append((socket.AF_INET, socket.SOCK_STREAM, 6, "", (host, port)))
    return records


async def test_outbound_policy_allows_public_with_loopback_sibling(monkeypatch):
    async def fake_getaddrinfo(*_args, **_kwargs):
        return _addrinfo_records("8.8.8.8", "::1")

    monkeypatch.setattr(asyncio.get_running_loop(), "getaddrinfo", fake_getaddrinfo)
    await validate_outbound_host("mixed.example.test", 443)


async def test_outbound_policy_rejects_pure_loopback_without_allow(monkeypatch):
    async def fake_getaddrinfo(*_args, **_kwargs):
        return _addrinfo_records("::1")

    monkeypatch.setattr(asyncio.get_running_loop(), "getaddrinfo", fake_getaddrinfo)
    with pytest.raises(OutboundUrlError):
        await validate_outbound_host("loopback.example.test", 443)


async def test_outbound_policy_rejects_public_mixed_with_private(monkeypatch):
    async def fake_getaddrinfo(*_args, **_kwargs):
        return _addrinfo_records("8.8.8.8", "10.0.0.1")

    monkeypatch.setattr(asyncio.get_running_loop(), "getaddrinfo", fake_getaddrinfo)
    with pytest.raises(OutboundUrlError):
        await validate_outbound_host("ssrf.example.test", 443)


async def test_imap_outbound_policy_rejects_private_hosts():
    from server.outbound import validate_imap_host

    with pytest.raises(OutboundUrlError):
        await validate_imap_host("192.168.1.20", 993)
    await validate_imap_host("8.8.8.8", 993)


async def test_mqtt_outbound_policy_rejects_private_brokers():
    with pytest.raises(OutboundUrlError):
        await validate_outbound_host("192.168.1.20", 1883)
    await validate_outbound_host("8.8.8.8", 1883)


async def test_expensive_endpoint_rate_limit_returns_429():
    app_calls = 0

    async def app(_scope, _receive, send):
        nonlocal app_calls
        app_calls += 1
        await send({"type": "http.response.start", "status": 204, "headers": []})
        await send({"type": "http.response.body", "body": b""})

    middleware = RateLimitMiddleware(app)
    scope = {
        "type": "http",
        "path": "/api/v1/messages/batch",
        "client": ("203.0.113.5", 1234),
        "headers": [],
    }

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    statuses: list[int] = []

    async def send(message):
        if message["type"] == "http.response.start":
            statuses.append(int(message["status"]))
        elif message.get("body"):
            json.loads(message["body"])

    for _ in range(121):
        await middleware(scope, receive, send)

    assert app_calls == 120
    assert statuses[-1] == 429
