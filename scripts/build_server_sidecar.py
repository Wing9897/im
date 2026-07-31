"""Build the self-contained backend used by the Electron installer.

Must run on the **target OS** (PyInstaller does not cross-compile): Windows
produces ``intelligence-monitor-server.exe``; macOS／Linux produce
``intelligence-monitor-server``. Output: ``desktop/server-runtime/``.
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
    # Windows uses ';' as --add-data separator; POSIX uses ':'.
    data_sep = ";" if sys.platform == "win32" else ":"
    version_data = f"{VERSION_FILE}{data_sep}."
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
            "--exclude-module=server.tests",
            *(f"--hidden-import={name}" for name in server_modules),
            "--collect-all=uvicorn",
            "--collect-all=sse_starlette",
            "--collect-all=telethon",
            "--collect-all=feedparser",
            "--collect-all=imap_tools",
            "--collect-all=icalendar",
            "--collect-all=tzdata",
        ]
    )
    bundled = DIST_DIR / "intelligence-monitor-server" / "_internal" / "VERSION"
    if not bundled.is_file():
        raise SystemExit(f"PyInstaller did not bundle VERSION at {bundled}")


if __name__ == "__main__":
    main()
