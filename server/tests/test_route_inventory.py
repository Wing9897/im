"""API route inventory: frontend path literals must exist on the FastAPI app.

The subset check only catches one direction — a frontend call with no route
behind it. ``test_server_paths_have_an_in_repo_caller`` closes the other
direction: a route no client calls (``GET /api/v1/channels`` lived that way for
a while, kept alive only by its own contract test).

Also guards OpenAPI drift: committed ``web/openapi/openapi.json`` paths must
be a subset of live FastAPI OpenAPI paths (live ⊇ committed).
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from fastapi import FastAPI
from starlette.routing import Mount, Route

_REPO_ROOT = Path(__file__).resolve().parents[2]
_API_DIR = _REPO_ROOT / "web" / "src" / "api"
_OPENAPI_PATH = _REPO_ROOT / "web" / "openapi" / "openapi.json"

_PATH_LITERAL = re.compile(r"""['"`](/api/v1/[^'"`]+)['"`]""")
_TEMPLATE_SEGMENT = re.compile(r"\$\{[^}]+\}")

#: Any ``/api/v1/...`` fragment, quoted or not, for the caller-side scan.
_PATH_FRAGMENT = re.compile(r"/api/v1/[A-Za-z0-9_\-/{}.$()]*")
#: A path tail appended to a base constant, e.g. ``` `${VOICE_FIRED_PATH}/claim` ```.
_PATH_TAIL = re.compile(r"""['"`](?:\$\{[^{}]+\})?(/[A-Za-z0-9_\-/{}.$()]*)['"`]""")

#: Trees whose path literals count as "someone calls this route".
_CALLER_TREES = (
    (_REPO_ROOT / "web" / "src", (".ts", ".tsx")),
    (_REPO_ROOT / "desktop", (".ts", ".js", ".mjs", ".cjs")),
    (_REPO_ROOT / "scripts", (".py", ".mjs")),
)
_CALLER_SKIP_DIRS = frozenset({"node_modules", "dist", "build", "generated", "out", "release"})

#: Routes with no in-repo caller on purpose. Server tests do NOT count as callers
#: — a route whose only user is its own contract test is exactly what this guards.
#:
#: Protocol ASGI mounts that are **not** FastAPI/OpenAPI routes (e.g. Streamable
#: HTTP ``/api/v1/mcp`` beyond ``GET /status``) are out of scope here — see
#: ``docs/agent/mcp.md``. Only OpenAPI-listed ``/api/v1`` paths are checked.
_EXTERNAL_ONLY_PATHS = frozenset(
    {
        # Third-party agents (OpenClaw / Hermes) post here with an access key.
        "/api/v1/a2a/agent",
        # External HTTP ingest (Webhook / scripts); no in-app UI caller.
        "/api/v1/messages/batch",
    }
)

# Paths that must stay documented after Wave A API refresh.
# ``/api/v1/mcp/status`` is the OpenAPI surface; Streamable HTTP protocol traffic
# is an ASGI mount and intentionally absent from openapi.json.
_REQUIRED_OPENAPI_PREFIXES = (
    "/api/v1/setup/",
    "/api/v1/access-keys",
    "/api/v1/a2a/",
    "/api/v1/calendar/imports/",
    "/api/v1/mcp",
    "/api/v1/sources",
    "/api/v1/ui-prefs/",
)


def _normalize_frontend_path(raw: str) -> str | None:
    # Query strings are not FastAPI route paths (e.g. `/forecast?${params}`).
    path = raw.split("?", 1)[0]
    # Doc comments sometimes use wildcards (`/api/v1/ui-prefs/*`) — not real calls.
    if "*" in path:
        return None
    path = _TEMPLATE_SEGMENT.sub("{id}", path)
    # Collapse duplicate slashes from string concat edge cases.
    while "//" in path:
        path = path.replace("//", "/")
    return path


def _collect_frontend_paths() -> set[str]:
    paths: set[str] = set()
    for file_path in sorted(_API_DIR.rglob("*.ts")):
        if file_path.name.endswith(".test.ts"):
            continue
        if "generated" in file_path.parts:
            continue
        text = file_path.read_text(encoding="utf-8")
        for match in _PATH_LITERAL.finditer(text):
            normalized = _normalize_frontend_path(match.group(1))
            if normalized is not None:
                paths.add(normalized)
    return paths


def _collect_server_paths(app: FastAPI) -> set[str]:
    found: set[str] = set()

    def walk(routes, prefix: str = "") -> None:
        for route in routes:
            if isinstance(route, Mount):
                walk(route.routes, prefix + route.path)
            elif isinstance(route, Route):
                full = (prefix + route.path).replace("//", "/")
                found.add(full)

    walk(app.routes)
    return found


def _path_matches(server_paths: set[str], frontend_path: str) -> bool:
    if frontend_path in server_paths:
        return True
    fe_parts = frontend_path.split("/")
    for server_path in server_paths:
        sp_parts = server_path.split("/")
        if len(fe_parts) != len(sp_parts):
            continue
        if all(
            fe == sp or (fe.startswith("{") and sp.startswith("{")) for fe, sp in zip(fe_parts, sp_parts, strict=True)
        ):
            return True
    return False


def _normalize_caller_path(raw: str) -> str | None:
    """Like :func:`_normalize_frontend_path`, minus punctuation the scan swept up."""
    normalized = _normalize_frontend_path(raw.rstrip("./"))
    return normalized.rstrip("/") or None if normalized else None


def _caller_files() -> list[Path]:
    files: list[Path] = []
    for root, suffixes in _CALLER_TREES:
        if not root.is_dir():
            continue
        for path in sorted(root.rglob("*")):
            if not path.is_file() or path.suffix not in suffixes:
                continue
            if _CALLER_SKIP_DIRS & set(path.parts) or ".test." in path.name or path.name.endswith(".d.ts"):
                continue
            files.append(path)
    return files


def _called_paths() -> set[str]:
    """Every route path some client in the repo can reach.

    Callers build paths two ways: one literal, or a base constant plus a tail
    (``` `${VOICE_FIRED_PATH}/claim` ```). Both are resolved per file, so a tail
    only ever combines with a base from the same module.
    """
    called: set[str] = set()
    for path in _caller_files():
        text = path.read_text(encoding="utf-8", errors="ignore")
        bases = {
            normalized
            for normalized in (_normalize_caller_path(m.group(0)) for m in _PATH_FRAGMENT.finditer(text))
            if normalized is not None
        }
        tails = {m.group(1) for m in _PATH_TAIL.finditer(text)}
        for base in bases:
            called.add(base)
            for tail in tails:
                combined = _normalize_caller_path(base + tail)
                if combined is not None:
                    called.add(combined)
    return called


def test_server_paths_have_an_in_repo_caller(app: FastAPI):
    """Every ``/api/v1`` route is reachable from web, desktop, or scripts.

    Tests are excluded from the caller scan on purpose: a route kept alive only
    by the suite that covers it is dead code with a green checkmark.
    """
    called = _called_paths()
    assert "/api/v1/channels/with-sources" in called, "caller scan is broken — it found no known frontend call"

    uncalled = sorted(
        path
        for path in app.openapi()["paths"]
        if path.startswith("/api/v1/") and path not in _EXTERNAL_ONLY_PATHS and not _path_matches(called, path)
    )
    assert not uncalled, (
        "Server routes with no caller in web/desktop/scripts — delete them, or add to "
        "_EXTERNAL_ONLY_PATHS with the reason:\n" + "\n".join(uncalled)
    )


def test_frontend_api_paths_exist_on_server(app: FastAPI):
    frontend_paths = _collect_frontend_paths()
    assert "/api/v1/messages/{id}/media" in frontend_paths
    # Nested modules under web/src/api/** (e.g. sources/) must be scanned.
    assert any(p.startswith("/api/v1/") for p in frontend_paths)
    server_paths = _collect_server_paths(app)
    missing = sorted(p for p in frontend_paths if not _path_matches(server_paths, p))
    assert not missing, "Frontend paths missing on server:\n" + "\n".join(missing)


def test_live_openapi_paths_contain_committed(app: FastAPI):
    """live FastAPI OpenAPI paths ⊇ committed openapi.json paths."""
    assert _OPENAPI_PATH.is_file(), f"Missing committed OpenAPI: {_OPENAPI_PATH}"
    committed = json.loads(_OPENAPI_PATH.read_text(encoding="utf-8"))
    committed_paths = set(committed.get("paths", {}))
    live_paths = set(app.openapi().get("paths", {}))
    assert not any(path.startswith("/api/v1/accounts") for path in live_paths)
    assert not any(path.startswith("/api/v1/accounts") for path in committed_paths)

    missing_from_live = sorted(committed_paths - live_paths)
    assert not missing_from_live, "Committed OpenAPI paths missing from live FastAPI:\n" + "\n".join(missing_from_live)

    for prefix in _REQUIRED_OPENAPI_PREFIXES:
        assert any(p.startswith(prefix) or p == prefix.rstrip("/") for p in committed_paths), (
            f"Committed OpenAPI missing required prefix {prefix!r}; run npm run openapi:generate"
        )
        assert any(p.startswith(prefix) or p == prefix.rstrip("/") for p in live_paths), (
            f"Live FastAPI missing required prefix {prefix!r}"
        )
