"""Login IM calendar-share to a local IntelligenceCalendar and seed demo subscriptions.

Talks to a **running** IM API (default ``http://127.0.0.1:18820``) and IC
(``http://127.0.0.1:8787``). Does not change the public default origin
``https://subscribe.devents.tech`` — it only POSTs a session with the local URL.

  uv run python scripts/dev/seed_calendar_share_local_demo.py

Env:
  VERIFY_BASE / DESKTOP_VERIFY_BASE — IM API base
  VERIFY_BEARER / IM_ACCESS_TOKEN — after admin register (loopback not exempt)
  IC_BASE — IntelligenceCalendar origin (default http://127.0.0.1:8787)

IC local users are created with ``.venv\\Scripts\\python.exe -m app create-user``
(e.g. ``--handle Wing --password change-me``); there is no ``scripts/seed_demo_calendars.py``.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any
from urllib.parse import quote

_DEV_DIR = Path(__file__).resolve().parent
_SCRIPTS_DIR = _DEV_DIR.parent
_ROOT = _SCRIPTS_DIR.parent
for _path in (_ROOT, _SCRIPTS_DIR):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))

from _verify_common import BASE, VERIFY_BEARER, configure_stdout  # noqa: E402

from server.worksets_const import SYSTEM_WORKSET_ID  # noqa: E402

IC_BASE = (os.environ.get("IC_BASE") or "http://127.0.0.1:8787").rstrip("/")
HANDLE = "Wing"
PASSWORD = "change-me"
LOCAL_IC_URL = "http://127.0.0.1:8787"
SUBSCRIBE_PATHS = (
    "DemoPub/Open",
    "DemoPub/Busy",
    "DemoPub/Closed",
    "DemoPub/ClosedBusy",
)
DEV_SEED_WORKSET = "ws-dev-seed-demo"
DEV_SEED_SLUG = "ws-dev-seed-demo"
GENERAL_SLUG = "general"
PUBLISH_TIMEOUT_S = 90.0


def _print(message: str) -> None:
    print(message)


def _skip(step: str, detail: str) -> None:
    _print(f"[SKIP] {step} — {detail}")


def _ok(step: str, detail: str = "") -> None:
    suffix = f" — {detail}" if detail else ""
    _print(f"[OK] {step}{suffix}")


def _request(
    method: str,
    url: str,
    body: dict[str, Any] | None = None,
    *,
    timeout: float = 30,
    bearer: str = "",
) -> tuple[int, Any]:
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    token = bearer or VERIFY_BEARER
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            status = resp.status
            payload: Any = json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        status = exc.code
        try:
            payload = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            payload = raw.decode("utf-8", "replace") if raw else None
    return status, payload


def _im(method: str, path: str, body: dict[str, Any] | None = None, *, timeout: float = 30) -> tuple[int, Any]:
    return _request(method, BASE + path, body, timeout=timeout)


def _error_detail(payload: Any) -> str:
    if isinstance(payload, dict):
        code = payload.get("error_code") or ""
        message = payload.get("message") or payload.get("detail") or ""
        if isinstance(message, list):
            message = json.dumps(message, ensure_ascii=False)
        bits = [str(part) for part in (code, message) if part]
        if bits:
            return " ".join(bits)
    return repr(payload)


def probe_im() -> bool:
    try:
        status, payload = _im("GET", "/api/v1/health", timeout=8)
    except urllib.error.URLError as exc:
        _skip(
            "IM health",
            f"cannot reach {BASE} ({exc.reason}). "
            "Start IM (`npm run dev` / `uv run python -m server`) then re-run this script.",
        )
        return False
    if status != 200:
        detail = _error_detail(payload)
        extra = f": {detail}" if detail else ""
        _skip("IM health", f"HTTP {status} from {BASE}{extra}")
        return False
    secrets_ready = True
    if isinstance(payload, dict) and "secretsReady" in payload:
        secrets_ready = bool(payload.get("secretsReady"))
    if not secrets_ready:
        err = payload.get("secretsError") if isinstance(payload, dict) else None
        extra = f" ({err})" if err else ""
        _skip(
            "calendar-share demo",
            "IM secretsReady=false — business APIs are paused. "
            "Open IM and POST /api/v1/system/rotate-secrets with the household admin username/password "
            "(data-preserving; do not full-reset). Then re-run this script." + extra,
        )
        return False
    _ok("IM health", BASE)
    return True


def probe_ic() -> bool:
    url = f"{IC_BASE}/api/recommend"
    try:
        status, payload = _request("GET", url, timeout=8)
    except urllib.error.URLError as exc:
        _skip(
            "IC health",
            f"cannot reach {IC_BASE} ({exc.reason}). "
            "Start IC (`python -m app serve` in IntelligenceCalendar) then re-run this script.",
        )
        return False
    if status >= 500:
        _skip("IC health", f"HTTP {status} from {url}: {_error_detail(payload)}")
        return False
    _ok("IC health", IC_BASE)
    return True


def login_session() -> bool:
    status, payload = _im(
        "POST",
        "/api/v1/calendar-share/session",
        {"baseUrl": LOCAL_IC_URL, "handle": HANDLE, "password": PASSWORD},
        timeout=30,
    )
    if status == 401 and not VERIFY_BEARER:
        _skip(
            "calendar-share session",
            "IM returned 401 (localhost auth bypass is off after admin register). "
            "Set VERIFY_BEARER or IM_ACCESS_TOKEN to a device access token or * API key, then re-run.",
        )
        return False
    if status == 401:
        _skip("calendar-share session", f"IM auth failed: {_error_detail(payload)}")
        return False
    code = payload.get("error_code") if isinstance(payload, dict) else ""
    if status == 503 and code == "SECRETS_UNAVAILABLE":
        _skip(
            "calendar-share session",
            "IM encryption key cannot decrypt stored secrets. "
            "Use rotate-secrets in the IM UI (household admin password), then re-run this script.",
        )
        return False
    if status in (502, 503):
        _skip(
            "calendar-share session",
            f"IC unreachable via IM ({_error_detail(payload)}). "
            f"Start IntelligenceCalendar on {LOCAL_IC_URL} then re-run this script.",
        )
        return False
    if status != 200:
        _skip("calendar-share session", f"HTTP {status}: {_error_detail(payload)}")
        return False
    connected = isinstance(payload, dict) and payload.get("connected") is True
    handle = payload.get("handle") if isinstance(payload, dict) else ""
    if not connected:
        _skip("calendar-share session", f"not connected: {_error_detail(payload)}")
        return False
    _ok("calendar-share session", f"handle={handle} baseUrl={LOCAL_IC_URL}")
    return True


def subscribe_demo_calendars() -> None:
    status, listed = _im("GET", "/api/v1/calendar-share/subscriptions", timeout=30)
    if status != 200:
        _skip("list subscriptions", f"HTTP {status}: {_error_detail(listed)}")
        return
    existing: set[str] = set()
    items = listed.get("items") if isinstance(listed, dict) else None
    if isinstance(items, list):
        for row in items:
            if isinstance(row, dict) and row.get("handle") and row.get("slug"):
                existing.add(f"{row['handle']}/{row['slug']}")
    for path in SUBSCRIBE_PATHS:
        if path in existing:
            _ok(f"subscribe {path}", "already subscribed")
            continue
        status, payload = _im(
            "POST",
            "/api/v1/calendar-share/subscriptions",
            {"path": path},
            timeout=30,
        )
        if status == 200:
            _ok(f"subscribe {path}")
            continue
        _skip(f"subscribe {path}", f"HTTP {status}: {_error_detail(payload)}")


def _publish(workset_id: str, slug: str) -> bool:
    encoded = quote(workset_id, safe="")
    status, payload = _im(
        "PUT",
        f"/api/v1/calendar-share/publish/{encoded}",
        {
            "slug": slug,
            "publicVisibility": "public",
            "grants": [],
            "syncNow": True,
        },
        timeout=PUBLISH_TIMEOUT_S,
    )
    if status == 404:
        _skip(f"publish {workset_id}", f"workset not found ({_error_detail(payload)})")
        return False
    if status != 200:
        _skip(f"publish {workset_id}", f"HTTP {status}: {_error_detail(payload)}")
        return False
    last_error = payload.get("lastError") if isinstance(payload, dict) else None
    if last_error:
        _skip(f"publish {workset_id}", f"saved but lastError={last_error}")
        return False
    _ok(
        f"publish {workset_id}",
        f"slug={slug} syncNow lastSyncAt={payload.get('lastSyncAt') if isinstance(payload, dict) else ''}",
    )
    return True


def publish_demo_workset() -> None:
    if _publish(DEV_SEED_WORKSET, DEV_SEED_SLUG):
        return
    _print(f"Trying builtin workset {SYSTEM_WORKSET_ID} (slug {GENERAL_SLUG})…")
    _publish(SYSTEM_WORKSET_ID, GENERAL_SLUG)


def main() -> int:
    configure_stdout()
    _print(f"IM={BASE} IC={IC_BASE} handle={HANDLE} password={PASSWORD}")
    if not probe_im():
        return 0
    ic_up = probe_ic()
    if not ic_up:
        _skip("calendar-share demo", "IC is down; session/subscribe/publish skipped.")
        return 0
    if not login_session():
        return 0
    subscribe_demo_calendars()
    publish_demo_workset()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
