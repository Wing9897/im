"""Shared HTTP helpers for live verification scripts (smoke / desktop_verify).

Environment:
  VERIFY_BASE / DESKTOP_VERIFY_BASE — API base (default http://127.0.0.1:{SERVICE_PORT})
  VERIFY_BEARER / IM_ACCESS_TOKEN — Bearer after admin register (loopback not exempt)
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

# uv `package = false` — `uv run python scripts/*.py` does not install this
# repo, so put the root on sys.path before any `server.*` import.
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from server.constants import ACCESS_TOKEN_ENV, SERVICE_PORT  # noqa: E402

FAILURES: list[str] = []

_DEFAULT_BASE = f"http://127.0.0.1:{SERVICE_PORT}"
BASE = os.environ.get("VERIFY_BASE") or os.environ.get("DESKTOP_VERIFY_BASE") or _DEFAULT_BASE

# After admin register, localhost_auth_exempt is false — pass a device access
# token or full-scope API key so live verify scripts can authenticate.
VERIFY_BEARER = (os.environ.get("VERIFY_BEARER") or os.environ.get(ACCESS_TOKEN_ENV) or "").strip()

_MISSING_BEARER_HINT = (
    "\n[FATAL] Protected API returned 401 and VERIFY_BEARER / IM_ACCESS_TOKEN is not set.\n"
    "After admin register, loopback is not auth-exempt. Set one of:\n"
    "  VERIFY_BEARER=<device access token or full-scope (*) API key>\n"
    "  IM_ACCESS_TOKEN=<same>\n"
    "See README section Verify / auth (VERIFY_BEARER).\n"
)


def configure_stdout() -> None:
    reconfigure = getattr(sys.stdout, "reconfigure", None)
    if callable(reconfigure):
        reconfigure(encoding="utf-8", errors="replace")


def _fail_fast_missing_bearer(status: int) -> None:
    """Exit immediately when a protected call 401s and no Bearer was configured."""
    if status == 401 and not VERIFY_BEARER:
        print(_MISSING_BEARER_HINT, file=sys.stderr)
        raise SystemExit(2)


def api(
    method: str,
    path: str,
    body: dict | None = None,
    *,
    timeout: float = 30,
) -> tuple[int, Any]:
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if VERIFY_BEARER:
        headers["Authorization"] = f"Bearer {VERIFY_BEARER}"
    req = urllib.request.Request(
        BASE + path,
        data=data,
        method=method,
        headers=headers,
    )
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

    _fail_fast_missing_bearer(status)
    return status, payload


def check(name: str, ok: bool, detail: str = "") -> None:
    mark = "PASS" if ok else "FAIL"
    suffix = f" — {detail}" if detail and not ok else (f" ({detail})" if detail and ok else "")
    print(f"[{mark}] {name}{suffix}")
    if not ok:
        FAILURES.append(name)


def skip(name: str, detail: str = "") -> None:
    """Record a non-failure skip (e.g. SPA absent when web/dist is missing)."""
    suffix = f" — {detail}" if detail else ""
    print(f"[SKIP] {name}{suffix}")


def trending_topics_list(payload: object) -> list:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        return payload.get("items", []) or []
    return []


def assert_trending_top10(topics: list) -> tuple[bool, str]:
    """Leaderboard API returns only ranked rows, capped at Top 10."""
    if len(topics) > 10:
        return False, f"count={len(topics)} (>10)"
    if not topics:
        return True, "empty"

    ranks = [topic.get("rank") for topic in topics]
    if any(rank is None for rank in ranks):
        return False, "null rank present"

    ordered = sorted(topics, key=lambda row: int(row.get("rank") or 0))
    expected_ranks = list(range(1, len(ordered) + 1))
    actual_ranks = [int(row.get("rank") or 0) for row in ordered]
    if actual_ranks != expected_ranks:
        return False, f"ranks={actual_ranks}"

    scores = [float(row.get("score") or 0) for row in ordered]
    if scores != sorted(scores, reverse=True):
        return False, f"scores not descending: {scores}"

    return True, f"count={len(topics)}"
