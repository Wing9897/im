"""Dev-only live pipeline eval: real Telegram + Gemini + Serper, no fake seed rows.

Not a product path. Implementation: ``scripts/dev/live_eval/`` (``pipeline.py`` + setup/poll/teardown).

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

import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from live_eval.pipeline import run_cli  # noqa: E402

if __name__ == "__main__":
    run_cli()
