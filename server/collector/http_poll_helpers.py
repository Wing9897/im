"""Pure helpers for HTTP poll credentials, request build, and content prep."""

from __future__ import annotations

import base64
import hashlib
import json
from typing import Any
from urllib.parse import urlencode

from server.collector.poll_config import clamp_poll_interval

DEFAULT_MAX_CONTENT_CHARS = 32_000
MAX_MAX_CONTENT_CHARS = 100_000
DEFAULT_TIMEOUT_SECONDS = 30
MAX_HEADERS = 10
_TRUNCATION_SUFFIX = "…[truncated]"

_VALID_METHODS = frozenset({"GET", "POST"})
_VALID_AUTH_TYPES = frozenset({"none", "bearer", "basic"})
_VALID_BODY_TYPES = frozenset({"none", "json", "text", "form"})


class HttpPollContentError(ValueError):
    """Raised when a response cannot be ingested (e.g. JSON over max length)."""


def clamp_max_content_chars(value: int | float | None) -> int:
    try:
        parsed = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        parsed = DEFAULT_MAX_CONTENT_CHARS
    return max(1, min(MAX_MAX_CONTENT_CHARS, parsed))


def clamp_timeout_seconds(value: int | float | None) -> int:
    try:
        parsed = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        parsed = DEFAULT_TIMEOUT_SECONDS
    return max(1, min(300, parsed))


def normalize_headers(raw: Any) -> dict[str, str]:
    if not isinstance(raw, dict):
        return {}
    out: dict[str, str] = {}
    for key, value in raw.items():
        if len(out) >= MAX_HEADERS:
            break
        name = str(key or "").strip()
        if not name:
            continue
        out[name] = "" if value is None else str(value)
    return out


def normalize_http_credentials(creds: dict[str, Any]) -> dict[str, Any]:
    """Normalize/validate credentials stored on an HTTP poll source."""
    url = str(creds.get("url") or "").strip()
    if not url:
        raise ValueError("URL is required")

    method = str(creds.get("method") or "GET").strip().upper()
    if method not in _VALID_METHODS:
        raise ValueError("method must be GET or POST")

    auth_type = str(creds.get("auth_type") or "none").strip().lower()
    if auth_type not in _VALID_AUTH_TYPES:
        raise ValueError("auth_type must be none, bearer, or basic")

    body_type = str(creds.get("body_type") or "none").strip().lower()
    if body_type not in _VALID_BODY_TYPES:
        raise ValueError("body_type must be none, json, text, or form")

    bearer_token = creds.get("bearer_token")
    basic_username = creds.get("basic_username")
    basic_password = creds.get("basic_password")
    if auth_type == "bearer":
        token = str(bearer_token or "").strip()
        if not token:
            raise ValueError("bearer_token is required for bearer auth")
        bearer_token = token
        basic_username = None
        basic_password = None
    elif auth_type == "basic":
        username = str(basic_username or "").strip()
        if not username:
            raise ValueError("basic_username is required for basic auth")
        basic_username = username
        basic_password = "" if basic_password is None else str(basic_password)
        bearer_token = None
    else:
        bearer_token = None
        basic_username = None
        basic_password = None

    body = creds.get("body")
    if body_type == "none":
        body = None
    elif body is None:
        body = ""
    else:
        body = body if isinstance(body, str) else str(body)

    return {
        "url": url,
        "method": method,
        "auth_type": auth_type,
        "bearer_token": bearer_token,
        "basic_username": basic_username,
        "basic_password": basic_password,
        "headers": normalize_headers(creds.get("headers")),
        "body_type": body_type,
        "body": body,
        "poll_interval_seconds": clamp_poll_interval(creds.get("poll_interval_seconds")),
        "max_content_chars": clamp_max_content_chars(creds.get("max_content_chars")),
        "timeout_seconds": clamp_timeout_seconds(creds.get("timeout_seconds")),
    }


def _header_key_exists(headers: dict[str, str], name: str) -> bool:
    target = name.lower()
    return any(key.lower() == target for key in headers)


def build_request_headers(creds: dict[str, Any]) -> dict[str, str]:
    """Merge custom headers with system Auth; system Authorization always wins."""
    headers = {str(k): str(v) for k, v in (creds.get("headers") or {}).items()}
    # Drop user Authorization so system auth cannot be overridden.
    headers = {k: v for k, v in headers.items() if k.lower() != "authorization"}

    auth_type = str(creds.get("auth_type") or "none").lower()
    if auth_type == "bearer":
        token = str(creds.get("bearer_token") or "").strip()
        if token:
            headers["Authorization"] = f"Bearer {token}"
    elif auth_type == "basic":
        username = str(creds.get("basic_username") or "")
        password = str(creds.get("basic_password") or "")
        token = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("ascii")
        headers["Authorization"] = f"Basic {token}"

    body_type = str(creds.get("body_type") or "none").lower()
    if not _header_key_exists(headers, "Content-Type"):
        if body_type == "json":
            headers["Content-Type"] = "application/json"
        elif body_type == "text":
            headers["Content-Type"] = "text/plain; charset=utf-8"
        elif body_type == "form":
            headers["Content-Type"] = "application/x-www-form-urlencoded"

    return headers


def encode_request_body(creds: dict[str, Any]) -> bytes | None:
    body_type = str(creds.get("body_type") or "none").lower()
    if body_type == "none" or str(creds.get("method") or "GET").upper() == "GET":
        return None

    raw = creds.get("body")
    if raw is None:
        raw = ""

    if body_type == "json":
        if isinstance(raw, (dict, list)):
            return json.dumps(raw, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        text = str(raw).strip()
        if not text:
            return b""
        # Validate JSON shape; re-serialize for stable encoding.
        parsed = json.loads(text)
        return json.dumps(parsed, ensure_ascii=False, separators=(",", ":")).encode("utf-8")

    if body_type == "form":
        text = str(raw).strip()
        if not text:
            return b""
        if text.startswith("{") and text.endswith("}"):
            parsed = json.loads(text)
            if not isinstance(parsed, dict):
                raise ValueError("form body JSON must be an object")
            return urlencode({str(k): "" if v is None else str(v) for k, v in parsed.items()}).encode("utf-8")
        return text.encode("utf-8")

    return str(raw).encode("utf-8")


def response_content_hash(method: str, url: str, body_bytes: bytes) -> str:
    digest = hashlib.sha256()
    digest.update(method.upper().encode("utf-8"))
    digest.update(b"\0")
    digest.update(url.encode("utf-8"))
    digest.update(b"\0")
    digest.update(body_bytes)
    return digest.hexdigest()[:16]


def is_json_response(content_type: str | None, body_text: str) -> bool:
    ctype = (content_type or "").lower()
    if "application/json" in ctype or "+json" in ctype:
        return True
    stripped = body_text.lstrip()
    if not stripped or stripped[0] not in "{[":
        return False
    try:
        json.loads(body_text)
    except (TypeError, ValueError, json.JSONDecodeError):
        return False
    return True


def prepare_message_content(body_text: str, *, content_type: str | None, max_chars: int) -> str:
    """Return content for insertion, or raise HttpPollContentError for oversized JSON."""
    if is_json_response(content_type, body_text):
        if len(body_text) > max_chars:
            raise HttpPollContentError(f"JSON response exceeds max_content_chars ({len(body_text)} > {max_chars})")
        return body_text

    if len(body_text) <= max_chars:
        return body_text
    keep = max(0, max_chars - len(_TRUNCATION_SUFFIX))
    return body_text[:keep] + _TRUNCATION_SUFFIX
