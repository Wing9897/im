"""Delete local Intelligence Monitor SQLite files, schema backups, sessions,
secret.key, and connection.json.

Dry-run by default. Use --apply to delete files.

Does not remove Electron EBWebView cache or custom prompt YAML under prompts/.

Usage:
  python scripts/reset_local_databases.py
  python scripts/reset_local_databases.py --apply
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _SCRIPT_DIR.parent
_DEFAULT_DB_NAME = "intelligence_monitor.db"
# Electron userData folder names vary by build surface:
# - packaged productName → "Intelligence Monitor"
# - electron-builder appId → "com.intelligencemonitor.desktop"
# - package.json name (dev) → "intelligence-monitor-desktop"
_ELECTRON_USERDATA_DIRS = (
    "Intelligence Monitor",
    "com.intelligencemonitor.desktop",
    "intelligence-monitor-desktop",
)
_SESSION_SUFFIXES = (".session.txt", ".session")
_BAK_NAME_MARKERS = (".bak", ".bak-", "-baseline.db")


def _current_schema_version() -> str:
    """Read the baseline version from its single source of truth.

    Parsed rather than imported so the script keeps working without the
    server's dependencies installed.
    """
    source = _REPO_ROOT / "server" / "db" / "schema_inspect.py"
    try:
        text = source.read_text(encoding="utf-8")
    except OSError:
        return "current"
    match = re.search(r"^CURRENT_SCHEMA_VERSION\s*=\s*(\d+)\s*$", text, re.MULTILINE)
    return f"v{match.group(1)}" if match else "current"


def _electron_userdata_roots() -> list[Path]:
    roots: list[Path] = []
    appdata = os.environ.get("APPDATA")
    if appdata:
        for folder in _ELECTRON_USERDATA_DIRS:
            roots.append(Path(appdata) / folder)

    xdg_data = os.environ.get("XDG_DATA_HOME")
    config_roots = [Path(xdg_data)] if xdg_data else [Path.home() / ".config", Path.home() / ".intelligence-monitor"]
    for config_root in config_roots:
        for folder in _ELECTRON_USERDATA_DIRS:
            roots.append(config_root / folder)
    return roots


def _candidate_db_paths() -> list[Path]:
    paths: list[Path] = [_REPO_ROOT / _DEFAULT_DB_NAME]

    # Desktop / CI may set an explicit DB path.
    env_db = os.environ.get("INTELLIGENCE_MONITOR_DB", "").strip()
    if env_db:
        paths.append(Path(env_db).expanduser())

    data_dir = os.environ.get("INTELLIGENCE_MONITOR_DATA_DIR", "").strip()
    if data_dir:
        root = Path(data_dir).expanduser()
        paths.append(root / _DEFAULT_DB_NAME)
        # Historical Electron layout: {userData}/dev-runtime/*.db
        paths.append(root / "dev-runtime" / _DEFAULT_DB_NAME)

    # Canonical product data root (matches packaged Electron userData / CLI default).
    product = "Intelligence Monitor"
    appdata = os.environ.get("APPDATA")
    if appdata:
        paths.append(Path(appdata) / product / _DEFAULT_DB_NAME)
    paths.append(Path.home() / "Library" / "Application Support" / product / _DEFAULT_DB_NAME)
    xdg_config = os.environ.get("XDG_CONFIG_HOME", "").strip()
    if xdg_config:
        paths.append(Path(xdg_config) / product / _DEFAULT_DB_NAME)
    else:
        paths.append(Path.home() / ".config" / product / _DEFAULT_DB_NAME)

    for base in _electron_userdata_roots():
        paths.append(base / _DEFAULT_DB_NAME)
        paths.append(base / "dev-runtime" / _DEFAULT_DB_NAME)

    for config_root in (
        [Path(os.environ["XDG_DATA_HOME"])]
        if os.environ.get("XDG_DATA_HOME")
        else [Path.home() / ".config", Path.home() / ".intelligence-monitor"]
    ):
        paths.append(config_root / _DEFAULT_DB_NAME)
        paths.append(config_root / product / _DEFAULT_DB_NAME)

    # De-duplicate while preserving order.
    seen: set[Path] = set()
    unique: list[Path] = []
    for path in paths:
        try:
            resolved = path.resolve()
        except OSError:
            resolved = path
        if resolved not in seen:
            seen.add(resolved)
            unique.append(resolved)
    return unique


def _related_db_files(db_path: Path) -> list[Path]:
    return [
        db_path,
        Path(str(db_path) + "-wal"),
        Path(str(db_path) + "-shm"),
    ]


def _is_backup_artifact(path: Path) -> bool:
    name = path.name
    if any(marker in name for marker in _BAK_NAME_MARKERS):
        return True
    # Sibling WAL/SHM for timestamped schema backups
    if name.endswith(("-wal", "-shm")) and ".bak" in name:
        return True
    return False


def _candidate_backup_files() -> list[Path]:
    """Schema-upgrade and ad-hoc ``*.bak*`` next to known DB locations."""
    found: list[Path] = []
    search_dirs: list[Path] = [_REPO_ROOT]
    for db_path in _candidate_db_paths():
        search_dirs.append(db_path.parent)
    for base in _electron_userdata_roots():
        search_dirs.append(base)
        search_dirs.append(base / "dev-runtime")

    seen: set[Path] = set()
    for directory in search_dirs:
        try:
            resolved = directory.resolve()
        except OSError:
            resolved = directory
        if resolved in seen or not directory.is_dir():
            continue
        seen.add(resolved)
        try:
            for item in directory.iterdir():
                if item.is_file() and _is_backup_artifact(item):
                    found.append(item)
        except OSError:
            continue
    return found


def _candidate_session_files() -> list[Path]:
    dirs: list[Path] = [
        Path.home() / ".intelligence-monitor" / "sessions",
        _REPO_ROOT / "sessions",
    ]
    data_dir = os.environ.get("INTELLIGENCE_MONITOR_DATA_DIR", "").strip()
    if data_dir:
        dirs.append(Path(data_dir).expanduser() / "sessions")
        dirs.append(Path(data_dir).expanduser() / "dev-runtime" / "sessions")
    sessions_override = os.environ.get("INTELLIGENCE_MONITOR_SESSIONS_DIR", "").strip()
    if sessions_override:
        dirs.append(Path(sessions_override).expanduser())
    for base in _electron_userdata_roots():
        dirs.append(base / "sessions")
        dirs.append(base / "dev-runtime" / "sessions")

    found: list[Path] = []
    seen_dirs: set[Path] = set()
    for directory in dirs:
        try:
            resolved = directory.resolve()
        except OSError:
            resolved = directory
        if resolved in seen_dirs or not directory.is_dir():
            continue
        seen_dirs.add(resolved)
        try:
            for item in directory.iterdir():
                if item.is_file() and item.name.endswith(_SESSION_SUFFIXES):
                    found.append(item)
        except OSError:
            continue
    return found


def _candidate_sidecar_files() -> list[Path]:
    """``secret.key`` and Desktop ``connection.json`` under known data roots."""
    roots: list[Path] = [
        Path.home() / ".intelligence-monitor",
        _REPO_ROOT,
    ]
    data_dir = os.environ.get("INTELLIGENCE_MONITOR_DATA_DIR", "").strip()
    if data_dir:
        roots.append(Path(data_dir).expanduser())
        roots.append(Path(data_dir).expanduser() / "dev-runtime")
    secret_override = os.environ.get("INTELLIGENCE_MONITOR_SECRET_KEY_FILE", "").strip()
    paths: list[Path] = []
    if secret_override:
        paths.append(Path(secret_override).expanduser())
    for root in roots:
        paths.append(root / "secret.key")
        paths.append(root / "connection.json")
    for base in _electron_userdata_roots():
        paths.append(base / "secret.key")
        paths.append(base / "connection.json")
        paths.append(base / "dev-runtime" / "secret.key")
        paths.append(base / "dev-runtime" / "connection.json")
    return paths


def _collect_targets() -> list[Path]:
    targets: list[Path] = []
    for db_path in _candidate_db_paths():
        for candidate in _related_db_files(db_path):
            if candidate.exists():
                targets.append(candidate)
    targets.extend(p for p in _candidate_backup_files() if p.exists())
    targets.extend(p for p in _candidate_session_files() if p.exists())
    targets.extend(p for p in _candidate_sidecar_files() if p.exists())

    # De-dupe
    seen: set[Path] = set()
    unique: list[Path] = []
    for path in targets:
        try:
            resolved = path.resolve()
        except OSError:
            resolved = path
        if resolved not in seen:
            seen.add(resolved)
            unique.append(path)
    return unique


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Reset local Intelligence Monitor SQLite DBs, bak files, Telegram "
            "sessions, secret.key, and connection.json."
        )
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Delete files (default is dry-run listing only).",
    )
    args = parser.parse_args()

    targets = _collect_targets()

    if not targets:
        print("No local database, backup, session, secret.key, or connection.json files found.")
        return 0

    mode = "DELETE" if args.apply else "DRY-RUN"
    print(f"[{mode}] {len(targets)} file(s):")
    for path in targets:
        print(f"  {path}")

    if not args.apply:
        print("\nRe-run with --apply to delete.")
        return 0

    errors = 0
    for path in targets:
        try:
            path.unlink()
            print(f"Deleted {path}")
        except OSError as exc:
            print(f"Failed to delete {path}: {exc}", file=sys.stderr)
            errors += 1

    if errors:
        print(
            "\nSome files could not be deleted (stop npm run dev / Electron first).",
            file=sys.stderr,
        )
        return 1

    print(
        f"\nDone. Restart npm run dev to create a fresh schema {_current_schema_version()} "
        "database. Re-register admin and re-login Telegram "
        "(sessions, secret.key, and connection.json cleared)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
