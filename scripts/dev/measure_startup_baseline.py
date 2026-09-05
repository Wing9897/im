"""Repeatable ASGI fresh-db startup timing (optional local perf probe)."""

from __future__ import annotations

import asyncio
import statistics
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.main import create_app  # noqa: E402


async def _time_one(db_path: Path) -> float:
    app = create_app(
        db_path=str(db_path),
        start_collector=False,
        start_scheduler=False,
        serve_static=False,
    )
    t0 = time.perf_counter()
    async with app.router.lifespan_context(app):
        return (time.perf_counter() - t0) * 1000.0


async def main() -> None:
    samples: list[float] = []
    for i in range(5):
        with tempfile.TemporaryDirectory(prefix=f"im-startup-{i}-") as td:
            db_path = Path(td) / "app.db"
            samples.append(await _time_one(db_path))
    print("samples_ms=", [round(s, 1) for s in samples])
    print("median_ms=", round(statistics.median(samples), 1))
    print("min_ms=", round(min(samples), 1))
    print("max_ms=", round(max(samples), 1))


if __name__ == "__main__":
    asyncio.run(main())
