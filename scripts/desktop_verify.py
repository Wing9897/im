"""Desktop shell verification — daily build or packaged release artifacts.

``fast`` checks normal Web/Desktop build outputs. ``full`` includes the fast
checks plus the native sidecar, unpacked package, and installer／artifact for
the **current OS** (Windows NSIS, macOS DMG, or Linux AppImage). Neither mode
launches Electron, runs GUI E2E, nor verifies code signatures.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Literal

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from _verify_common import api, configure_stdout  # noqa: E402

configure_stdout()

ROOT = Path(__file__).resolve().parent.parent
WEB_DIST = ROOT / "web" / "dist"
DESKTOP_DIST = ROOT / "desktop" / "dist"
SERVER_DIR = ROOT / "server"
SERVER_RUNTIME_DIR = ROOT / "desktop" / "server-runtime" / "intelligence-monitor-server"
RELEASE_DIR = ROOT / "desktop" / "release"
VerificationMode = Literal["fast", "full"]


def _sidecar_binary_name() -> str:
    return "intelligence-monitor-server.exe" if sys.platform == "win32" else "intelligence-monitor-server"


def sidecar_runtime_path() -> Path:
    return SERVER_RUNTIME_DIR / _sidecar_binary_name()


def resolve_dev_frontend_dist() -> Path:
    """Mirror desktop/paths.ts resolveFrontendDistPath(devMode=True)."""
    return (ROOT / "web" / "dist").resolve()


def record(name: str, ok: bool, detail: str = "") -> None:
    mark = "PASS" if ok else "FAIL"
    suffix = f" — {detail}" if detail else ""
    print(f"[{mark}] {name}{suffix}")


def warn(name: str, detail: str) -> None:
    print(f"[WARN] {name} — {detail}")


def check_fast_paths() -> list[tuple[str, bool, str]]:
    dev_dist = resolve_dev_frontend_dist()
    index_html = dev_dist / "index.html"
    main_js = DESKTOP_DIST / "main.js"
    return [
        ("web/dist/index.html", index_html.is_file(), str(index_html)),
        ("desktop/dist/main.js", main_js.is_file(), str(main_js)),
        ("server directory", SERVER_DIR.is_dir(), str(SERVER_DIR)),
        (
            "dev frontend dist resolution",
            dev_dist == WEB_DIST.resolve(),
            f"expected={dev_dist}",
        ),
    ]


def _packaged_server_candidates() -> list[Path]:
    name = _sidecar_binary_name()
    rel = Path("resources") / "server-runtime" / "intelligence-monitor-server" / name
    candidates: list[Path] = [
        RELEASE_DIR / "win-unpacked" / rel,
        RELEASE_DIR / "linux-unpacked" / rel,
        RELEASE_DIR / "mac" / "Intelligence Monitor.app" / "Contents" / "Resources" / rel,
        RELEASE_DIR / "mac-arm64" / "Intelligence Monitor.app" / "Contents" / "Resources" / rel,
        RELEASE_DIR / "mac-x64" / "Intelligence Monitor.app" / "Contents" / "Resources" / rel,
    ]
    # electron-builder may nest under arch folders on some versions
    for unpacked in RELEASE_DIR.glob("*-unpacked"):
        candidates.append(unpacked / rel)
    return candidates


def _find_first_existing(paths: list[Path]) -> Path | None:
    for path in paths:
        if path.is_file():
            return path
    return None


def check_release_paths() -> list[tuple[str, bool, str]]:
    sidecar = sidecar_runtime_path()
    packaged = _find_first_existing(_packaged_server_candidates())

    if sys.platform == "win32":
        installers = sorted(RELEASE_DIR.glob("Intelligence Monitor Setup *.exe"))
        artifact_ok = bool(installers)
        artifact_detail = str(installers[-1] if installers else RELEASE_DIR)
        artifact_label = "Windows installer"
    elif sys.platform == "darwin":
        dmgs = sorted(RELEASE_DIR.glob("*.dmg"))
        artifact_ok = bool(dmgs)
        artifact_detail = str(dmgs[-1] if dmgs else RELEASE_DIR)
        artifact_label = "macOS DMG"
    else:
        images = sorted(RELEASE_DIR.glob("*.AppImage"))
        debs = sorted(RELEASE_DIR.glob("*.deb"))
        artifact_ok = bool(images) or bool(debs)
        pick = images or debs
        artifact_detail = str(pick[-1] if pick else RELEASE_DIR)
        artifact_label = "Linux AppImage/deb"

    return [
        ("bundled server runtime", sidecar.is_file(), str(sidecar)),
        (
            "packaged server runtime",
            packaged is not None,
            str(packaged or RELEASE_DIR),
        ),
        (artifact_label, artifact_ok, artifact_detail),
    ]


def check_paths(mode: VerificationMode) -> list[tuple[str, bool, str]]:
    checks = check_fast_paths()
    if mode == "full":
        checks.extend(check_release_paths())
    return checks


def optional_health() -> None:
    try:
        status, body = api("GET", "/api/v1/health", timeout=5)
        if status == 200 and isinstance(body, dict) and body.get("status") == "ok":
            record("server health (optional)", True)
        else:
            warn("server health (optional)", f"unexpected response status={status}")
    except Exception as exc:  # noqa: BLE001 — optional probe must not fail the script
        warn("server health (optional)", f"skipped — {exc}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mode",
        choices=("fast", "full"),
        default="fast",
        help="fast checks normal build outputs; full also requires packaged artifacts for this OS",
    )
    return parser.parse_args()


def main() -> int:
    mode: VerificationMode = parse_args().mode
    print(f"Desktop verification mode: {mode} (platform={sys.platform})")
    failures: list[str] = []
    for name, ok, detail in check_paths(mode):
        record(name, ok, detail if not ok else "")
        if not ok:
            failures.append(name)

    optional_health()

    if failures:
        print()
        print(f"{len(failures)} FAILURES: {failures}")
        if mode == "fast":
            prerequisite = "npm run build"
        elif sys.platform == "win32":
            prerequisite = "npm run dist:win"
        elif sys.platform == "darwin":
            prerequisite = "npm run dist:mac"
        else:
            prerequisite = "npm run dist:linux"
        print(f"Hint: run `{prerequisite}` first.")
        return 1

    print()
    print(f"ALL DESKTOP {mode.upper()} CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
