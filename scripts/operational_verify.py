"""Operational API verification for production-like environments.

Auth (after admin register, loopback is not exempt):
  VERIFY_BEARER / IM_ACCESS_TOKEN — device access token or full-scope API key.
  Tip: copy the Bearer from Electron DevTools / login response Authorization.

Flags:
  OPERATIONAL_STRICT=1 — optional production checks become hard failures
    (e.g. no leaderboard task → B1 FAIL instead of SKIP).
  OPERATIONAL_LEADERBOARD_TASK=<id> — pin B1 to a specific leaderboard task.
  Without STRICT, checks that need Telegram, Gemini, or seeded task data SKIP.
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from _verify_common import (  # noqa: E402
    STRICT,
    api,
    assert_trending_top10,
    configure_stdout,
    trending_topics_list,
)
from reporting.pending_batches import warn_pending_batch_breakdown  # noqa: E402

configure_stdout()

RESULTS: list[tuple[str, bool, str, bool]] = []  # name, ok, detail, skipped

LEADERBOARD_TASK = os.environ.get("OPERATIONAL_LEADERBOARD_TASK", "")


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return max(1, int(raw))
    except ValueError:
        return default


BATCH_START_WAIT = _env_int("OPERATIONAL_BATCH_START_WAIT", 90)
BATCH_COMPLETE_WAIT = _env_int("OPERATIONAL_BATCH_COMPLETE_WAIT", 120)
POLL_INTERVAL = _env_int("OPERATIONAL_POLL_INTERVAL", 3)


def resolve_leaderboard_task() -> str | None:
    """Pick a leaderboard task with trending data, or any with batch history."""
    if LEADERBOARD_TASK:
        _, trending = api("GET", f"/api/v1/results/trending?task_id={LEADERBOARD_TASK}&limit=1", timeout=60)
        if trending_topics_list(trending):
            return LEADERBOARD_TASK

    _, tasks = api("GET", "/api/v1/tasks", timeout=60)
    if not isinstance(tasks, list):
        return LEADERBOARD_TASK or None

    leaderboard_ids = [t["id"] for t in tasks if t.get("analysisMode") == "leaderboard"]
    for task_id in leaderboard_ids:
        _, trending = api("GET", f"/api/v1/results/trending?task_id={task_id}&limit=1", timeout=60)
        if trending_topics_list(trending):
            return task_id

    _, stats = api("GET", "/api/v1/results/stats?time_range=all", timeout=60)
    if isinstance(stats, list):
        for task_id in leaderboard_ids:
            row = next((s for s in stats if s["taskId"] == task_id), None)
            if row and int(row.get("analyzedCount") or 0) > 0:
                return task_id

    return None


def record(name: str, ok: bool, detail: str = "") -> None:
    RESULTS.append((name, ok, detail, False))
    mark = "PASS" if ok else "FAIL"
    suffix = f" — {detail}" if detail and not ok else (f" ({detail})" if detail and ok else "")
    print(f"[{mark}] {name}{suffix}")


def skip(name: str, detail: str) -> None:
    RESULTS.append((name, True, detail, True))
    print(f"[SKIP] {name} — {detail}")


def warn(name: str, detail: str) -> None:
    print(f"[WARN] {name} — {detail}")


def require(ok: bool, name: str, detail: str = "") -> bool:
    if ok:
        record(name, True, detail)
        return True
    if STRICT:
        record(name, False, detail)
        return False
    skip(name, detail or "not available in this environment")
    return False


def main() -> int:
    RESULTS.clear()

    _, health = api("GET", "/api/v1/health", timeout=60)
    record("health ok", health.get("status") == "ok")

    _, collector = api("GET", "/api/v1/system/collector/status", timeout=60)
    tg = next((a for a in collector.get("adapters", []) if a["name"] == "telegram"), {})
    require(
        tg.get("connected") is True,
        "telegram connected",
        f"status={collector.get('status')}",
    )

    _, ai = api("GET", "/api/v1/system/ai-engine/status", timeout=60)
    require(
        ai.get("status") == "available",
        "gemini available",
        ai.get("provider", ""),
    )

    _, page = api("GET", "/api/v1/messages/page?limit=3", timeout=60)
    total = page.get("totalCount", 0)
    if total > 100:
        record("messages flowing", True, f"total={total}")
        recent = page.get("messages", [{}])[0]
        require(
            recent.get("platform") == "telegram",
            "recent telegram message",
            recent.get("channelName", "")[:40],
        )
    else:
        require(False, "messages flowing", f"total={total}")

    lb_task = resolve_leaderboard_task()
    if not lb_task:
        # STRICT → FAIL; otherwise SKIP (same require() semantics as other optional checks).
        require(
            False,
            "B1 trending topics exist",
            "no leaderboard task with trending data — create one or set OPERATIONAL_LEADERBOARD_TASK",
        )
        require(False, "B1 cross-batch history", "no leaderboard task available")
    else:
        _, trending = api("GET", f"/api/v1/results/trending?task_id={lb_task}&limit=20", timeout=60)
        topics = trending_topics_list(trending)
        if topics:
            ok, detail = assert_trending_top10(topics)
            record(
                "B1 trending top10 contract",
                ok,
                detail if not ok else f"task={lb_task[:8]}… {detail}",
            )
            record("B1 trending topics exist", True, f"task={lb_task[:8]}… count={len(topics)}")
            topic_id = topics[0]["id"]
            _, msgs = api("GET", f"/api/v1/results/trending/{topic_id}/messages", timeout=60)
            msg_list = msgs if isinstance(msgs, list) else msgs.get("messages", [])
            record("B1 topic_messages load", isinstance(msg_list, list), f"topic={topics[0].get('title', '')[:30]}")
        else:
            require(False, "B1 trending topics exist", f"task={lb_task}")

        _, viewer_stats = api("GET", "/api/v1/viewer/stats", timeout=60)
        completed = int(viewer_stats.get("completedBatches") or 0) if isinstance(viewer_stats, dict) else 0
        require(
            completed >= 2,
            "B1 cross-batch history",
            f"task={lb_task[:8]}… viewerCompletedBatches={completed}",
        )

    # B2: analysis may still be writing — short-poll before declaring empty.
    events_poll_deadline = time.monotonic() + 60
    items: list = []
    events: dict | list | None = None
    while True:
        _, events = api("GET", "/api/v1/results/events?limit=200", timeout=60)
        items = events.get("items", []) if isinstance(events, dict) else []
        if items or time.monotonic() >= events_poll_deadline:
            break
        time.sleep(5)
    if items:
        total = events.get("totalCount") if isinstance(events, dict) else len(items)
        record("B2 events exist", True, f"total={total}")
        geocoded = [
            item
            for item in items
            if item.get("latitude") not in (None, 0, 0.0) and item.get("longitude") not in (None, 0, 0.0)
        ]
        require(
            len(geocoded) >= 1,
            "B2 geocoded coordinates",
            f"geocoded={len(geocoded)}/{len(items)}",
        )
    else:
        require(False, "B2 events exist", "no event-mode results in DB after ~60s poll")

    for path, key in [
        ("/api/v1/viewer/status", "collectorAlive"),
        ("/api/v1/results/queue", "analysisPaused"),
        ("/api/v1/results/events?has_time=1", None),
        ("/api/v1/accounts", None),
    ]:
        status, body = api("GET", path, timeout=60)
        ok = status == 200 and (key is None or key in (body if isinstance(body, dict) else {}))
        record(f"endpoint {path}", ok, f"status={status}")

    _, analysis_snapshot = api("GET", "/api/v1/results/queue", timeout=60)
    original_analysis_paused = bool(
        analysis_snapshot.get("analysisPaused") if isinstance(analysis_snapshot, dict) else False
    )
    print(f"[MUTATION] analysis pause state will be changed temporarily (original={original_analysis_paused})")

    try:
        status, body = api("POST", "/api/v1/system/analysis/pause", {"paused": False}, timeout=60)
        record("analysis resume", status == 200 and body.get("analysisPaused") is False)

        time.sleep(2)
        _, queue = api("GET", "/api/v1/results/queue", timeout=60)
        record("analysis unpaused", queue.get("analysisPaused") is False)

        batch_started = False
        if ai.get("status") == "available" and not queue.get("analysisPaused"):
            deadline = time.monotonic() + BATCH_START_WAIT

            def _processing() -> bool:
                nonlocal queue, batch_started
                _, queue = api("GET", "/api/v1/results/queue", timeout=60)
                if queue.get("processingBatches"):
                    batch_started = True
                    return True
                return False

            while time.monotonic() < deadline:
                if _processing():
                    break
                time.sleep(POLL_INTERVAL)
        if batch_started:
            record("gemini batch triggered", True, str(queue.get("processingBatches")))
            batch_id = queue["processingBatches"][0].get("id", "?")
            complete_deadline = time.monotonic() + BATCH_COMPLETE_WAIT
            completed = False
            while time.monotonic() < complete_deadline:
                _, queue = api("GET", "/api/v1/results/queue", timeout=60)
                if not queue.get("processingBatches"):
                    completed = True
                    break
                time.sleep(POLL_INTERVAL)
            record("gemini batch completed", completed, f"batch={batch_id}")
        else:
            require(
                False,
                "gemini batch triggered",
                f"no batch within {BATCH_START_WAIT}s (paused, no pending work, or AI unavailable)",
            )

        status, body = api("POST", "/api/v1/system/analysis/pause", {"paused": True}, timeout=60)
        _, queue = api("GET", "/api/v1/results/queue", timeout=60)
        record(
            "analysis pause",
            status == 200 and body.get("analysisPaused") is True and queue.get("analysisPaused") is True,
        )

        print("[MUTATION] collector restart will interrupt and reconnect active collectors")
        status, _ = api("POST", "/api/v1/system/collector/restart", timeout=60)
        time.sleep(3)
        _, collector = api("GET", "/api/v1/system/collector/status", timeout=60)
        record("collector restart", status == 200 and collector.get("status") == "running")
    finally:
        status, body = api(
            "POST",
            "/api/v1/system/analysis/pause",
            {"paused": original_analysis_paused},
            timeout=60,
        )
        _, queue = api("GET", "/api/v1/results/queue", timeout=60)
        record(
            "analysis pause restored",
            status == 200
            and body.get("analysisPaused") is original_analysis_paused
            and queue.get("analysisPaused") is original_analysis_paused,
            f"analysisPaused={original_analysis_paused}",
        )

    _, queue_final = api("GET", "/api/v1/results/queue", timeout=60)
    if isinstance(queue_final, dict):
        pending_count = int(queue_final.get("pendingCount") or 0)
        analysis_paused = bool(queue_final.get("analysisPaused"))
        if analysis_paused and pending_count > 10:
            warn_pending_batch_breakdown(api, pending_count, analysis_paused, warn=warn)

    _, task_stats = api("GET", "/api/v1/results/stats", timeout=60)
    if isinstance(task_stats, list) and task_stats:
        sample = task_stats[0]
        record(
            "stats queuedMessageCount field",
            isinstance(sample, dict) and isinstance(sample.get("queuedMessageCount"), (int, float)),
            str(sample.get("queuedMessageCount")),
        )

    fails = [n for n, ok, _, skipped in RESULTS if not ok and not skipped]
    skipped_names = [n for n, _, _, skipped in RESULTS if skipped]
    print()
    if skipped_names:
        print(f"{len(skipped_names)} SKIPPED: {skipped_names}")
    if fails:
        print(f"{len(fails)} FAILURES: {fails}")
        return 1
    print("ALL OPERATIONAL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
