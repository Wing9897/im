"""Live pipeline eval: real Telegram + Gemini + Serper, no fake seed rows.

**Dev-only** — not a product path. Invoked via ``scripts/dev/live_eval_pipeline.py``.

Split: ``setup.py`` (preflight / tasks), ``poll.py`` (wait / items), ``teardown.py``
(deactivate / reports). Shared HTTP and state live in ``common.py``.

Environment:
  VERIFY_BASE / DESKTOP_VERIFY_BASE — API base (default http://127.0.0.1:18820)
  VERIFY_BEARER / IM_ACCESS_TOKEN — full-scope (*) API key from 帳戶

Usage:
  uv run python scripts/dev/live_eval_pipeline.py              # full loop
  uv run python scripts/dev/live_eval_pipeline.py --apply
  uv run python scripts/dev/live_eval_pipeline.py --wait
  uv run python scripts/dev/live_eval_pipeline.py --items
  uv run python scripts/dev/live_eval_pipeline.py --deactivate
  uv run python scripts/dev/live_eval_pipeline.py --serper-only
"""

from __future__ import annotations

import argparse
import sys
import urllib.error
from pathlib import Path
from typing import Any

_PKG_DIR = Path(__file__).resolve().parent
_DEV_DIR = _PKG_DIR.parent
_SCRIPTS_DIR = _DEV_DIR.parent
_ROOT = _SCRIPTS_DIR.parent
for _path in (_ROOT, _SCRIPTS_DIR, _DEV_DIR):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))

from live_eval.common import (  # noqa: E402
    SERPER_TASK_PREFIX,
    SERPER_WAIT_SECONDS,
    SERVER_DOWN_ZH,
    TASK_PREFIX,
    WAIT_SECONDS,
    die,
    load_state,
)
from live_eval.poll import create_items_via_assistant, wait_and_eval, wait_serper_eval  # noqa: E402
from live_eval.setup import apply_serper_task, apply_tasks, preflight  # noqa: E402
from live_eval.teardown import (  # noqa: E402
    deactivate_live_eval_tasks,
    print_report,
    print_serper_report,
)


def _require_state() -> dict[str, Any]:
    state = load_state()
    if not state:
        die("沒有 .live_eval_state.json，請先跑不帶旗標的完整流程或 --apply。")
    return state


def main() -> int:
    parser = argparse.ArgumentParser(description="Live pipeline eval (Telegram + Gemini + Serper)")
    parser.add_argument("--apply", action="store_true", help="只建/更新 [live-eval] 任務")
    parser.add_argument("--wait", action="store_true", help="只等待並讀取產出")
    parser.add_argument("--items", action="store_true", help="只跑助理 items.create")
    parser.add_argument("--deactivate", action="store_true", help="停用 [live-eval] 任務")
    parser.add_argument("--serper-only", action="store_true", help="只建並等待 [live-eval-serper] 網搜任務")
    parser.add_argument("--wait-seconds", type=int, default=None)
    args = parser.parse_args()
    flags = [args.apply, args.wait, args.items, args.deactivate, args.serper_only]
    full = not any(flags)

    if args.serper_only:
        wait_seconds = args.wait_seconds if args.wait_seconds is not None else SERPER_WAIT_SECONDS
        print("[serper-only] pausing competing [live-eval] tasks")
        deactivate_live_eval_tasks(TASK_PREFIX)
        state = preflight()
        apply_serper_task(state)
        eval_body = wait_serper_eval(state, seconds=wait_seconds)
        deactivated = deactivate_live_eval_tasks(SERPER_TASK_PREFIX)
        print_serper_report(state, eval_body, deactivated)
        return 0

    wait_seconds = args.wait_seconds if args.wait_seconds is not None else WAIT_SECONDS

    if full or args.apply:
        state = preflight()
        apply_tasks(state)
        if args.apply and not full:
            print_report(state, None, None, None)
            return 0
    else:
        state = _require_state()

    eval_body = None
    items_result = None
    deactivated = None

    if full or args.wait:
        eval_body = wait_and_eval(state, seconds=wait_seconds)

    if full or args.items:
        items_result = create_items_via_assistant(state)

    if full or args.deactivate:
        deactivated = deactivate_live_eval_tasks()

    print_report(state, eval_body, items_result, deactivated)
    return 0


def run_cli() -> None:
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except urllib.error.URLError as exc:
        die(f"{SERVER_DOWN_ZH}\n原因：{exc.reason}")


if __name__ == "__main__":
    run_cli()
