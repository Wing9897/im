"""Startup probe: verify the local key can decrypt stored ``enc:v1:`` ciphertext."""

from __future__ import annotations

import logging
from typing import Any

from server.secrets import SECRET_CONFIG_KEYS, SecretProtectionError, unprotect_text

logger = logging.getLogger(__name__)

_ENCRYPTED_PREFIX = "enc:v1:"
_CIPHER_LIKE = f"{_ENCRYPTED_PREFIX}%"


def _ciphertext(value: Any) -> str | None:
    text = "" if value is None else str(value)
    if text.startswith(_ENCRYPTED_PREFIX):
        return text
    return None


async def scrub_undecryptable_secrets(db: Any) -> dict[str, int]:
    """Clear ``enc:v1:`` ciphertext that cannot be recovered without the old key.

    Preserves non-secret business rows. Returns per-category scrub counts.

    Accounts that lose credentials are marked ``disconnected`` so the UI does not
    keep a stale ``connected`` status (session files are cleared separately).
    """
    from server.util import utc_now_iso

    now = utc_now_iso()
    config_count = 0
    if SECRET_CONFIG_KEYS:
        placeholders = ",".join("?" for _ in SECRET_CONFIG_KEYS)
        config_count = await db.execute(
            f"DELETE FROM system_config WHERE key IN ({placeholders}) AND value LIKE ?",
            (*SECRET_CONFIG_KEYS, _CIPHER_LIKE),
        )

    accounts_count = await db.execute(
        "UPDATE accounts SET credentials = NULL, status = 'disconnected', updated_at = ? WHERE credentials LIKE ?",
        (now, _CIPHER_LIKE),
    )
    # Heal rows already scrubbed earlier (or empty) but still labeled connected.
    stale_connected = await db.execute(
        "UPDATE accounts SET status = 'disconnected', updated_at = ? "
        "WHERE credentials IS NULL AND status = 'connected'",
        (now,),
    )
    actions_count = await db.execute(
        "UPDATE actions SET configuration = '{}' WHERE configuration LIKE ?",
        (_CIPHER_LIKE,),
    )
    logger.info(
        "Scrubbed undecryptable secrets: system_config=%d accounts=%d stale_connected=%d actions=%d",
        config_count,
        accounts_count,
        stale_connected,
        actions_count,
    )
    return {
        "system_config": config_count,
        "accounts": accounts_count,
        "stale_connected": stale_connected,
        "actions": actions_count,
    }


async def probe_stored_secrets(db: Any) -> tuple[bool, str | None]:
    """Sample-decrypt any stored ciphertext.

    Returns ``(True, None)`` when there is no ciphertext (fresh / empty DB) or
    every sampled blob decrypts. Returns ``(False, error)`` on the first
    ``SecretProtectionError`` (wrong / unreadable ``secret.key``).
    """
    samples: list[str] = []

    if SECRET_CONFIG_KEYS:
        placeholders = ",".join("?" for _ in SECRET_CONFIG_KEYS)
        rows = await db.fetch_all(
            f"SELECT value FROM system_config WHERE key IN ({placeholders})",
            tuple(SECRET_CONFIG_KEYS),
        )
        for row in rows:
            cipher = _ciphertext(row.get("value"))
            if cipher is not None:
                samples.append(cipher)

    account_rows = await db.fetch_all(
        "SELECT credentials FROM accounts WHERE credentials IS NOT NULL AND credentials LIKE ? LIMIT 8",
        (_CIPHER_LIKE,),
    )
    for row in account_rows:
        cipher = _ciphertext(row.get("credentials"))
        if cipher is not None:
            samples.append(cipher)

    action_rows = await db.fetch_all(
        "SELECT configuration FROM actions WHERE configuration LIKE ? LIMIT 8",
        (_CIPHER_LIKE,),
    )
    for row in action_rows:
        cipher = _ciphertext(row.get("configuration"))
        if cipher is not None:
            samples.append(cipher)

    if not samples:
        return True, None

    for sample in samples:
        try:
            unprotect_text(sample)
        except SecretProtectionError as exc:
            message = str(exc) or "Stored secret cannot be decrypted"
            logger.error("Stored secrets probe failed: %s", message)
            return False, message

    return True, None
