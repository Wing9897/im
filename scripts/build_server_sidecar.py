"""Build the self-contained backend used by the Electron installer.

Must run on the **target OS** (PyInstaller does not cross-compile): Windows
produces ``intelligence-monitor-server.exe``; macOS／Linux produce
``intelligence-monitor-server``. Output: ``desktop/server-runtime/``.

Hidden-import / collect audit (step-6 performance):
- ``server.*`` via ``collect_submodules`` (tests excluded).
- ``collect-all`` kept only where dynamic imports or package data are known
  brittle: uvicorn, telethon, feedparser, imap_tools, icalendar.
- ``sse_starlette`` → ``collect-submodules`` (small, no data files).
- ``tzdata`` → ``collect-data`` (zoneinfo needs IANA tables, not all code).
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

import PyInstaller.__main__
from PyInstaller.utils.hooks import collect_submodules

ROOT = Path(__file__).resolve().parents[1]
DIST_DIR = ROOT / "desktop" / "server-runtime"
WORK_DIR = ROOT / "build" / "pyinstaller-server"
VERSION_FILE = ROOT / "VERSION"


def main() -> None:
    if not VERSION_FILE.is_file():
        raise SystemExit(f"Missing VERSION file at {VERSION_FILE}")
    shutil.rmtree(DIST_DIR, ignore_errors=True)
    shutil.rmtree(WORK_DIR, ignore_errors=True)
    server_modules = collect_submodules(
        "server",
        filter=lambda name: not name.startswith("server.tests"),
    )
    sse_modules = collect_submodules("sse_starlette")
    # Windows uses ';' as --add-data separator; POSIX uses ':'.
    data_sep = ";" if sys.platform == "win32" else ":"
    version_data = f"{VERSION_FILE}{data_sep}."
    presets_src = ROOT / "shared" / "task_presets.json"
    if not presets_src.is_file():
        raise SystemExit(f"Missing task presets catalog at {presets_src}")
    presets_data = f"{presets_src}{data_sep}."
    PyInstaller.__main__.run(
        [
            str(ROOT / "server" / "__main__.py"),
            "--name=intelligence-monitor-server",
            "--onedir",
            "--noconfirm",
            "--clean",
            f"--paths={ROOT}",
            f"--distpath={DIST_DIR}",
            f"--workpath={WORK_DIR}",
            f"--specpath={WORK_DIR}",
            f"--add-data={version_data}",
            f"--add-data={presets_data}",
            "--exclude-module=server.tests",
            "--exclude-module=icalendar.tests",
            *(f"--hidden-import={name}" for name in server_modules),
            *(f"--hidden-import={name}" for name in sse_modules),
            "--collect-all=uvicorn",
            "--collect-all=telethon",
            "--collect-all=feedparser",
            "--collect-all=imap_tools",
            "--collect-all=icalendar",
            "--collect-data=tzdata",
        ]
    )
    bundled = DIST_DIR / "intelligence-monitor-server" / "_internal" / "VERSION"
    if not bundled.is_file():
        raise SystemExit(f"PyInstaller did not bundle VERSION at {bundled}")
    bundled_presets = DIST_DIR / "intelligence-monitor-server" / "_internal" / "task_presets.json"
    if not bundled_presets.is_file():
        raise SystemExit(f"PyInstaller did not bundle task presets at {bundled_presets}")


if __name__ == "__main__":
    main()
