"""Delete only known local Intelligence Monitor SQLite database files.

Dry-run by default. ``--apply`` removes each known database and its SQLite
``-wal``/``-shm`` sidecars. It deliberately does not remove backups, secrets,
session files, connection settings, directories, Docker volumes, or other data.
It does **not** auto-seed demo data — run seed scripts manually when needed.

Restart after ``--apply`` creates a fresh wipe-only schema at the current stamp
(SoT: ``server/db/schema_inspect.py`` ``CURRENT_SCHEMA_VERSION`` /
``SCHEMA_SEMVER``; presently stamp 43 / ``0.1.0-beta.44``).

``npm run dev`` / ``npm run dev:server`` start Python without Electron env
overrides, so the active DB is ``server.paths.default_db_path()``
(Windows: ``%APPDATA%\\Intelligence Monitor\\intelligence_monitor.db``).
The Electron ``--dev`` shell uses a separate Chromium userData folder
(``%APPDATA%\\intelligence-monitor-desktop``) for UI caches only — not SQLite.
Stop the server before ``--apply`` so SQLite is not locked / rewritten.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from server.paths import (  # noqa: E402
    PRODUCT_DATA_DIRNAME,
    default_data_dir,
    default_db_path,
)

_DEFAULT_DB_NAME = "intelligence_monitor.db"
# Electron package.json ``name`` / appId / historical aliases (Chromium userData).
_ELECTRON_USERDATA_DIRS = (
    PRODUCT_DATA_DIRNAME,  # packaged productName — same as default_data_dir()
    "intelligence-monitor-desktop",  # electron --dev (package.json name)
    "com.intelligencemonitor.desktop",
)


def _current_schema_version() -> str:
    source = _REPO_ROOT / "server" / "db" / "schema_inspect.py"
    try:
        text = source.read_text(encoding="utf-8")
    except OSError:
        return "current"
    match = re.search(r"^CURRENT_SCHEMA_VERSION\s*=\s*(\d+)\s*$", text, re.MULTILINE)
    return f"v{match.group(1)}" if match else "current"


def _unique_paths(paths: list[Path]) -> list[Path]:
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


def _candidate_db_paths() -> list[Path]:
    """All known DB locations, including the active npm-run-dev / CLI path."""
    paths: list[Path] = [
        # Authoritative path for `uv run python -m server` / `npm run dev` (no env).
        default_db_path(),
        default_data_dir() / "dev-runtime" / _DEFAULT_DB_NAME,
        _REPO_ROOT / _DEFAULT_DB_NAME,
    ]

    env_db = os.environ.get("INTELLIGENCE_MONITOR_DB", "").strip()
    if env_db:
        paths.append(Path(env_db).expanduser())

    data_dir = os.environ.get("INTELLIGENCE_MONITOR_DATA_DIR", "").strip()
    if data_dir:
        root = Path(data_dir).expanduser()
        paths.extend((root / _DEFAULT_DB_NAME, root / "dev-runtime" / _DEFAULT_DB_NAME))

    for env_key in ("APPDATA", "LOCALAPPDATA"):
        base_root = os.environ.get(env_key, "").strip()
        if not base_root:
            continue
        for folder in _ELECTRON_USERDATA_DIRS:
            base = Path(base_root) / folder
            paths.extend((base / _DEFAULT_DB_NAME, base / "dev-runtime" / _DEFAULT_DB_NAME))

    return _unique_paths(paths)


def _sidecar_paths(database: Path) -> list[Path]:
    return [database, Path(f"{database}-wal"), Path(f"{database}-shm")]


def _collect_targets() -> list[Path]:
    return [
        candidate for database in _candidate_db_paths() for candidate in _sidecar_paths(database) if candidate.is_file()
    ]


def _print_candidate_inventory() -> Path:
    active = default_db_path().resolve()
    print("Active npm-run-dev / CLI DB (server.paths.default_db_path):")
    print(f"  {active}  [{'exists' if active.is_file() else 'missing'}]")
    print("\nCandidate database paths:")
    for database in _candidate_db_paths():
        mark = "ACTIVE" if database.resolve() == active else "      "
        status = "exists" if database.is_file() else "missing"
        print(f"  [{mark}] {status:7}  {database}")
    electron_dev = Path(os.environ.get("APPDATA", "")) / "intelligence-monitor-desktop"
    if electron_dev.is_dir():
        print(
            "\nNote: Electron --dev Chromium userData (UI cache / Local Storage, not SQLite):\n"
            f"  {electron_dev}\n"
            "  Residual UI state may linger there after a DB wipe; clear Cache / "
            "Local Storage / Session Storage if the shell still shows stale data."
        )
    return active


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Reset known local Intelligence Monitor SQLite databases only "
            "(includes npm run dev path via server.paths.default_db_path)."
        )
    )
    parser.add_argument("--apply", action="store_true", help="Delete files (default: dry run).")
    parser.add_argument(
        "--list-candidates",
        action="store_true",
        help="Print every candidate path (exists or missing) and exit.",
    )
    args = parser.parse_args()

    active = _print_candidate_inventory()
    if args.list_candidates:
        return 0

    targets = _collect_targets()
    if not targets:
        print("\nNo known local database files found.")
        return 0

    print(f"\n[{'DELETE' if args.apply else 'DRY-RUN'}] {len(targets)} database file(s):")
    for path in targets:
        tag = " (active npm-run-dev path)" if path.resolve() == active else ""
        print(f"  {path}{tag}")
    if not args.apply:
        print("\nStop `npm run dev` / the FastAPI server first, then re-run with --apply.")
        return 0

    errors = 0
    for path in targets:
        try:
            path.unlink()
            print(f"Deleted {path}")
        except OSError as exc:
            print(f"Failed to delete {path}: {exc}", file=sys.stderr)
            print(
                "  Tip: stop `npm run dev` (and any `python -m server`) so the file is unlocked.",
                file=sys.stderr,
            )
            errors += 1
    if errors:
        return 1
    print(f"\nDone. Restart to create a fresh schema {_current_schema_version()} database.")
    print("No demo seed is applied automatically; seed manually if needed.")
    print(f"Active path was: {active}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
