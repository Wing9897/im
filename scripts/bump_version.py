#!/usr/bin/env python3
"""Bump the repo-root VERSION file.

Rules (fixed, no tag lookups):
  X.Y.Z-beta.N  →  X.Y.Z-beta.(N+1)   (any *-N prerelease suffix)
  X.Y.Z         →  X.Y.(Z+1)

Usage:
  python scripts/bump_version.py --dry-run   # print old → new; do not write
  python scripts/bump_version.py             # write VERSION; print new version
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION_FILE = ROOT / "VERSION"

# Prefer numbered prerelease (…-beta.6 / …-rc.1) before plain X.Y.Z.
_RE_PRERELEASE = re.compile(r"^(\d+\.\d+\.\d+-[A-Za-z0-9.-]*?)(\d+)$")
_RE_RELEASE = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")


def bump(version: str) -> str:
    version = version.strip()
    match = _RE_PRERELEASE.match(version)
    if match:
        return f"{match.group(1)}{int(match.group(2)) + 1}"
    match = _RE_RELEASE.match(version)
    if match:
        major, minor, patch = match.groups()
        return f"{major}.{minor}.{int(patch) + 1}"
    raise ValueError(f"Cannot bump VERSION={version!r} (expected X.Y.Z or X.Y.Z-<pre>.N)")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print current → next without writing VERSION",
    )
    args = parser.parse_args(argv)

    if not VERSION_FILE.is_file():
        print(f"VERSION file missing: {VERSION_FILE}", file=sys.stderr)
        return 1

    current = VERSION_FILE.read_text(encoding="utf-8").strip()
    if not current:
        print("VERSION file is empty", file=sys.stderr)
        return 1

    try:
        next_version = bump(current)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    if args.dry_run:
        print(f"{current} → {next_version}")
        return 0

    VERSION_FILE.write_text(f"{next_version}\n", encoding="utf-8")
    print(next_version)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
