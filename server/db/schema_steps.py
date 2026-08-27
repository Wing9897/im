"""Production additive schema steps (FLOOR+1 … CURRENT).

The runner in :mod:`server.db.schema_migrate` walks this registry. Targets must
equal ``range(SCHEMA_FLOOR + 1, CURRENT_SCHEMA_VERSION + 1)`` or import fails.
"""

from __future__ import annotations

import json
import re

import aiosqlite

from server.db.schema_domains.system import CALENDAR_SHARE_PUBLISH_DDL, SCHEMA_META_DDL
from server.db.schema_inspect import (
    CURRENT_SCHEMA_VERSION,
    SCHEMA_FLOOR,
    SCHEMA_SEMVER,
    SchemaEvolutionError,
)
from server.db.schema_migrate import MigrationStep

__all__ = ["SCHEMA_MIGRATIONS", "migrate_to_2", "migrate_to_3", "migrate_to_4"]

_KEY_WORKSETS = "calendar_share_worksets"
_KEY_LEGACY_SUBSCRIPTIONS = "calendar_share_subscriptions"
_SLUG_RE = re.compile(r"^[A-Za-z0-9._-]+$")
_HANDLE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
_LISTING = frozenset({"private_group", "public", "public_busy"})
_LEGACY_LISTING = {"off": "private_group", "details": "public", "busy": "public_busy"}
_GRANT = frozenset({"busy", "details"})


async def migrate_to_2(conn: aiosqlite.Connection) -> None:
    """Stamp 2: add ``schema_meta`` (public SemVer row, singleton id=1)."""
    await conn.execute(SCHEMA_META_DDL)
    await conn.execute(
        "INSERT OR IGNORE INTO schema_meta (id, schema_semver) VALUES (1, ?)",
        (SCHEMA_SEMVER,),
    )


async def migrate_to_3(conn: aiosqlite.Connection) -> None:
    """Stamp 3: add ``worksets.emoji`` and ``worksets.description`` (empty default)."""
    await conn.execute("ALTER TABLE worksets ADD COLUMN emoji TEXT NOT NULL DEFAULT ''")
    await conn.execute("ALTER TABLE worksets ADD COLUMN description TEXT NOT NULL DEFAULT ''")
    await conn.execute(
        "UPDATE schema_meta SET schema_semver = ? WHERE id = 1",
        (SCHEMA_SEMVER,),
    )


def _listing(value: object, *, default: str = "private_group") -> str:
    if not isinstance(value, str):
        return default
    text = value.strip()
    mapped = _LEGACY_LISTING.get(text, text)
    return mapped if mapped in _LISTING else default


def _try_listing(value: object) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    mapped = _LEGACY_LISTING.get(value.strip(), value.strip())
    return mapped if mapped in _LISTING else None


def _fingerprints(raw: object) -> str:
    events: dict[str, str] = {}
    series: dict[str, str] = {}
    if isinstance(raw, dict):
        ev = raw.get("events")
        se = raw.get("series")
        if isinstance(ev, dict):
            events = {str(uid): str(digest) for uid, digest in ev.items() if str(uid).strip() and str(digest).strip()}
        if isinstance(se, dict):
            series = {str(uid): str(digest) for uid, digest in se.items() if str(uid).strip() and str(digest).strip()}
    return json.dumps({"events": events, "series": series}, ensure_ascii=False, separators=(",", ":"))


def _grants(raw: object) -> str:
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    if not isinstance(raw, list):
        return "[]"
    for item in raw:
        if not isinstance(item, dict):
            continue
        handle = str(item.get("handle") or "").strip()
        visibility = str(item.get("visibility") or "").strip()
        if not handle or len(handle) > 64 or not _HANDLE_RE.fullmatch(handle):
            continue
        if visibility not in _GRANT or handle in seen:
            continue
        seen.add(handle)
        out.append({"handle": handle, "visibility": visibility})
    return json.dumps(out, ensure_ascii=False, separators=(",", ":"))


def _publish_row(workset_id: str, raw: object) -> tuple[object, ...] | None:
    """Map one legacy JSON mapping to a SQL row. Skip unpublished / invalid."""
    if not isinstance(raw, dict) or not workset_id:
        return None
    if not raw.get("enabled"):
        return None
    slug = str(raw.get("slug") or "").strip()
    if not slug or len(slug) > 64 or not _SLUG_RE.fullmatch(slug):
        return None
    last_error = str(raw.get("lastError") or "").strip() or None
    return (
        workset_id,
        slug,
        _listing(raw.get("publicVisibility")),
        _grants(raw.get("grants")),
        1 if raw.get("pendingSync") else 0,
        str(raw.get("lastSyncAt") or "").strip() or None,
        last_error,
        str(raw.get("lastGrantsHash") or "").strip() or None,
        str(raw.get("lastServerEventsHash") or "").strip() or None,
        _try_listing(raw.get("lastPublicVisibility")),
        str(raw.get("lastEmoji") or ""),
        str(raw.get("lastDescription") or ""),
        _fingerprints(raw.get("lastFingerprints")),
    )


async def _migrate_publish_json(conn: aiosqlite.Connection) -> None:
    """Copy enabled ``calendar_share_worksets`` rows once; corrupt JSON becomes an empty table."""
    cursor = await conn.execute("SELECT value FROM system_config WHERE key = ?", (_KEY_WORKSETS,))
    try:
        row = await cursor.fetchone()
    finally:
        await cursor.close()
    payload: object = {}
    if row is not None and row[0]:
        try:
            parsed = json.loads(str(row[0]))
        except (TypeError, ValueError, json.JSONDecodeError):
            parsed = {}
        payload = parsed if isinstance(parsed, dict) else {}
    for key, value in payload.items():
        mapped = _publish_row(str(key).strip(), value)
        if mapped is None:
            continue
        await conn.execute(
            """
            INSERT OR IGNORE INTO calendar_share_publish (
                workset_id, slug, public_visibility, grants_json, pending_sync,
                last_sync_at, last_error, last_grants_hash, last_server_events_hash,
                last_public_visibility, last_emoji, last_description, last_fingerprints_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            mapped,
        )
    await conn.execute(
        "DELETE FROM system_config WHERE key IN (?, ?)",
        (_KEY_WORKSETS, _KEY_LEGACY_SUBSCRIPTIONS),
    )


async def migrate_to_4(conn: aiosqlite.Connection) -> None:
    """Stamp 4: ``calendar_share_publish`` SQL table; drop KEY_WORKSETS JSON."""
    await conn.executescript(CALENDAR_SHARE_PUBLISH_DDL)
    await _migrate_publish_json(conn)
    await conn.execute(
        "UPDATE schema_meta SET schema_semver = ? WHERE id = 1",
        (SCHEMA_SEMVER,),
    )


SCHEMA_MIGRATIONS: tuple[MigrationStep, ...] = (
    MigrationStep(target=2, apply=migrate_to_2),
    MigrationStep(target=3, apply=migrate_to_3),
    MigrationStep(target=4, apply=migrate_to_4),
)

_EXPECTED_TARGETS = tuple(range(SCHEMA_FLOOR + 1, CURRENT_SCHEMA_VERSION + 1))
_ACTUAL_TARGETS = tuple(step.target for step in SCHEMA_MIGRATIONS)
if _ACTUAL_TARGETS != _EXPECTED_TARGETS:
    raise SchemaEvolutionError(
        f"SCHEMA_MIGRATIONS targets {_ACTUAL_TARGETS} != expected {_EXPECTED_TARGETS} (programming error)"
    )
