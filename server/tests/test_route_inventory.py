"""API route inventory: frontend path literals must exist on the FastAPI app.

The subset check only catches one direction — a frontend call with no route
behind it. ``test_server_paths_have_an_in_repo_caller`` closes the other
direction: a route no client calls (``GET /api/v1/channels/with-sources`` lived
that way until the list moved to bare ``GET /api/v1/channels``).

Also guards OpenAPI drift: committed ``web/openapi/openapi.json`` paths must
be a subset of live FastAPI OpenAPI paths (live ⊇ committed).
"""

from __future__ import annotations

import ast
import json
import re
from pathlib import Path

from fastapi import FastAPI
from starlette.routing import Mount, Route

_REPO_ROOT = Path(__file__).resolve().parents[2]
_API_DIR = _REPO_ROOT / "web" / "src" / "api"
_OPENAPI_PATH = _REPO_ROOT / "web" / "openapi" / "openapi.json"
_ROUTES_DIR = _REPO_ROOT / "server" / "api" / "routes"
_ROUTES_MODULE = "server.api.routes"

#: Modules under ``server/api/routes`` that define ``router = APIRouter(...)``
#: but are intentionally left unmounted. Helpers with no router (e.g.
#: ``calendar/range.py``) never match the scan. Empty after the retired
#: occurrences module was deleted — do not allowlist leftovers.
_UNMOUNTED_ROUTER_ALLOWLIST: frozenset[str] = frozenset()

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
    assert "/api/v1/channels" in called, "caller scan is broken — it found no known frontend call"

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


def _repo_rel(path: Path) -> str:
    return path.relative_to(_REPO_ROOT).as_posix()


def _route_py_files() -> list[Path]:
    return sorted(path for path in _ROUTES_DIR.rglob("*.py") if "__pycache__" not in path.parts)


def _is_api_router_call(node: ast.AST) -> bool:
    if not isinstance(node, ast.Call):
        return False
    func = node.func
    if isinstance(func, ast.Name):
        return func.id == "APIRouter"
    return isinstance(func, ast.Attribute) and func.attr == "APIRouter"


def _assigns_router_apirouter(tree: ast.AST) -> bool:
    """True when the module binds ``router = APIRouter(...)`` (not other names)."""
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Assign)
            and _is_api_router_call(node.value)
            and any(isinstance(target, ast.Name) and target.id == "router" for target in node.targets)
        ):
            return True
        if (
            isinstance(node, ast.AnnAssign)
            and isinstance(node.target, ast.Name)
            and node.target.id == "router"
            and node.value is not None
            and _is_api_router_call(node.value)
        ):
            return True
    return False


def _parse_route_file(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"), filename=_repo_rel(path))


def _resolve_routes_module(dotted: str) -> Path | None:
    """Map ``server.api.routes[.foo.bar]`` to a file under ``server/api/routes``."""
    if dotted == _ROUTES_MODULE:
        rel_parts: tuple[str, ...] = ()
    elif dotted.startswith(_ROUTES_MODULE + "."):
        rel_parts = tuple(dotted[len(_ROUTES_MODULE) + 1 :].split("."))
    else:
        return None
    base = _ROUTES_DIR.joinpath(*rel_parts) if rel_parts else _ROUTES_DIR
    py_file = base.with_suffix(".py")
    init_file = base / "__init__.py"
    if py_file.is_file():
        return py_file
    if init_file.is_file():
        return init_file
    return None


def _file_package_parts(path: Path) -> tuple[str, ...]:
    return path.relative_to(_ROUTES_DIR).parent.parts


def _import_from_module(path: Path, node: ast.ImportFrom) -> str | None:
    if node.level == 0:
        return node.module
    parts = list(_file_package_parts(path))
    climb = node.level - 1
    if climb:
        if climb > len(parts):
            return None
        parts = parts[:-climb]
    if node.module:
        parts.extend(node.module.split("."))
    return _ROUTES_MODULE + (("." + ".".join(parts)) if parts else "")


def _imported_route_files(path: Path, tree: ast.AST) -> dict[str, Path]:
    """Local name → route module file for imports under ``server.api.routes``.

    Includes imports nested in ``all_routers()`` (lazy package loads).
    """
    mapping: dict[str, Path] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                local = alias.asname or alias.name.rsplit(".", 1)[-1]
                resolved = _resolve_routes_module(alias.name)
                if resolved is not None:
                    mapping[local] = resolved
            continue
        if not isinstance(node, ast.ImportFrom):
            continue
        source = _import_from_module(path, node)
        if source is None:
            continue
        for alias in node.names:
            if alias.name == "*":
                continue
            local = alias.asname or alias.name
            if alias.name == "router":
                resolved = _resolve_routes_module(source)
            else:
                resolved = _resolve_routes_module(f"{source}.{alias.name}") or _resolve_routes_module(source)
            if resolved is not None:
                mapping[local] = resolved
    return mapping


def _include_router_targets(tree: ast.AST, imported: dict[str, Path]) -> list[Path]:
    found: list[Path] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        if not (isinstance(func, ast.Attribute) and func.attr == "include_router"):
            continue
        if not node.args:
            continue
        arg = node.args[0]
        if isinstance(arg, ast.Attribute) and isinstance(arg.value, ast.Name) and arg.attr == "router":
            target = imported.get(arg.value.id)
            if target is not None:
                found.append(target)
        elif isinstance(arg, ast.Name):
            target = imported.get(arg.id)
            if target is not None:
                found.append(target)
    return found


def _all_routers_seed_files() -> list[Path]:
    """Files whose ``.router`` / ``*_router`` ``all_routers()`` mounts."""
    init_path = _ROUTES_DIR / "__init__.py"
    tree = _parse_route_file(init_path)
    imported = _imported_route_files(init_path, tree)
    seeds: list[Path] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Attribute) or not isinstance(node.value, ast.Name):
            continue
        if node.attr != "router" and not node.attr.endswith("_router"):
            continue
        target = imported.get(node.value.id)
        if target is not None:
            seeds.append(target)
    seen: set[Path] = set()
    unique: list[Path] = []
    for seed in seeds:
        if seed not in seen:
            seen.add(seed)
            unique.append(seed)
    return unique


def _reexported_router_files(path: Path, tree: ast.AST) -> list[Path]:
    """``from ... import router`` re-exports (tasks/_router, sources/common)."""
    found: list[Path] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.ImportFrom):
            continue
        source = _import_from_module(path, node)
        if source is None:
            continue
        for alias in node.names:
            if alias.name != "router":
                continue
            resolved = _resolve_routes_module(source)
            if resolved is not None:
                found.append(resolved)
    return found


def _mounted_router_files() -> set[Path]:
    """Route modules reached from ``all_routers()`` via include_router / re-export."""
    queued = list(_all_routers_seed_files())
    mounted: set[Path] = set()
    while queued:
        path = queued.pop()
        if path in mounted:
            continue
        mounted.add(path)
        tree = _parse_route_file(path)
        imported = _imported_route_files(path, tree)
        queued.extend(_reexported_router_files(path, tree))
        queued.extend(_include_router_targets(tree, imported))
    return mounted


def test_apirouter_modules_are_mounted_or_allowlisted():
    """Orphan ``APIRouter`` modules under routes/ cannot sit unmounted.

    OpenAPI inventory only sees routers FastAPI already included. A leftover
    like ``calendar/occurrences.py`` was 404-green while still on disk.
    Nested routers (``tasks/_router.py``, calendar leaves) count as mounted
    when an ancestor ``include_router``s them or re-exports their ``router``.
    """
    defined: dict[str, Path] = {}
    for path in _route_py_files():
        if _assigns_router_apirouter(_parse_route_file(path)):
            defined[_repo_rel(path)] = path

    assert defined, "router scan found no APIRouter modules — scan is broken"
    assert "server/api/routes/calendar/range.py" not in defined
    assert not (_ROUTES_DIR / "calendar_share" / "publish.py").exists()
    assert "server/api/routes/calendar_share/publish_routes.py" in defined
    assert "server/api/routes/calendar/window.py" in defined
    assert "server/api/routes/tasks/_router.py" in defined

    mounted = {_repo_rel(path) for path in _mounted_router_files()}
    assert "server/api/routes/calendar/window.py" in mounted
    assert "server/api/routes/tasks/_router.py" in mounted
    assert "server/api/routes/sources/common.py" in mounted

    unknown_allow = sorted(_UNMOUNTED_ROUTER_ALLOWLIST - set(defined))
    assert not unknown_allow, (
        "_UNMOUNTED_ROUTER_ALLOWLIST entries that do not define router = APIRouter(...):\n" + "\n".join(unknown_allow)
    )

    orphans = sorted(rel for rel in defined if rel not in mounted and rel not in _UNMOUNTED_ROUTER_ALLOWLIST)
    assert not orphans, (
        "APIRouter modules under server/api/routes/ are not mounted via all_routers() "
        "or an ancestor include_router. Mount them, delete them, or add to "
        "_UNMOUNTED_ROUTER_ALLOWLIST with a reason:\n" + "\n".join(orphans)
    )
