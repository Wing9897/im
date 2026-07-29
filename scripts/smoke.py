"""Live smoke test against a running server on :18820.

After admin register, loopback is no longer auth-exempt — set VERIFY_BEARER
or IM_ACCESS_TOKEN (device access token / full-scope API key).

Covers: health, SPA static, accounts, messages, settings, tasks/analysis,
sources, and SSE realtime.

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
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

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

configure_stdout()


def main() -> int:
    # 1. Health
    status, body = api("GET", "/api/v1/health", timeout=15)
    check("health /api/v1/health", status == 200 and body["status"] == "ok")

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
        "channel_id": "smoke-channel",
        "platform": "telegram",
        "platform_message_id": message_id,
        "content": "smoke test message",
        "sender_name": "SmokeBot",
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
    status, channels = api("GET", "/api/v1/channels/with-accounts", timeout=15)
    check("channels auto-created", any(c["id"] == "telegram:smoke-channel" for c in channels))

    # 7. Settings roundtrip (with teardown)
    status, settings = api("GET", "/api/v1/config/settings", timeout=15)
    check("settings fetch", status == 200 and "llmProvider" in settings)
    check(
        "settings autoPauseOnRetriesExhausted present",
        isinstance(settings, dict)
        and "autoPauseOnRetriesExhausted" in settings
        and isinstance(settings["autoPauseOnRetriesExhausted"], bool),
    )
    original_model = settings.get("ollamaModel")
    settings["ollamaModel"] = "smoke-model"
    status, saved = api("PUT", "/api/v1/config/settings", settings, timeout=15)
    check("settings save roundtrip", status == 200 and saved["ollamaModel"] == "smoke-model")
    if original_model is not None:
        status, restored = api(
            "PUT",
            "/api/v1/config/settings",
            {"ollamaModel": original_model},
            timeout=15,
        )
        check(
            "settings ollamaModel restored",
            status == 200 and restored.get("ollamaModel") == original_model,
        )

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
            "analysisTimeRange": "24h",
            "channelIds": ["telegram:smoke-channel"],
            "scheduleType": "hourly",
        },
        timeout=15,
    )
    check("task create", status == 201 and task["channelIds"][0]["id"] == "telegram:smoke-channel")
    task_id = task["id"]

    status, stats = api("GET", "/api/v1/results/stats?time_range=all", timeout=15)
    entry = next((s for s in stats if s["taskId"] == task_id), None)
    check("stats includes new task", entry is not None and entry["unanalyzedCount"] >= 1)

    status, _ = api("DELETE", f"/api/v1/tasks/{task_id}", timeout=15)
    check("task delete", status == 200)

    # 9. Accounts list (empty but shaped)
    status, accounts = api("GET", "/api/v1/accounts", timeout=15)
    check("accounts list", status == 200 and isinstance(accounts, list))

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
        status == 200 and collector["status"] in ("running", "stopped", "error", "starting"),
    )

    # 11. Structured error body
    status, err = api("DELETE", "/api/v1/accounts/nope", timeout=15)
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
