"""Outbound HTTP policy that blocks server-side requests to internal networks."""

from __future__ import annotations

import asyncio
import ipaddress
import socket
from urllib.parse import urlsplit


class OutboundUrlError(ValueError):
    pass


async def validate_outbound_host(hostname: str, port: int, *, allow_loopback: bool = False) -> None:
    """Reject hosts that resolve to private, reserved, or link-local networks."""
    if not hostname:
        raise OutboundUrlError("Outbound host must include a hostname")
    if not 1 <= port <= 65535:
        raise OutboundUrlError("Outbound host contains an invalid port")
    try:
        literal = ipaddress.ip_address(hostname)
        addresses = {literal}
    except ValueError:
        try:
            records = await asyncio.get_running_loop().getaddrinfo(
                hostname,
                port,
                type=socket.SOCK_STREAM,
            )
        except OSError as exc:
            raise OutboundUrlError(f"Hostname cannot be resolved: {hostname}") from exc
        addresses = {ipaddress.ip_address(record[4][0]) for record in records}

    if not addresses:
        raise OutboundUrlError("Hostname did not resolve to an address")
    for address in addresses:
        if allow_loopback and address.is_loopback:
            continue
        if not address.is_global:
            raise OutboundUrlError(f"Outbound URL resolves to a non-public address: {address}")


async def validate_outbound_url(url: str, *, allow_loopback: bool = False) -> None:
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"}:
        raise OutboundUrlError("Only http and https URLs are allowed")
    if not parsed.hostname:
        raise OutboundUrlError("URL must include a hostname")
    if parsed.username or parsed.password:
        raise OutboundUrlError("Credentials in URLs are not allowed")

    try:
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
    except ValueError as exc:
        raise OutboundUrlError("URL contains an invalid port") from exc
    await validate_outbound_host(parsed.hostname, port, allow_loopback=allow_loopback)


async def validate_imap_host(hostname: str, port: int, *, use_ssl: bool = True) -> None:
    """Reject IMAP hosts that resolve to private or non-public networks."""
    if not hostname or not hostname.strip():
        raise OutboundUrlError("IMAP host must include a hostname")
    default_port = 993 if use_ssl else 143
    resolved_port = port if port else default_port
    await validate_outbound_host(hostname.strip(), resolved_port)
