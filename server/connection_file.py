"""Read/write Desktop ``connection.json`` fields the server must honor.

Lives under ``INTELLIGENCE_MONITOR_DATA_DIR`` (Electron userData). The
``resetPasswordForLocal`` flag defaults to false — arming it requires write
access to this file (typically the OS source that owns the Desktop data dir).
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Any

from server.paths import data_dir

logger = logging.getLogger(__name__)

CONNECTION_FILENAME = "connection.json"
RESET_PASSWORD_FOR_LOCAL_KEY = "resetPasswordForLocal"


def connection_json_path() -> Path:
    return data_dir() / CONNECTION_FILENAME


def _read_raw() -> dict[str, Any] | None:
    path = connection_json_path()
    try:
        if not path.is_file():
            return None
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        logger.warning("Failed to read %s: %s", path, exc)
        return None
    if not isinstance(raw, dict):
        return None
    return raw


def is_local_password_reset_armed() -> bool:
    """True only when connection.json explicitly sets resetPasswordForLocal=true."""
    data = _read_raw()
    if data is None:
        return False
    return data.get(RESET_PASSWORD_FOR_LOCAL_KEY) is True


def disarm_local_password_reset() -> bool:
    """
    Set ``resetPasswordForLocal`` to false after a successful rescue.

    Best-effort: returns True when the file was updated (or already disarmed /
    absent). Returns False only when a write was attempted and failed.
    """
    path = connection_json_path()
    data = _read_raw()
    if data is None:
        return True
    if data.get(RESET_PASSWORD_FOR_LOCAL_KEY) is not True:
        return True

    data[RESET_PASSWORD_FOR_LOCAL_KEY] = False
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
        # Atomic replace within the same directory when possible.
        fd, tmp_name = tempfile.mkstemp(
            prefix="connection.",
            suffix=".tmp",
            dir=str(path.parent),
        )
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                handle.write(payload)
            os.replace(tmp_name, path)
        finally:
            if os.path.exists(tmp_name):
                try:
                    os.remove(tmp_name)
                except OSError:
                    pass
        logger.info("Disarmed %s after local password reset", RESET_PASSWORD_FOR_LOCAL_KEY)
        return True
    except OSError as exc:
        logger.warning("Failed to disarm local password reset in %s: %s", path, exc)
        return False
