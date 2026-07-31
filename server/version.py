"""Application semver — single source: repo-root ``VERSION`` file."""

from __future__ import annotations

import sys
from pathlib import Path


def _version_file() -> Path:
    # PyInstaller onedir: datas land under sys._MEIPASS (…/_internal).
    meipass = getattr(sys, "_MEIPASS", None)
    if getattr(sys, "frozen", False) and meipass:
        return Path(meipass) / "VERSION"
    return Path(__file__).resolve().parents[1] / "VERSION"


def read_app_version() -> str:
    version_file = _version_file()
    if not version_file.is_file():
        raise RuntimeError(f"Missing VERSION file at {version_file}")
    text = version_file.read_text(encoding="utf-8").strip()
    if not text:
        raise RuntimeError(f"Empty VERSION file at {version_file}")
    return text


__version__ = read_app_version()
