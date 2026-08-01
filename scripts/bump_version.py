#!/usr/bin/env python3
"""Compute / bump product SemVer.

Bump rules:
  X.Y.Z-beta.N  →  X.Y.Z-beta.(N+1)   (any *-N prerelease suffix)
  X.Y.Z         →  X.Y.(Z+1)

Authority for CI releases is **git tags** (``v*``). The repo-root ``VERSION``
file is a development/display fallback when no tags exist (or when
``--from-tags`` is not used). It is **not** written unless ``--write`` is
passed.

Usage:
  python scripts/bump_version.py --from-tags --print-only
  python scripts/bump_version.py --from-tags --dry-run
  python scripts/bump_version.py --dry-run   # from VERSION file
  python scripts/bump_version.py            # print next (no write)
  python scripts/bump_version.py --write    # write VERSION from file base
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION_FILE = ROOT / "VERSION"

# Prefer numbered prerelease (…-beta.6 / …-rc.1) before plain X.Y.Z.
_RE_PRERELEASE = re.compile(r"^(\d+\.\d+\.\d+-[A-Za-z0-9.-]*?)(\d+)$")
_RE_RELEASE = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")
_RE_TAG = re.compile(r"^v?(\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?)$")


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


def _parse_tag(tag: str) -> str | None:
    match = _RE_TAG.match(tag.strip())
    return match.group(1) if match else None


def _version_key(version: str) -> tuple:
    """Sort key approximating semver (prerelease < matching release)."""
    core, _, pre = version.partition("-")
    major_s, minor_s, patch_s = core.split(".")
    major, minor, patch = int(major_s), int(minor_s), int(patch_s)
    if not pre:
        return (major, minor, patch, 1, ())
    pre_match = re.match(r"^([A-Za-z0-9.-]*?)(\d+)$", pre)
    if pre_match:
        return (major, minor, patch, 0, (pre_match.group(1), int(pre_match.group(2))))
    return (major, minor, patch, 0, (pre, 0))


def latest_tag_version() -> str | None:
    """Return the highest ``v*`` tag version (no leading ``v``), or None."""
    try:
        proc = subprocess.run(
            ["git", "tag", "-l", "v*"],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError:
        return None
    if proc.returncode != 0:
        return None
    versions: list[str] = []
    for line in proc.stdout.splitlines():
        parsed = _parse_tag(line)
        if parsed:
            versions.append(parsed)
    if not versions:
        return None
    return max(versions, key=_version_key)


def read_version_file() -> str:
    if not VERSION_FILE.is_file():
        raise FileNotFoundError(f"VERSION file missing: {VERSION_FILE}")
    current = VERSION_FILE.read_text(encoding="utf-8").strip()
    if not current:
        raise ValueError("VERSION file is empty")
    return current


def resolve_base(*, from_tags: bool) -> tuple[str, str]:
    """Return ``(base_version, source)`` where source is ``tag`` or ``file``."""
    if from_tags:
        tagged = latest_tag_version()
        if tagged is not None:
            return tagged, "tag"
    return read_version_file(), "file"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--from-tags",
        action="store_true",
        help="Base version on latest git tag v* (fallback: VERSION file)",
    )
    parser.add_argument(
        "--print-only",
        action="store_true",
        help="Print only the next version (no file write; default without --write)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print current → next without writing VERSION",
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Write the next version into the repo-root VERSION file",
    )
    args = parser.parse_args(argv)

    if args.write and (args.print_only or args.dry_run):
        print("Cannot combine --write with --print-only or --dry-run", file=sys.stderr)
        return 2

    try:
        current, source = resolve_base(from_tags=args.from_tags)
        next_version = bump(current)
    except (FileNotFoundError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 1

    if args.dry_run:
        print(f"{current} → {next_version} (from {source})")
        return 0

    if args.write:
        VERSION_FILE.write_text(f"{next_version}\n", encoding="utf-8")
        print(next_version)
        return 0

    # Default / --print-only: never write.
    print(next_version)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
