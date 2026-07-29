"""Application semver — single source: repo-root ``VERSION`` file."""

from __future__ import annotations

from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[1]
_VERSION_FILE = _REPO_ROOT / "VERSION"


def read_app_version() -> str:
    if not _VERSION_FILE.is_file():
        raise RuntimeError(f"Missing VERSION file at {_VERSION_FILE}")
    text = _VERSION_FILE.read_text(encoding="utf-8").strip()
    if not text:
        raise RuntimeError(f"Empty VERSION file at {_VERSION_FILE}")
    return text


__version__ = read_app_version()
