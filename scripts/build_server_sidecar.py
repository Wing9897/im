"""Build the self-contained backend used by the Electron installer.

Must run on the **target OS** (PyInstaller does not cross-compile): Windows
produces ``intelligence-monitor-server.exe``; macOS／Linux produce
``intelligence-monitor-server``. Output: ``desktop/server-runtime/``.
"""

from __future__ import annotations

import shutil
from pathlib import Path

import PyInstaller.__main__
from PyInstaller.utils.hooks import collect_submodules

ROOT = Path(__file__).resolve().parents[1]
DIST_DIR = ROOT / "desktop" / "server-runtime"
WORK_DIR = ROOT / "build" / "pyinstaller-server"


def main() -> None:
    shutil.rmtree(DIST_DIR, ignore_errors=True)
    shutil.rmtree(WORK_DIR, ignore_errors=True)
    server_modules = collect_submodules(
        "server",
        filter=lambda name: not name.startswith("server.tests"),
    )
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
            "--exclude-module=server.tests",
            *(f"--hidden-import={name}" for name in server_modules),
            "--collect-all=uvicorn",
            "--collect-all=sse_starlette",
            "--collect-all=telethon",
            "--collect-all=feedparser",
            "--collect-all=imap_tools",
        ]
    )


if __name__ == "__main__":
    main()
