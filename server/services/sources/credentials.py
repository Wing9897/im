"""Per-platform credential merges. Routes pass parsed body fields."""

from __future__ import annotations

from typing import Any

from server.collector.email_config import merge_email_credentials
from server.collector.http_poll_helpers import (
    clamp_max_content_chars,
    clamp_timeout_seconds,
    normalize_http_credentials,
)
from server.collector.poll_config import clamp_poll_interval
from server.secrets import MASKED_SECRET, unprotect_text
from server.util import parse_json_dict


def parse_credentials(row: dict[str, Any]) -> dict[str, Any]:
    return parse_json_dict(unprotect_text(row.get("credentials")))


def merge_discord_credentials(existing: dict[str, Any], *, bot_token: str | None) -> dict[str, Any]:
    merged = dict(existing)
    if bot_token is not None and bot_token not in ("", MASKED_SECRET):
        merged["bot_token"] = bot_token.strip()
    return merged


def merge_telegram_credentials(
    existing: dict[str, Any],
    *,
    api_id: int | None = None,
    api_hash: str | None = None,
    phone: str | None = None,
) -> dict[str, Any]:
    merged = dict(existing)
    if api_id is not None:
        merged["api_id"] = int(api_id)
    if api_hash is not None and api_hash not in ("", MASKED_SECRET):
        merged["api_hash"] = api_hash.strip()
    if phone is not None and phone.strip():
        merged["phone"] = phone.strip()
    return merged


def merge_mqtt_credentials(
    existing: dict[str, Any],
    *,
    broker_url: str | None = None,
    topics: list[str] | None = None,
    username: str | None = None,
    password: str | None = None,
    client_id: str | None = None,
) -> dict[str, Any]:
    merged = dict(existing)
    if broker_url is not None:
        merged["broker_url"] = broker_url.strip()
    if topics is not None:
        merged["topics"] = topics
    if username is not None:
        merged["username"] = username.strip() or None
    if password is not None and password != MASKED_SECRET:
        merged["password"] = password
    if client_id is not None:
        merged["client_id"] = client_id.strip() or None
    return merged


def merge_rss_credentials(
    existing: dict[str, Any],
    *,
    feed_url: str,
    poll_interval_seconds: int,
) -> dict[str, Any]:
    return {
        **existing,
        "feed_url": feed_url,
        "poll_interval_seconds": poll_interval_seconds,
    }


def merge_http_credentials(
    existing: dict[str, Any],
    *,
    url: str | None = None,
    method: str | None = None,
    auth_type: str | None = None,
    bearer_token: str | None = None,
    basic_username: str | None = None,
    basic_password: str | None = None,
    headers: dict[str, Any] | None = None,
    body_type: str | None = None,
    body: str | None = None,
    poll_interval_seconds: int | None = None,
    max_content_chars: int | None = None,
    timeout_seconds: int | None = None,
) -> dict[str, Any]:
    merged = dict(existing)
    if url is not None:
        merged["url"] = url.strip()
    if method is not None:
        merged["method"] = method
    if auth_type is not None:
        merged["auth_type"] = auth_type
    if bearer_token is not None and bearer_token != MASKED_SECRET:
        merged["bearer_token"] = bearer_token
    if basic_username is not None:
        merged["basic_username"] = basic_username
    if basic_password is not None and basic_password != MASKED_SECRET:
        merged["basic_password"] = basic_password
    if headers is not None:
        merged["headers"] = headers
    if body_type is not None:
        merged["body_type"] = body_type
    if body is not None:
        merged["body"] = body
    if poll_interval_seconds is not None:
        merged["poll_interval_seconds"] = clamp_poll_interval(poll_interval_seconds)
    if max_content_chars is not None:
        merged["max_content_chars"] = clamp_max_content_chars(max_content_chars)
    if timeout_seconds is not None:
        merged["timeout_seconds"] = clamp_timeout_seconds(timeout_seconds)
    return normalize_http_credentials(merged)


def merge_email_mailbox_credentials(
    existing: dict[str, Any],
    *,
    reset_cursors: bool | None = None,
    imap_host: str | None = None,
    imap_port: int | None = None,
    use_ssl: bool | None = None,
    username: str | None = None,
    password: str | None = None,
    folders: list[str] | None = None,
    poll_interval_seconds: int | None = None,
    initial_sync_days: int | None = None,
    initial_sync_max_messages: int | None = None,
    sender_allowlist: list[str] | None = None,
    mark_as_read: bool | None = None,
) -> dict[str, Any]:
    patch: dict[str, Any] = {"reset_cursors": reset_cursors}
    if imap_host is not None:
        patch["imap_host"] = imap_host
    if imap_port is not None:
        patch["imap_port"] = imap_port
    if use_ssl is not None:
        patch["use_ssl"] = use_ssl
    if username is not None:
        patch["username"] = username
    if password is not None:
        patch["password"] = password
    if folders is not None:
        patch["folders"] = folders
    if poll_interval_seconds is not None:
        patch["poll_interval_seconds"] = poll_interval_seconds
    if initial_sync_days is not None:
        patch["initial_sync_days"] = initial_sync_days
    if initial_sync_max_messages is not None:
        patch["initial_sync_max_messages"] = initial_sync_max_messages
    if sender_allowlist is not None:
        patch["sender_allowlist"] = sender_allowlist
    if mark_as_read is not None:
        patch["mark_as_read"] = mark_as_read
    return merge_email_credentials(existing, patch)
