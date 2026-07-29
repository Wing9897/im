"""Household / ingestion API keys (multi-key, hash-only storage)."""

from __future__ import annotations

import hashlib
import json
import secrets
from typing import Any

from server.db.database import Database
from server.util import new_id, utc_now_iso

DEFAULT_SCOPES: list[str] = ["*"]
A2A_AGENT_SCOPE = "a2a:agent"
#: Customer-manager (liaison) keys: natural-language A2A agent only.
A2A_LIAISON_SCOPES: list[str] = [A2A_AGENT_SCOPE]
A2A_PATH_PREFIX = "/api/v1/a2a/"
#: Retired scope — rejected on create/normalize; dropped (not rewritten) on row read.
_RETIRED_A2A_EVENTS_SCOPE = "a2a:events"


def _hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _preview(secret: str) -> str:
    if len(secret) <= 8:
        return "****"
    return f"{secret[:4]}…{secret[-4:]}"


def _normalize_scopes(
    scopes: list[str] | None,
    *,
    reject_retired: bool = True,
) -> list[str]:
    if scopes is None:
        return list(DEFAULT_SCOPES)
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in scopes:
        value = str(raw or "").strip()
        if value == _RETIRED_A2A_EVENTS_SCOPE:
            if reject_retired:
                raise ValueError(f"unsupported access-key scope: {value}")
            continue
        if not value or value in seen:
            continue
        seen.add(value)
        cleaned.append(value)
    return cleaned or list(DEFAULT_SCOPES)


def _scopes_from_row(raw: Any) -> list[str]:
    if raw is None:
        return list(DEFAULT_SCOPES)
    text = str(raw).strip()
    if not text:
        return list(DEFAULT_SCOPES)
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return list(DEFAULT_SCOPES)
    if not isinstance(parsed, list):
        return list(DEFAULT_SCOPES)
    return _normalize_scopes([str(item) for item in parsed], reject_retired=False)


def scopes_allow(scopes: list[str], capability: str) -> bool:
    if "*" in scopes:
        return True
    return capability in scopes


def scopes_allow_a2a_agent(scopes: list[str]) -> bool:
    """LLM A2A agent: explicit ``a2a:agent`` or ``*``."""
    return scopes_allow(scopes, A2A_AGENT_SCOPE)


def access_key_path_allowed(path: str, scopes: list[str]) -> bool:
    """Non-``*`` keys may only call paths under ``/api/v1/a2a/``."""
    if "*" in scopes:
        return True
    return (path or "").startswith(A2A_PATH_PREFIX)


def _public_key_dto(row: Any) -> dict[str, Any]:
    last_used = row["last_used_at"]
    return {
        "id": str(row["id"]),
        "label": str(row["label"]),
        "preview": str(row["preview"] or ""),
        "createdAt": str(row["created_at"]),
        "scopes": _scopes_from_row(row["scopes"]),
        "lastUsedAt": str(last_used) if last_used else None,
    }


async def list_access_keys_public(db: Database) -> list[dict[str, Any]]:
    rows = await db.fetch_all(
        """
        SELECT id, label, preview, created_at, scopes, last_used_at
        FROM access_api_keys
        WHERE revoked_at IS NULL
        ORDER BY created_at ASC
        """
    )
    return [_public_key_dto(row) for row in rows]


async def create_access_key(
    db: Database,
    label: str,
    *,
    scopes: list[str] | None = None,
) -> dict[str, Any]:
    clean_label = (label or "").strip()[:80] or "Access key"
    clean_scopes = _normalize_scopes(scopes)
    secret = secrets.token_urlsafe(32)
    key_id = new_id()
    created_at = utc_now_iso()
    preview = _preview(secret)
    await db.execute(
        """
        INSERT INTO access_api_keys
            (id, label, secret_hash, preview, created_at, revoked_at, scopes, last_used_at)
        VALUES (?, ?, ?, ?, ?, NULL, ?, NULL)
        """,
        (key_id, clean_label, _hash_secret(secret), preview, created_at, json.dumps(clean_scopes)),
    )
    return {
        "id": key_id,
        "label": clean_label,
        "preview": preview,
        "createdAt": created_at,
        "scopes": clean_scopes,
        "lastUsedAt": None,
        "key": secret,
    }


async def revoke_access_key(db: Database, key_id: str) -> bool:
    trimmed = key_id.strip()
    if not trimmed:
        return False
    now = utc_now_iso()
    changed = await db.execute(
        """
        UPDATE access_api_keys
        SET revoked_at = ?
        WHERE id = ? AND revoked_at IS NULL
        """,
        (now, trimmed),
    )
    return int(changed or 0) > 0


async def resolve_access_token(db: Database, token: str) -> dict[str, Any] | None:
    """Return ``{id, scopes}`` for a valid active key, else ``None``."""
    presented = (token or "").strip()
    if not presented:
        return None
    token_hash = _hash_secret(presented)
    row = await db.fetch_one(
        """
        SELECT id, secret_hash, scopes
        FROM access_api_keys
        WHERE secret_hash = ? AND revoked_at IS NULL
        """,
        (token_hash,),
    )
    if row is None:
        return None
    if not secrets.compare_digest(str(row["secret_hash"]), token_hash):
        return None
    return {"id": str(row["id"]), "scopes": _scopes_from_row(row["scopes"])}


async def is_valid_access_token(db: Database, token: str) -> bool:
    return await resolve_access_token(db, token) is not None


async def touch_access_key_last_used(db: Database, key_id: str) -> None:
    trimmed = (key_id or "").strip()
    if not trimmed:
        return
    await db.execute(
        """
        UPDATE access_api_keys
        SET last_used_at = ?
        WHERE id = ? AND revoked_at IS NULL
        """,
        (utc_now_iso(), trimmed),
    )


async def access_keys_configured(db: Database) -> bool:
    count = await db.fetch_value("SELECT COUNT(*) FROM access_api_keys WHERE revoked_at IS NULL")
    return int(count or 0) > 0


async def seed_access_key(
    db: Database,
    secret: str,
    *,
    label: str = "Access key",
    scopes: list[str] | None = None,
) -> dict[str, Any]:
    """Insert a key with a known plaintext secret (tests / fixtures only)."""
    presented = (secret or "").strip()
    if not presented:
        raise ValueError("secret must be non-empty")
    clean_label = (label or "").strip()[:80] or "Access key"
    clean_scopes = _normalize_scopes(scopes)
    key_id = new_id()
    created_at = utc_now_iso()
    preview = _preview(presented)
    await db.execute(
        """
        INSERT INTO access_api_keys
            (id, label, secret_hash, preview, created_at, revoked_at, scopes, last_used_at)
        VALUES (?, ?, ?, ?, ?, NULL, ?, NULL)
        """,
        (key_id, clean_label, _hash_secret(presented), preview, created_at, json.dumps(clean_scopes)),
    )
    return {
        "id": key_id,
        "label": clean_label,
        "preview": preview,
        "createdAt": created_at,
        "scopes": clean_scopes,
        "lastUsedAt": None,
        "key": presented,
    }
