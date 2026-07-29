"""Sidecar marker: pre-upgrade snapshot for post-stamp crash recovery."""

from __future__ import annotations

import json
import logging
import os
from dataclasses import asdict
from pathlib import Path
from typing import Any

from server.db.post_migration_validate import PreMigrationSnapshot

logger = logging.getLogger(__name__)


def upgrade_verify_marker_path(db_path: str, to_version: int) -> Path:
    source = Path(db_path)
    return source.with_name(f"{source.stem}.upgrade-verify-v{to_version}.json")


def write_upgrade_verify_marker(
    db_path: str,
    *,
    from_version: int,
    to_version: int,
    baseline_path: str,
    snapshot: PreMigrationSnapshot,
) -> str | None:
    if not db_path or db_path == ":memory:":
        return None
    path = upgrade_verify_marker_path(db_path, to_version)
    payload = {
        "fromVersion": from_version,
        "toVersion": to_version,
        "baselinePath": baseline_path,
        "snapshot": asdict(snapshot),
    }
    tmp = path.with_name(path.name + ".tmp")
    try:
        if tmp.exists():
            tmp.unlink()
        text = json.dumps(payload, ensure_ascii=False, indent=2)
        tmp.write_text(text, encoding="utf-8")
        with open(tmp, "rb+") as handle:
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
    except BaseException:
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError as exc:
                logger.warning("Failed to remove temp marker %s: %s", tmp, exc)
        raise
    logger.info("Wrote upgrade verify marker: %s", path)
    return str(path)


def read_upgrade_verify_marker(db_path: str, to_version: int) -> dict[str, Any] | None:
    if not db_path or db_path == ":memory:":
        return None
    path = upgrade_verify_marker_path(db_path, to_version)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("Invalid upgrade verify marker %s: %s", path, exc)
        return None
    if not isinstance(data, dict):
        return None
    return data


def clear_upgrade_verify_marker(db_path: str, to_version: int) -> None:
    if not db_path or db_path == ":memory:":
        return
    path = upgrade_verify_marker_path(db_path, to_version)
    if path.exists():
        try:
            path.unlink()
            logger.info("Cleared upgrade verify marker: %s", path)
        except OSError as exc:
            logger.warning("Failed to clear upgrade verify marker %s: %s", path, exc)


def snapshot_from_marker(payload: dict[str, Any]) -> PreMigrationSnapshot | None:
    raw = payload.get("snapshot")
    if not isinstance(raw, dict):
        return None
    try:
        return PreMigrationSnapshot(
            schema_version=int(raw["schema_version"]),
            analysis_tasks=int(raw["analysis_tasks"]),
            task_channels=int(raw["task_channels"]),
            analysis_events=int(raw["analysis_events"]),
            analysis_batches=int(raw["analysis_batches"]),
            messages=int(raw["messages"]),
        )
    except (KeyError, TypeError, ValueError):
        return None
