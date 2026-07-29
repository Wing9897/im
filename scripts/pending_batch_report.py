"""Read-only pending-batch breakdown against a live server on :18820.

LLM analysis failures stay as pending batches (queuedMessageCount). Use when
analysis is paused or queue depth is elevated.

Usage:
  python scripts/pending_batch_report.py
  python scripts/pending_batch_report.py --json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from _verify_common import api, configure_stdout  # noqa: E402
from reporting.pending_batches import build_pending_batch_report  # noqa: E402

configure_stdout()


def print_text(report: dict) -> None:
    print(f"analysisPaused = {report['analysisPaused']}")
    print(f"queue.pendingCount = {report['queuePendingCount']}")
    print(f"sum(per-task queuedMessageCount) = {report['perTaskQueuedMessageCountSum']}")
    print()

    tasks = report.get("tasks") or []
    if not tasks:
        print("No per-task queued batches (current version).")
        return

    print(f"{'taskName':<24} {'queued':>10}  {'unanalyzed':>10}")
    print("-" * 80)
    for row in tasks:
        print(f"{str(row['taskName'])[:24]:<24} {row['queuedMessageCount']:>10}  {row['unanalyzedCount']:>10}")
    print()
    print("Check app_logs (category=analysis) for batch errors; resume via POST /system/analysis/pause paused=false")


def main() -> int:
    parser = argparse.ArgumentParser(description="Pending batch report (read-only)")
    parser.add_argument("--json", action="store_true", help="Emit JSON instead of a table")
    args = parser.parse_args()

    report = build_pending_batch_report(api)
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print_text(report)
    return 0


if __name__ == "__main__":
    sys.exit(main())
