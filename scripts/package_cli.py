"""Package the headless server binary (CLI) for GitHub Release.

CLI is the same entry as ``python -m server`` / the ``intelligence-monitor``
console script in ``pyproject.toml``. The PyInstaller onedir produced by
``scripts/build_server_sidecar.py`` is that binary (also used as the Desktop
sidecar). This script zips it for distribution without Electron.

Requires a prior sidecar build under ``desktop/server-runtime/``.
Output: ``dist/cli/intelligence-monitor-cli-<os>-<arch>.zip``.
"""

from __future__ import annotations

import platform
import sys
import zipfile
from pathlib import Path

from server.constants import SERVICE_PORT

ROOT = Path(__file__).resolve().parents[1]
SERVER_RUNTIME = ROOT / "desktop" / "server-runtime" / "intelligence-monitor-server"
OUT_DIR = ROOT / "dist" / "cli"
VERSION_FILE = ROOT / "VERSION"


def _os_label() -> str:
    if sys.platform == "win32":
        return "windows"
    if sys.platform == "darwin":
        return "macos"
    return "linux"


def _arch_label() -> str:
    machine = platform.machine().lower()
    if machine in ("x86_64", "amd64"):
        return "x64"
    if machine in ("aarch64", "arm64"):
        return "arm64"
    return machine or "unknown"


def _binary_name() -> str:
    return "intelligence-monitor-server.exe" if sys.platform == "win32" else "intelligence-monitor-server"


def main() -> int:
    version = VERSION_FILE.read_text(encoding="utf-8").strip() if VERSION_FILE.is_file() else "unknown"
    binary = SERVER_RUNTIME / _binary_name()
    if not binary.is_file():
        print(f"Missing sidecar binary: {binary}", file=sys.stderr)
        print("Hint: run `uv run python scripts/build_server_sidecar.py` first.", file=sys.stderr)
        return 1
    internal = SERVER_RUNTIME / "_internal"
    if not internal.is_dir():
        print(f"Missing sidecar _internal dir: {internal}", file=sys.stderr)
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    # Drop stale zips for this OS so CI upload globs stay unambiguous.
    for stale in OUT_DIR.glob(f"intelligence-monitor-cli-{_os_label()}-*.zip"):
        stale.unlink(missing_ok=True)

    archive_name = f"intelligence-monitor-cli-{_os_label()}-{_arch_label()}.zip"
    archive_path = OUT_DIR / archive_name
    if archive_path.exists():
        archive_path.unlink()

    readme = (
        f"Intelligence Monitor CLI (headless server) {version}\n"
        f"\n"
        f"Same entry as `python -m server` / `intelligence-monitor`.\n"
        f"Unpack, then run:\n"
        f"  ./{_binary_name()}\n"
        f"\n"
        f"Default bind: 0.0.0.0:{SERVICE_PORT}\n"
        f"Data root: INTELLIGENCE_MONITOR_DATA_DIR (or OS product userData folder).\n"
        f"This zip is the PyInstaller onedir also used as the Desktop sidecar.\n"
    )

    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("README.txt", readme)
        for path in SERVER_RUNTIME.rglob("*"):
            if path.is_file():
                arcname = Path("intelligence-monitor-server") / path.relative_to(SERVER_RUNTIME)
                zf.write(path, arcname.as_posix())

    size_mb = archive_path.stat().st_size / (1024 * 1024)
    print(f"Wrote {archive_path} ({size_mb:.1f} MiB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
