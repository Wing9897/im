"""Delete only known local Intelligence Monitor SQLite database files.

Dry-run by default. ``--apply`` removes each known database and its SQLite
``-wal``/``-shm`` sidecars. It deliberately does not remove backups, secrets,
session files, connection settings, directories, Docker volumes, or other data.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_DB_NAME = "intelligence_monitor.db"
_ELECTRON_USERDATA_DIRS = (
    "Intelligence Monitor",
    "com.intelligencemonitor.desktop",
    "intelligence-monitor-desktop",
)


def _current_schema_version() -> str:
    source = _REPO_ROOT / "server" / "db" / "schema_inspect.py"
    try:
        text = source.read_text(encoding="utf-8")
    except OSError:
        return "current"
    match = re.search(r"^CURRENT_SCHEMA_VERSION\s*=\s*(\d+)\s*$", text, re.MULTILINE)
    return f"v{match.group(1)}" if match else "current"


def _candidate_db_paths() -> list[Path]:
    paths = [_REPO_ROOT / _DEFAULT_DB_NAME]
    env_db = os.environ.get("INTELLIGENCE_MONITOR_DB", "").strip()
    if env_db:
        paths.append(Path(env_db).expanduser())

    data_dir = os.environ.get("INTELLIGENCE_MONITOR_DATA_DIR", "").strip()
    if data_dir:
        root = Path(data_dir).expanduser()
        paths.extend((root / _DEFAULT_DB_NAME, root / "dev-runtime" / _DEFAULT_DB_NAME))

    appdata = os.environ.get("APPDATA", "").strip()
    if appdata:
        for folder in _ELECTRON_USERDATA_DIRS:
            base = Path(appdata) / folder
            paths.extend((base / _DEFAULT_DB_NAME, base / "dev-runtime" / _DEFAULT_DB_NAME))

    paths.append(Path.home() / ".intelligence-monitor" / _DEFAULT_DB_NAME)
    seen: set[Path] = set()
    unique: list[Path] = []
    for path in paths:
        resolved = path.resolve()
        if resolved not in seen:
            seen.add(resolved)
            unique.append(resolved)
    return unique


def _collect_targets() -> list[Path]:
    targets: list[Path] = []
    for database in _candidate_db_paths():
        for candidate in (database, Path(f"{database}-wal"), Path(f"{database}-shm")):
            if candidate.is_file():
                targets.append(candidate)
    return targets


def main() -> int:
    parser = argparse.ArgumentParser(description="Reset known local Intelligence Monitor SQLite databases only.")
    parser.add_argument("--apply", action="store_true", help="Delete files (default: dry run).")
    args = parser.parse_args()
    targets = _collect_targets()
    if not targets:
        print("No known local database files found.")
        return 0

    print(f"[{'DELETE' if args.apply else 'DRY-RUN'}] {len(targets)} database file(s):")
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
        return 1
    print(f"\nDone. Restart to create a fresh schema {_current_schema_version()} database.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
