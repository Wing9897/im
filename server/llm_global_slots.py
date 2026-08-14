"""Singleton LLM profile bindings for assistant / A2A / task advisor.

Stored as ``system_config`` scalar profile-id pointers (not connection settings).
Trio UI reads/writes only these slots (no ``llm_staff_instances`` assistant row).
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Final, Literal

from server.config import get_config
from server.db.database import Database, TransactionDb
from server.errors import NOT_FOUND, VALIDATION_ERROR, http_error
from server.secrets import SECRET_CONFIG_KEYS, protect_text
from server.util import utc_now_iso


async def _upsert_config(tx: TransactionDb, key: str, value: str, *, now: str) -> None:
    stored = protect_text(value) if key in SECRET_CONFIG_KEYS else value
    await tx.execute(
        "INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, "
        "updated_at = excluded.updated_at",
        (key, stored, now),
    )


#: Wire + domain id for the three singleton global slots (single SoT).
LlmGlobalSlotId = Literal["assistant", "liaison", "taskEditor"]

LLM_GLOBAL_SLOTS: Final[tuple[LlmGlobalSlotId, ...]] = (
    "assistant",
    "liaison",
    "taskEditor",
)

#: system_config keys — profile id strings (empty = unbound).
SLOT_CONFIG_KEYS: Final[dict[LlmGlobalSlotId, str]] = {
    "assistant": "llm_global_slot_assistant",
    "liaison": "llm_global_slot_liaison",
    "taskEditor": "llm_global_slot_task_editor",
}

SLOT_CONFIG_KEY_SET: Final[frozenset[str]] = frozenset(SLOT_CONFIG_KEYS.values())


def is_global_slot_id(value: str) -> bool:
    return value in SLOT_CONFIG_KEYS


def config_key_for_slot(slot: LlmGlobalSlotId) -> str:
    return SLOT_CONFIG_KEYS[slot]


async def get_slot_profile_id(db: Database, slot: LlmGlobalSlotId) -> str | None:
    """Return configured profile id for a slot, or None when unbound / blank."""
    raw = (await get_config(db, config_key_for_slot(slot))).strip()
    return raw or None


async def list_global_slots(db: Database) -> dict[str, str | None]:
    """Effective profile ids for all three slots (config pointers only)."""
    return {
        "assistant": await get_slot_profile_id(db, "assistant"),
        "liaison": await get_slot_profile_id(db, "liaison"),
        "taskEditor": await get_slot_profile_id(db, "taskEditor"),
    }


async def set_global_slot(
    db: Database,
    slot: LlmGlobalSlotId,
    profile_id: str | None,
) -> str | None:
    """Bind or clear a global slot. ``profile_id`` None/blank clears the binding."""
    cleaned = (profile_id or "").strip() or None
    if cleaned is not None:
        row = await db.fetch_one("SELECT id FROM llm_profiles WHERE id = ?", (cleaned,))
        if row is None:
            raise http_error(404, f"LLM profile not found: {cleaned}", error_code=NOT_FOUND)

    key = config_key_for_slot(slot)
    now = utc_now_iso()
    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        await _upsert_config(tx, key, cleaned or "", now=now)
    return cleaned


async def clear_slots_for_profile(db: Database, profile_id: str) -> None:
    """Clear any global slots pointing at a deleted profile."""
    now = utc_now_iso()
    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        for key in SLOT_CONFIG_KEYS.values():
            current = (await get_config(db, key)).strip()
            if current != profile_id:
                continue
            await _upsert_config(tx, key, "", now=now)


def slot_unbound_message(slot: LlmGlobalSlotId) -> str:
    labels = {
        "assistant": "assistant",
        "liaison": "A2A (account manager)",
        "taskEditor": "task advisor",
    }
    return f"No LLM profile bound for {labels[slot]}; set it under AI profiles → global slots"


async def require_slot_profile_id(db: Database, slot: LlmGlobalSlotId) -> str:
    resolved = await get_slot_profile_id(db, slot)
    if not resolved:
        raise http_error(400, slot_unbound_message(slot), error_code=VALIDATION_ERROR)
    return resolved


def serialize_slot_binding(
    slot: LlmGlobalSlotId,
    profile_id: str | None,
    profile_row: Mapping[str, Any] | None,
) -> dict[str, Any]:
    return {
        "slot": slot,
        "profileId": profile_id,
        "profileName": str(profile_row["name"]) if profile_row is not None else None,
        "profileProvider": str(profile_row["provider"]) if profile_row is not None else None,
        "profileModel": str(profile_row["model"]) if profile_row is not None else None,
    }
