"""Database queries for llm_profiles and llm_staff_instances."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from server.db.database import TransactionDb
from server.domain.llm_staff_classes import LLM_TASK_STAFF_CLASSES
from server.domain.web_search_providers import WEB_SEARCH_SECRET_COLUMNS
from server.secrets import protect_text
from server.util import new_id

_PROFILE_SECRET_COLUMNS = ("api_key", *WEB_SEARCH_SECRET_COLUMNS)

_INSERT_PROFILE_SQL = (
    "INSERT INTO llm_profiles ("
    "id, name, provider, base_url, model, api_key, "
    "thinking_enabled, json_mode, web_search_enabled, web_search_provider, "
    f"{', '.join(WEB_SEARCH_SECRET_COLUMNS)}, created_at, updated_at"
    ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "
    f"{', '.join('?' for _ in WEB_SEARCH_SECRET_COLUMNS)}, ?, ?)"
)


def _protect_secret(value: str) -> str:
    return protect_text(value) if value else ""


def _search_key_values(search_api_keys: Mapping[str, str]) -> tuple[str, ...]:
    return tuple(_protect_secret(str(search_api_keys.get(column) or "")) for column in WEB_SEARCH_SECRET_COLUMNS)


async def fetch_all_profile_rows(db: Any) -> list[dict[str, Any]]:
    return await db.fetch_all("SELECT * FROM llm_profiles ORDER BY created_at ASC")


async def fetch_profile_row(db: Any, profile_id: str) -> dict[str, Any] | None:
    return await db.fetch_one("SELECT * FROM llm_profiles WHERE id = ?", (profile_id,))


async def fetch_staff_rows_for_profiles(db: Any, profile_ids: Sequence[str]) -> list[dict[str, Any]]:
    if not profile_ids:
        return []
    placeholders = ",".join("?" for _ in profile_ids)
    return await db.fetch_all(
        f"SELECT * FROM llm_staff_instances WHERE profile_id IN ({placeholders}) "
        "ORDER BY staff_class ASC, created_at ASC",
        tuple(profile_ids),
    )


async def fetch_all_staff_rows(db: Any) -> list[dict[str, Any]]:
    return await db.fetch_all(
        "SELECT s.*, p.name AS profile_name, p.provider AS profile_provider, "
        "p.model AS profile_model "
        "FROM llm_staff_instances s "
        "JOIN llm_profiles p ON p.id = s.profile_id "
        "ORDER BY s.staff_class ASC, p.created_at ASC"
    )


async def insert_profile(
    tx: TransactionDb,
    *,
    profile_id: str,
    name: str,
    provider: str,
    base_url: str,
    model: str,
    api_key: str,
    thinking_enabled: int,
    json_mode: str,
    web_search_enabled: int,
    web_search_provider: str,
    search_api_keys: Mapping[str, str],
    now: str,
) -> None:
    await tx.execute(
        _INSERT_PROFILE_SQL,
        (
            profile_id,
            name,
            provider,
            base_url,
            model,
            _protect_secret(api_key),
            thinking_enabled,
            json_mode,
            web_search_enabled,
            web_search_provider,
            *_search_key_values(search_api_keys),
            now,
            now,
        ),
    )


async def update_profile(
    tx: TransactionDb,
    *,
    profile_id: str,
    name: str,
    provider: str,
    base_url: str,
    model: str,
    api_key: str | None,
    thinking_enabled: int,
    json_mode: str,
    web_search_enabled: int,
    web_search_provider: str,
    search_api_keys: Mapping[str, str | None],
    now: str,
) -> None:
    """Update profile fields. Secret columns None = keep existing."""
    sets = [
        "name = ?",
        "provider = ?",
        "base_url = ?",
        "model = ?",
        "thinking_enabled = ?",
        "json_mode = ?",
        "web_search_enabled = ?",
        "web_search_provider = ?",
    ]
    params: list[Any] = [
        name,
        provider,
        base_url,
        model,
        thinking_enabled,
        json_mode,
        web_search_enabled,
        web_search_provider,
    ]

    def _maybe_secret(column: str, value: str | None) -> None:
        if value is None:
            return
        sets.append(f"{column} = ?")
        params.append(_protect_secret(value))

    _maybe_secret("api_key", api_key)
    for column in WEB_SEARCH_SECRET_COLUMNS:
        _maybe_secret(column, search_api_keys.get(column))
    sets.append("updated_at = ?")
    params.extend([now, profile_id])
    await tx.execute(
        f"UPDATE llm_profiles SET {', '.join(sets)} WHERE id = ?",
        tuple(params),
    )


async def delete_profile(tx: TransactionDb, profile_id: str) -> None:
    await tx.execute("DELETE FROM llm_profiles WHERE id = ?", (profile_id,))


async def count_tasks_using_profile(db: Any, profile_id: str) -> int:
    value = await db.fetch_value(
        "SELECT COUNT(*) FROM analysis_tasks WHERE llm_profile_id = ?",
        (profile_id,),
    )
    return int(value or 0)


async def upsert_staff_classes(
    tx: TransactionDb,
    *,
    profile_id: str,
    staff_classes: Sequence[str],
    now: str,
) -> None:
    """Sync task-mode staff classes for this profile."""
    wanted = {c for c in staff_classes if c in LLM_TASK_STAFF_CLASSES}
    existing = await tx.fetch_all(
        "SELECT id, staff_class FROM llm_staff_instances WHERE profile_id = ?",
        (profile_id,),
    )
    existing_by_class = {str(row["staff_class"]): str(row["id"]) for row in existing}
    for staff_class, staff_id in list(existing_by_class.items()):
        if staff_class not in wanted:
            await tx.execute("DELETE FROM llm_staff_instances WHERE id = ?", (staff_id,))
    for staff_class in sorted(wanted):
        if staff_class in existing_by_class:
            continue
        await tx.execute(
            "INSERT INTO llm_staff_instances ("
            "id, staff_class, profile_id, display_name, is_active, created_at, updated_at"
            ") VALUES (?, ?, ?, NULL, 1, ?, ?)",
            (new_id(), staff_class, profile_id, now, now),
        )


async def copy_profile_secrets(db: Any, profile_id: str) -> dict[str, str]:
    """Return ciphertext api_key + search keys for deep-copy (no re-encrypt)."""
    empty = dict.fromkeys(_PROFILE_SECRET_COLUMNS, "")
    row = await db.fetch_one(
        f"SELECT {', '.join(_PROFILE_SECRET_COLUMNS)} FROM llm_profiles WHERE id = ?",
        (profile_id,),
    )
    if row is None:
        return empty
    return {column: str(row.get(column) or "") for column in _PROFILE_SECRET_COLUMNS}


async def insert_profile_with_raw_secrets(
    tx: TransactionDb,
    *,
    profile_id: str,
    name: str,
    provider: str,
    base_url: str,
    model: str,
    secret_ciphers: Mapping[str, str],
    thinking_enabled: int,
    json_mode: str,
    web_search_enabled: int,
    web_search_provider: str,
    now: str,
) -> None:
    """Insert a profile keeping already-protected secret ciphertext."""
    await tx.execute(
        _INSERT_PROFILE_SQL,
        (
            profile_id,
            name,
            provider,
            base_url,
            model,
            secret_ciphers.get("api_key") or "",
            thinking_enabled,
            json_mode,
            web_search_enabled,
            web_search_provider,
            *(secret_ciphers.get(column) or "" for column in WEB_SEARCH_SECRET_COLUMNS),
            now,
            now,
        ),
    )
