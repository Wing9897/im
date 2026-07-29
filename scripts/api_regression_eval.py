"""API regression evaluation against a live server on :18820.

After admin register, loopback is not auth-exempt — set VERIFY_BEARER
or IM_ACCESS_TOKEN (device access token / full-scope API key).

Covers refactor contract fixes — not full Gemini / Telegram pipeline
(see scripts/operational_verify.py for that).
"""

from __future__ import annotations

import json
import sys
import uuid
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
_ROOT_DIR = _SCRIPT_DIR.parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))
if str(_ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(_ROOT_DIR))

from _verify_common import (  # noqa: E402
    FAILURES,
    api,
    assert_trending_top10,
    check,
    configure_stdout,
    trending_topics_list,
)

from server.tests.test_dead_endpoints import removed_endpoints  # noqa: E402

configure_stdout()


def main() -> int:
    # ── Calendar: RRULE expand smoke ──
    status, task = api(
        "POST",
        "/api/v1/tasks",
        {
            "name": "Eval Calendar",
            "promptTemplate": "n/a",
            "analysisMode": "recurring",
            "rrule": "FREQ=WEEKLY;BYDAY=MO,WE,FR",
            "eventStartTime": "2026-07-07T09:00:00Z",
            "eventEndTime": "2026-07-07T10:00:00Z",
            "channelIds": [],
        },
    )
    check("calendar task create", status == 201, str(task)[:120])
    cal_id = task["id"] if isinstance(task, dict) else ""

    status, occ = api(
        "GET",
        "/api/v1/results/calendar?range_start=2026-07-01T00:00:00Z&range_end=2026-07-31T00:00:00Z",
    )
    check(
        "calendar RRULE expand",
        status == 200 and isinstance(occ, list) and len(occ) >= 10,
        f"{len(occ) if isinstance(occ, list) else 0} occurrences",
    )

    # ── User events: live CRUD roundtrip with guaranteed cleanup ──
    user_event_id = ""
    try:
        status, user_event = api(
            "POST",
            "/api/v1/user-events",
            {
                "title": f"Eval User Event {uuid.uuid4().hex[:8]}",
                "startTime": "2026-07-18T09:00:00Z",
                "endTime": "2026-07-18T10:00:00Z",
                "body": "live CRUD regression probe",
                "location": "loopback",
            },
        )
        user_event_id = str(user_event.get("id") or "") if isinstance(user_event, dict) else ""
        check(
            "user event create",
            status == 201
            and bool(user_event_id)
            and isinstance(user_event, dict)
            and user_event.get("origin") == "manual"
            and user_event.get("source") == "user",
            str(user_event)[:160],
        )

        status, user_events = api(
            "GET",
            "/api/v1/user-events?start=2026-07-18T09:30:00Z&end=2026-07-18T09:45:00Z",
        )
        listed_event = (
            next((item for item in user_events if item.get("id") == user_event_id), None)
            if isinstance(user_events, list)
            else None
        )
        check(
            "user event overlap list",
            status == 200 and listed_event is not None,
            f"id={user_event_id or '?'}",
        )

        status, patched_event = api(
            "PATCH",
            f"/api/v1/user-events/{user_event_id}",
            {"title": "Eval User Event Updated", "endTime": None},
        )
        check(
            "user event patch",
            status == 200
            and isinstance(patched_event, dict)
            and patched_event.get("title") == "Eval User Event Updated"
            and patched_event.get("endTime") is None
            and patched_event.get("origin") == "manual",
            str(patched_event)[:160],
        )
    finally:
        if user_event_id:
            status, _ = api("DELETE", f"/api/v1/user-events/{user_event_id}")
            check("user event cleanup", status == 204, f"status={status}")

    # ── Task version bump purges old-version result rows ──
    status, _ = api(
        "PUT",
        f"/api/v1/tasks/{cal_id}",
        {
            "name": "Eval Calendar v2",
            "promptTemplate": "n/a",
            "analysisMode": "recurring",
            "rrule": "FREQ=DAILY",
            "eventStartTime": "2026-07-07T09:00:00Z",
            "channelIds": [],
        },
    )
    updated = api("GET", "/api/v1/tasks")[1]
    row = next((t for t in updated if t["id"] == cal_id), None) if isinstance(updated, list) else None
    check(
        "task version bump",
        bool(status == 200 and row and row.get("version") == 2),
        f"version={row.get('version') if row else '?'}",
    )

    _, vstats_before = api("GET", "/api/v1/viewer/stats")
    batches_before = int(vstats_before.get("totalBatches") or 0) if isinstance(vstats_before, dict) else 0

    # ── Batch ingest transaction + dedup ──
    uid = uuid.uuid4().hex[:8]
    status, batch = api(
        "POST",
        "/api/v1/messages/batch",
        {
            "messages": [
                {
                    "platform": "telegram",
                    "channel_id": f"eval-{uid}",
                    "content": f"batch {i}",
                    "platform_message_id": f"eval-{uid}-{i}",
                }
                for i in range(3)
            ]
        },
    )
    check("batch ingest", status == 200 and batch.get("count") == 3, str(batch))
    status, dup = api(
        "POST",
        "/api/v1/messages/batch",
        {
            "messages": [
                {
                    "platform": "telegram",
                    "channel_id": f"eval-{uid}",
                    "content": "dup",
                    "platform_message_id": f"eval-{uid}-0",
                }
            ]
        },
    )
    check("batch ingest dedup", status == 200 and dup.get("count") == 0, str(dup))

    # ── Stats aggregate (no N+1) ──
    status, stats = api("GET", "/api/v1/results/stats")
    check(
        "stats endpoint",
        status == 200 and isinstance(stats, list) and len(stats) >= 1,
        f"tasks={len(stats) if isinstance(stats, list) else 0}",
    )
    cal_stats = next((s for s in stats if s["taskId"] == cal_id), None) if isinstance(stats, list) else None
    check(
        "stats per-task shape",
        cal_stats is not None
        and "unanalyzedCount" in cal_stats
        and "analyzedCount" in cal_stats
        and isinstance(cal_stats.get("queuedMessageCount"), (int, float)),
        json.dumps(cal_stats, ensure_ascii=False)[:100] if cal_stats else "missing",
    )

    # ── viewer stats version-aware (batch totals must not grow after version bump) ──
    status, vstats = api("GET", "/api/v1/viewer/stats")
    batches_after = int(vstats.get("totalBatches") or 0) if isinstance(vstats, dict) else 0
    check(
        "viewer stats version-aware batches",
        status == 200 and isinstance(vstats, dict) and batches_after <= batches_before,
        f"before={batches_before} after={batches_after}",
    )

    # ── Removed endpoints stay 404/405 ──
    dead = removed_endpoints(task_id=cal_id, action_id="probe-action")
    for method, path, body in dead:
        status, _ = api(method, path, body)
        check(f"dead endpoint gone {method} {path}", status == 404 or status == 405, f"status={status}")

    # acknowledge-failed is in removed_endpoints above.

    # ── Accounts router (split modules) still works ──
    status, accounts = api("GET", "/api/v1/accounts")
    check("accounts list (split router)", status == 200 and isinstance(accounts, list))

    status, channels = api("GET", "/api/v1/channels/with-accounts")
    check("channels/with-accounts", status == 200 and isinstance(channels, list))

    # ── Schedule + trending wire shapes ──
    status, trending = api("GET", "/api/v1/results/trending")
    topics = trending_topics_list(trending)
    check("trending list", status == 200 and isinstance(trending, (list, dict)))
    ok, detail = assert_trending_top10(topics)
    check("trending top10 contract", ok, detail)

    status, schedule = api("GET", "/api/v1/results/events?has_time=1")
    check(
        "timed events list",
        status == 200 and isinstance(schedule, dict) and isinstance(schedule.get("items"), list),
    )

    # ── Pause API + retention partial save + stale pause guard ──
    status, paused = api("POST", "/api/v1/system/analysis/pause", {"paused": True})
    check("pause API sets paused", status == 200 and paused.get("analysisPaused") is True)
    _, queue = api("GET", "/api/v1/results/queue")
    check("queue reflects paused", isinstance(queue, dict) and queue.get("analysisPaused") is True)

    status, resumed = api("POST", "/api/v1/system/analysis/pause", {"paused": False})
    check("pause API resumes", status == 200 and resumed.get("analysisPaused") is False)
    _, queue = api("GET", "/api/v1/results/queue")
    check("queue reflects resumed", isinstance(queue, dict) and queue.get("analysisPaused") is False)

    status, snapshot = api("GET", "/api/v1/config/settings")
    check(
        "settings snapshot fetch",
        status == 200
        and isinstance(snapshot, dict)
        and "retentionMessagesDays" in snapshot
        and "retentionAnalysisDays" in snapshot
        and "retentionLeaderboardDays" in snapshot
        and "retentionLeaderboardDays" in snapshot,
    )
    check(
        "settings autoPauseOnRetriesExhausted present",
        isinstance(snapshot, dict)
        and "autoPauseOnRetriesExhausted" in snapshot
        and isinstance(snapshot["autoPauseOnRetriesExhausted"], bool),
    )
    original_retention = snapshot.get("retentionMessagesDays") if isinstance(snapshot, dict) else None
    if isinstance(snapshot, dict) and original_retention is not None:
        probe_days = "88" if original_retention != "88" else "89"
        status, saved_ret = api(
            "PUT",
            "/api/v1/config/settings",
            {"retentionMessagesDays": probe_days},
        )
        check(
            "retention partial save",
            status == 200
            and saved_ret.get("retentionMessagesDays") == probe_days
            and "dataRetentionDays" not in saved_ret,
            str(saved_ret)[:80] if isinstance(saved_ret, dict) else str(saved_ret),
        )
        again = api("GET", "/api/v1/config/settings")[1]
        check(
            "retention persisted",
            isinstance(again, dict)
            and again.get("retentionMessagesDays") == probe_days
            and "dataRetentionDays" not in again,
        )
        api("PUT", "/api/v1/config/settings", {"retentionMessagesDays": original_retention})

    api("POST", "/api/v1/system/analysis/pause", {"paused": True})
    paused_snap = api("GET", "/api/v1/config/settings")[1]
    if isinstance(paused_snap, dict):
        stale = {**paused_snap, "analysisPaused": False}
        saved_stale = api("PUT", "/api/v1/config/settings", stale)[1]
        check(
            "PUT settings ignores stale analysisPaused",
            saved_stale.get("analysisPaused") is True,
        )
        again_paused = api("GET", "/api/v1/config/settings")[1]
        check(
            "analysisPaused still true after stale PUT",
            isinstance(again_paused, dict) and again_paused.get("analysisPaused") is True,
        )
    api("POST", "/api/v1/system/analysis/pause", {"paused": False})

    api("DELETE", f"/api/v1/tasks/{cal_id}")

    print()
    if FAILURES:
        print(f"EVAL: {len(FAILURES)} FAILURES — {FAILURES}")
        return 1
    print("EVAL: ALL API REGRESSION CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
