"""Unified local data-root resolution (DB, secret key, Telegram sessions).

Desktop and CLI share the same default root — matching Electron
``app.getPath('userData')`` for ``productName: Intelligence Monitor``:

- Windows: ``%APPDATA%/Intelligence Monitor``
- macOS: ``~/Library/Application Support/Intelligence Monitor``
- Linux: ``$XDG_CONFIG_HOME/Intelligence Monitor`` or ``~/.config/Intelligence Monitor``

Override with ``INTELLIGENCE_MONITOR_DATA_DIR`` (Desktop still sets this to its
live ``userData``, which equals the same path when packaged).
"""

from __future__ import annotations

import logging
import os
import sys
from collections.abc import Iterable
from pathlib import Path

from server.constants import DATA_DIR_ENV, SESSIONS_DIR_ENV

logger = logging.getLogger(__name__)

#: Must match ``desktop/electron-builder.yml`` ``productName``.
PRODUCT_DATA_DIRNAME = "Intelligence Monitor"

_SESSION_SUFFIXES = (".session.txt", ".session")


def default_data_dir() -> Path:
    """Canonical writable root shared by Desktop (packaged) and CLI."""
    if sys.platform == "win32":
        appdata = os.environ.get("APPDATA", "").strip()
        if appdata:
            return Path(appdata) / PRODUCT_DATA_DIRNAME
        return Path.home() / "AppData" / "Roaming" / PRODUCT_DATA_DIRNAME
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / PRODUCT_DATA_DIRNAME
    xdg_config = os.environ.get("XDG_CONFIG_HOME", "").strip()
    if xdg_config:
        return Path(xdg_config) / PRODUCT_DATA_DIRNAME
    return Path.home() / ".config" / PRODUCT_DATA_DIRNAME


def data_dir() -> Path:
    """Resolved data root: env override, else :func:`default_data_dir`."""
    configured = os.environ.get(DATA_DIR_ENV, "").strip()
    if configured:
        return Path(configured).expanduser()
    return default_data_dir()


def default_db_path() -> Path:
    """SQLite file under the unified data root."""
    return data_dir() / "intelligence_monitor.db"


def sessions_dir() -> Path:
    """Directory for Telegram ``{source_id}.session.txt`` tokens."""
    configured = os.environ.get(SESSIONS_DIR_ENV, "").strip()
    if configured:
        return Path(configured).expanduser()
    return data_dir() / "sessions"


def default_secret_key_path() -> Path:
    """``secret.key`` under the data root (when SECRET_KEY_FILE env is unset)."""
    return data_dir() / "secret.key"


def ensure_sessions_dir() -> Path:
    """Create the active sessions directory (no copy from other locations)."""
    dest = sessions_dir()
    dest.mkdir(parents=True, exist_ok=True)
    return dest


def ensure_data_dir() -> Path:
    """Create the unified data root if missing."""
    root = data_dir()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _is_telegram_session_file(name: str) -> bool:
    return name.endswith(_SESSION_SUFFIXES)


def clear_telegram_session_files() -> int:
    """
    Delete Telegram session tokens under the active sessions dir (full reset).

    Removes ``*.session.txt`` (StringSession) and leftover Telethon ``*.session``
    SQLite files. Returns the number of files removed.
    """
    removed = 0
    try:
        directory = sessions_dir()
    except OSError:
        return 0

    try:
        if not directory.is_dir():
            return 0
        for item in directory.iterdir():
            if not item.is_file() or not _is_telegram_session_file(item.name):
                continue
            try:
                item.unlink()
                removed += 1
            except OSError as exc:
                logger.warning("Failed to delete Telegram session %s: %s", item, exc)
    except OSError as exc:
        logger.warning("Failed to clear Telegram sessions in %s: %s", directory, exc)

    if removed:
        logger.info("Cleared %d Telegram session file(s)", removed)
    return removed


def _unique_existing_files(candidates: Iterable[Path]) -> list[Path]:
    seen: set[Path] = set()
    out: list[Path] = []
    for path in candidates:
        try:
            resolved = path.resolve()
        except OSError:
            resolved = path
        if resolved in seen:
            continue
        seen.add(resolved)
        if path.is_file():
            out.append(path)
    return out


def clear_connection_json_files() -> int:
    """Delete Desktop ``connection.json`` under the active data root."""
    removed = 0
    for path in _unique_existing_files((data_dir() / "connection.json",)):
        try:
            path.unlink()
            removed += 1
        except OSError as exc:
            logger.warning("Failed to delete connection.json %s: %s", path, exc)
    if removed:
        logger.info("Cleared %d connection.json file(s)", removed)
    return removed


def clear_secret_key_files(*extra: Path) -> int:
    """Delete ``secret.key`` under the active data root and extras."""
    candidates: list[Path] = [
        default_secret_key_path(),
        *extra,
    ]
    configured = os.environ.get("INTELLIGENCE_MONITOR_SECRET_KEY_FILE", "").strip()
    if configured:
        candidates.append(Path(configured).expanduser())

    removed = 0
    for path in _unique_existing_files(candidates):
        try:
            path.unlink()
            removed += 1
        except OSError as exc:
            logger.warning("Failed to delete secret.key %s: %s", path, exc)
    if removed:
        logger.info("Cleared %d secret.key file(s)", removed)
    return removed
