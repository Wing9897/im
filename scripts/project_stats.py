"""Generate architecture statistics from source instead of hand-counting."""

from __future__ import annotations

import json
import re
from pathlib import Path

from fastapi.routing import APIRoute

from server.db.schema import DDL
from server.main import create_app

ROOT = Path(__file__).resolve().parents[1]


def collect_stats() -> dict[str, int]:
    app = create_app(
        start_collector=False,
        start_scheduler=False,
        serve_static=False,
    )
    routes = {
        (method, route.path)
        for route in app.routes
        if isinstance(route, APIRoute)
        for method in route.methods
        if method not in {"HEAD", "OPTIONS"}
    }
    tables = re.findall(r"CREATE TABLE IF NOT EXISTS\s+([a-z_]+)", DDL, re.IGNORECASE)
    test_files = list(ROOT.glob("server/tests/test_*.py"))
    test_files += list(ROOT.glob("web/src/**/*.test.ts"))
    test_files += list(ROOT.glob("web/src/**/*.test.tsx"))
    test_files += list(ROOT.glob("desktop/tests/*.test.ts"))
    test_files += list(ROOT.glob("tests/**/*.test.ts"))
    test_files += list(ROOT.glob("tests/**/*.test.tsx"))
    return {
        "apiRoutes": len(routes),
        "sqliteTables": len(set(tables)),
        "testFiles": len(set(test_files)),
    }


def main() -> None:
    print(json.dumps(collect_stats(), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
