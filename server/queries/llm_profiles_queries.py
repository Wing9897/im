"""Database queries for llm_profiles and llm_staff_instances."""

from __future__ import annotations

from typing import Any, Sequence

from server.db.database import TransactionDb
from server.llm_profiles_const import LLM_TASK_STAFF_CLASSES
from server.secrets import protect_text
from server.util import new_id


async def fetch_all_profile_rows(db: Any) -> list[dict[str, Any]]:
    return await db.fetch_all("SELECT * FROM llm_profiles ORDER BY is_default DESC, created_at ASC")


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
        "p.model AS profile_model, p.is_default AS profile_is_default "
        "FROM llm_staff_instances s "
        "JOIN llm_profiles p ON p.id = s.profile_id "
        "ORDER BY s.staff_class ASC, p.is_default DESC, p.created_at ASC"
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
    brave_search_api_key: str,
    is_default: int,
    now: str,
) -> None:
    await tx.execute(
        "INSERT INTO llm_profiles ("
        "id, name, provider, base_url, model, api_key, "
        "thinking_enabled, json_mode, web_search_enabled, web_search_provider, "
        "brave_search_api_key, is_default, created_at, updated_at"
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            profile_id,
            name,
            provider,
            base_url,
            model,
            protect_text(api_key) if api_key else "",
            thinking_enabled,
            json_mode,
            web_search_enabled,
            web_search_provider,
            protect_text(brave_search_api_key) if brave_search_api_key else "",
            is_default,
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
    brave_search_api_key: str | None,
    now: str,
) -> None:
    """Update profile fields. ``api_key`` / ``brave_search_api_key`` None = keep existing."""
    if api_key is None and brave_search_api_key is None:
        await tx.execute(
            "UPDATE llm_profiles SET name = ?, provider = ?, base_url = ?, model = ?, "
            "thinking_enabled = ?, json_mode = ?, web_search_enabled = ?, "
            "web_search_provider = ?, updated_at = ? WHERE id = ?",
            (
                name,
                provider,
                base_url,
                model,
                thinking_enabled,
                json_mode,
                web_search_enabled,
                web_search_provider,
                now,
                profile_id,
            ),
        )
        return
    if api_key is None:
        await tx.execute(
            "UPDATE llm_profiles SET name = ?, provider = ?, base_url = ?, model = ?, "
            "thinking_enabled = ?, json_mode = ?, web_search_enabled = ?, "
            "web_search_provider = ?, brave_search_api_key = ?, updated_at = ? WHERE id = ?",
            (
                name,
                provider,
                base_url,
                model,
                thinking_enabled,
                json_mode,
                web_search_enabled,
                web_search_provider,
                protect_text(brave_search_api_key) if brave_search_api_key else "",
                now,
                profile_id,
            ),
        )
        return
    if brave_search_api_key is None:
        await tx.execute(
            "UPDATE llm_profiles SET name = ?, provider = ?, base_url = ?, model = ?, "
            "api_key = ?, thinking_enabled = ?, json_mode = ?, web_search_enabled = ?, "
            "web_search_provider = ?, updated_at = ? WHERE id = ?",
            (
                name,
                provider,
                base_url,
                model,
                protect_text(api_key) if api_key else "",
                thinking_enabled,
                json_mode,
                web_search_enabled,
                web_search_provider,
                now,
                profile_id,
            ),
        )
        return
    await tx.execute(
        "UPDATE llm_profiles SET name = ?, provider = ?, base_url = ?, model = ?, "
        "api_key = ?, thinking_enabled = ?, json_mode = ?, web_search_enabled = ?, "
        "web_search_provider = ?, brave_search_api_key = ?, updated_at = ? WHERE id = ?",
        (
            name,
            provider,
            base_url,
            model,
            protect_text(api_key) if api_key else "",
            thinking_enabled,
            json_mode,
            web_search_enabled,
            web_search_provider,
            protect_text(brave_search_api_key) if brave_search_api_key else "",
            now,
            profile_id,
        ),
    )


async def clear_default_flags(tx: TransactionDb) -> None:
    await tx.execute("UPDATE llm_profiles SET is_default = 0 WHERE is_default = 1")


async def set_default_profile(tx: TransactionDb, profile_id: str, *, now: str) -> None:
    await clear_default_flags(tx)
    await tx.execute(
        "UPDATE llm_profiles SET is_default = 1, updated_at = ? WHERE id = ?",
        (now, profile_id),
    )


async def delete_profile(tx: TransactionDb, profile_id: str) -> None:
    await tx.execute("DELETE FROM llm_profiles WHERE id = ?", (profile_id,))


async def count_profiles(db: Any) -> int:
    value = await db.fetch_value("SELECT COUNT(*) FROM llm_profiles")
    return int(value or 0)


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
    """Sync task-mode staff classes for this profile.

    ``assistant`` is a global singleton slot (see ``server.llm_global_slots``) and
    is never created/deleted here — leave existing assistant rows untouched.
    """
    wanted = {c for c in staff_classes if c in LLM_TASK_STAFF_CLASSES}
    existing = await tx.fetch_all(
        "SELECT id, staff_class FROM llm_staff_instances WHERE profile_id = ?",
        (profile_id,),
    )
    existing_by_class = {str(row["staff_class"]): str(row["id"]) for row in existing}
    for staff_class, staff_id in list(existing_by_class.items()):
        if staff_class == "assistant":
            continue
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


async def copy_profile_secrets(db: Any, profile_id: str) -> tuple[str, str]:
    """Return ciphertext api_key and brave_search_api_key for deep-copy (no re-encrypt)."""
    row = await db.fetch_one(
        "SELECT api_key, brave_search_api_key FROM llm_profiles WHERE id = ?",
        (profile_id,),
    )
    if row is None:
        return "", ""
    return str(row.get("api_key") or ""), str(row.get("brave_search_api_key") or "")


async def insert_profile_with_raw_secrets(
    tx: TransactionDb,
    *,
    profile_id: str,
    name: str,
    provider: str,
    base_url: str,
    model: str,
    api_key_cipher: str,
    thinking_enabled: int,
    json_mode: str,
    web_search_enabled: int,
    web_search_provider: str,
    brave_search_api_key_cipher: str,
    is_default: int,
    now: str,
) -> None:
    """Insert a profile keeping already-protected secret ciphertext."""
    await tx.execute(
        "INSERT INTO llm_profiles ("
        "id, name, provider, base_url, model, api_key, "
        "thinking_enabled, json_mode, web_search_enabled, web_search_provider, "
        "brave_search_api_key, is_default, created_at, updated_at"
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            profile_id,
            name,
            provider,
            base_url,
            model,
            api_key_cipher,
            thinking_enabled,
            json_mode,
            web_search_enabled,
            web_search_provider,
            brave_search_api_key_cipher,
            is_default,
            now,
            now,
        ),
    )
