"""Live smoke test against a running server (default ``SERVICE_PORT`` / :18820).

Base URL from ``VERIFY_BASE`` / ``DESKTOP_VERIFY_BASE`` (see ``_verify_common``).
After admin register, loopback is no longer auth-exempt — set VERIFY_BEARER
or IM_ACCESS_TOKEN (device access token / full-scope API key).

Covers: health, SPA static, sources, messages, settings, LLM profiles,
tasks/analysis, and SSE realtime.

SPA static: skipped (not failed) when ``web/dist`` is absent / static is not
mounted. For a full SPA check run ``npm run build:web`` or hit Vite directly.
"""

from __future__ import annotations

import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
_ROOT = _SCRIPT_DIR.parent
for _path in (_ROOT, _SCRIPT_DIR):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))

from urllib.parse import quote  # noqa: E402

from _verify_common import (  # noqa: E402
    BASE,
    FAILURES,
    VERIFY_BEARER,
    api,
    check,
    configure_stdout,
    skip,
)

from server.db.schema_inspect import CURRENT_SCHEMA_VERSION, SCHEMA_SEMVER  # noqa: E402

configure_stdout()


def main() -> int:
    # 1. Health
    try:
        status, body = api("GET", "/api/v1/health", timeout=15)
    except urllib.error.URLError as exc:
        print(
            f"[FATAL] Cannot reach verification target {BASE}: {exc.reason}",
            file=sys.stderr,
        )
        print("Start the server or set VERIFY_BASE, then retry.", file=sys.stderr)
        return 2
    check(
        "health /api/v1/health",
        status == 200
        and isinstance(body, dict)
        and body.get("status") == "ok"
        and body.get("schemaVersion") == CURRENT_SCHEMA_VERSION
        and body.get("schemaSemver") == SCHEMA_SEMVER,
    )

    # 2. Static SPA serving (absent in `npm run dev` when web/dist is missing)
    try:
        req = urllib.request.Request(BASE + "/")
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", "replace")
        if resp.status == 200 and '<div id="root"' in html:
            check("static / serves SPA", True)
        else:
            check("static / serves SPA", False, f"status={resp.status}, missing #root")
    except urllib.error.HTTPError as exc:
        # FastAPI leaves `/` unmounted when resolve_frontend_dist() finds nothing.
        if exc.code == 404:
            skip(
                "static / serves SPA",
                "no web/dist / static not mounted — run npm run build:web or use Vite",
            )
        else:
            check("static / serves SPA", False, f"HTTP {exc.code}")
    except Exception as exc:  # noqa: BLE001 — record FAIL and continue suite
        check("static / serves SPA", False, f"{type(exc).__name__}: {exc}")

    # 3. SSE: subscribe, then ingest a message and expect messages_updated
    sse_events: list[str] = []

    def listen() -> None:
        sse_url = BASE + "/api/v1/events"
        if VERIFY_BEARER:
            sse_url += f"?token={quote(VERIFY_BEARER, safe='')}"
        req = urllib.request.Request(sse_url)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                for line_bytes in resp:
                    line = line_bytes.decode("utf-8", "replace").strip()
                    if line.startswith("event:"):
                        sse_events.append(line.split(":", 1)[1].strip())
                    if "messages_updated" in sse_events:
                        return
        except Exception:
            pass

    listener = threading.Thread(target=listen, daemon=True)
    listener.start()
    time.sleep(1.0)

    # 4. External ingestion (single + duplicate)
    message_id = f"smoke-{uuid.uuid4().hex[:12]}"
    message = {
        "channelId": "smoke-channel",
        "platform": "telegram",
        "platformMessageId": message_id,
        "content": "smoke test message",
        "senderName": "SmokeBot",
        "metadata": {"group": "smoke"},
    }
    status, body = api("POST", "/api/v1/messages", message, timeout=15)
    check("ingest message", status == 201 and body["content"] == "smoke test message")
    status, _ = api("POST", "/api/v1/messages", message, timeout=15)
    check("duplicate ingest -> 409", status == 409)

    listener.join(timeout=10)
    check("SSE messages_updated received", "messages_updated" in sse_events, f"events seen: {sse_events}")

    # 5. Messages page shows the ingested message
    status, page = api("GET", "/api/v1/messages/page?limit=10", timeout=15)
    check(
        "messages/page contains ingested",
        status == 200
        and page["totalCount"] >= 1
        and any(m["content"] == "smoke test message" for m in page["messages"]),
    )

    # 6. Channels reflect the auto-created channel
    status, channels = api("GET", "/api/v1/channels", timeout=15)
    check("channels auto-created", any(c["id"] == "telegram:smoke-channel" for c in channels))

    # 7. Settings roundtrip (LLM connection keys live on /llm/profiles, not system_config)
    status, settings = api("GET", "/api/v1/config/settings", timeout=15)
    check(
        "settings fetch",
        status == 200
        and isinstance(settings, dict)
        and "autoPauseOnRetriesExhausted" in settings
        and isinstance(settings["autoPauseOnRetriesExhausted"], bool),
    )
    check(
        "settings retired LLM keys absent",
        isinstance(settings, dict) and "llmProvider" not in settings and "ollamaModel" not in settings,
    )
    original_name = settings.get("assistantDisplayName", "")
    settings["assistantDisplayName"] = "smoke-assistant"
    status, saved = api("PUT", "/api/v1/config/settings", settings, timeout=15)
    check(
        "settings save roundtrip",
        status == 200 and saved.get("assistantDisplayName") == "smoke-assistant",
    )
    status, restored = api(
        "PUT",
        "/api/v1/config/settings",
        {"assistantDisplayName": original_name},
        timeout=15,
    )
    check(
        "settings assistantDisplayName restored",
        status == 200 and restored.get("assistantDisplayName") == original_name,
    )

    # 7b. LLM profiles (fresh DBs may have zero profiles; no forced __default__)
    status, profiles = api("GET", "/api/v1/llm/profiles", timeout=15)
    check("llm profiles list", status == 200 and isinstance(profiles, list))
    profile_id = None
    if isinstance(profiles, list):
        usable = next(
            (
                p
                for p in profiles
                if isinstance(p, dict)
                and str(p.get("model") or "").strip()
                and (
                    str(p.get("provider") or "") == "ollama"
                    and str(p.get("baseUrl") or "").strip()
                    or str(p.get("provider") or "") != "ollama"
                    and str(p.get("apiKey") or "").strip()
                )
            ),
            None,
        )
        if usable and isinstance(usable, dict):
            profile_id = usable.get("id")
            check(
                "llm profile shape",
                isinstance(usable.get("name"), str)
                and isinstance(usable.get("provider"), str)
                and isinstance(usable.get("model"), str)
                and isinstance(usable.get("staffClasses"), list)
                and "isDefault" not in usable,
            )
    if not profile_id:
        status, created_profile = api(
            "POST",
            "/api/v1/llm/profiles",
            {
                "name": "smoke ollama",
                "provider": "ollama",
                "baseUrl": "http://localhost:11434",
                "model": "llama-smoke",
                "staffClasses": ["leaderboard"],
            },
            timeout=15,
        )
        check(
            "llm profile create for empty db",
            status == 201
            and isinstance(created_profile, dict)
            and "isDefault" not in created_profile
            and created_profile.get("model") == "llama-smoke",
        )
        profile_id = created_profile.get("id") if isinstance(created_profile, dict) else None

    # 8. Task CRUD + templates
    status, templates = api("GET", "/api/v1/tasks/templates", timeout=15)
    check("templates", status == 200 and len(templates) >= 3)
    status, task = api(
        "POST",
        "/api/v1/tasks",
        {
            "name": "smoke task",
            "promptTemplate": "分析",
            "analysisMode": "leaderboard",
            "analysisTimeRange": "1d",
            "channelIds": ["telegram:smoke-channel"],
            "scheduleRrule": "FREQ=HOURLY",
            "llmProfileId": profile_id,
        },
        timeout=15,
    )
    check(
        "task create",
        bool(
            status == 201
            and isinstance(task, dict)
            and task.get("channelIds")
            and task["channelIds"][0]["id"] == "telegram:smoke-channel"
            and task.get("llmProfileId") == profile_id
        ),
    )
    task_id = task["id"] if isinstance(task, dict) else None

    status, stats = api("GET", "/api/v1/results/stats?timeRange=all", timeout=15)
    entry = next((s for s in stats if s["taskId"] == task_id), None)
    check("stats includes new task", entry is not None and entry["unanalyzedCount"] >= 1)

    status, _ = api("DELETE", f"/api/v1/tasks/{task_id}", timeout=15)
    check("task delete", status == 200)

    # 9. Sources list (empty but shaped)
    status, sources = api("GET", "/api/v1/sources", timeout=15)
    check("sources list", status == 200 and isinstance(sources, list))

    # 10. Viewer + queue + collector status
    status, viewer = api("GET", "/api/v1/viewer/status", timeout=15)
    check("viewer status", status == 200 and "collectorAlive" in viewer)
    status, queue = api("GET", "/api/v1/results/queue", timeout=15)
    check("queue", status == 200 and isinstance(queue["analysisPaused"], bool))

    status, paused = api("POST", "/api/v1/system/analysis/pause", {"paused": True}, timeout=15)
    check("analysis pause", status == 200 and paused["analysisPaused"] is True)
    status, queue = api("GET", "/api/v1/results/queue", timeout=15)
    check("queue paused", status == 200 and queue["analysisPaused"] is True)

    status, resumed = api("POST", "/api/v1/system/analysis/pause", {"paused": False}, timeout=15)
    check("analysis resume", status == 200 and resumed["analysisPaused"] is False)
    status, queue = api("GET", "/api/v1/results/queue", timeout=15)
    check("queue resumed", status == 200 and queue["analysisPaused"] is False)

    status, final_pause = api("POST", "/api/v1/system/analysis/pause", {"paused": False}, timeout=15)
    check(
        "analysis left unpaused",
        status == 200 and final_pause.get("analysisPaused") is False,
    )

    status, collector = api("GET", "/api/v1/system/collector/status", timeout=15)
    check(
        "collector status",
        status == 200 and collector["status"] in ("running", "stopped", "error"),
    )

    # 11. Structured error body
    status, err = api("DELETE", "/api/v1/sources/nope", timeout=15)
    check(
        "structured 404 error",
        status == 404 and err["error_code"] == "NOT_FOUND" and "correlation_id" in err,
    )

    print()
    if FAILURES:
        print(f"{len(FAILURES)} FAILURES: {FAILURES}")
        return 1
    print("ALL SMOKE CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
