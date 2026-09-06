[繁體中文](TECH.md) | [简体中文](TECH.zh-Hans.md) | [English](TECH.en.md)

# Technical notes

This is an overview of how the running code is put together: processes, data ownership, and who may call which APIs. Product usage is in the [README](../README.en.md). MCP / A2A tool contracts and error codes live in [`agent/mcp.md`](agent/mcp.md) and [`agent/a2a.md`](agent/a2a.md) — this page does not copy the full tool list.

## 1. What runs

Single household, local-first. Not a multi-tenant SaaS. No built-in TLS.

| Process | Role |
|---------|------|
| `web/` | React SPA (Vite). Vite serves it in development; the API process serves the built files in production. |
| FastAPI | REST `/api/v1/*` and SSE `/api/v1/events`. Default port **18820** (`SERVICE_PORT` in `server/constants.py`), bind `0.0.0.0` (override with `INTELLIGENCE_MONITOR_HOST`). |
| Desktop (Electron) | Shell. `host` starts the API locally; `client` only opens a remote origin. |

Unauthenticated health: `GET /api/v1/health` returns the product version, integer `schemaVersion`, and `schemaSemver`. Product SemVer (git tags / `VERSION`) is **decoupled** from the schema stamp.

Default data root (SQLite, `secret.key`, Telegram sessions):

- Windows: `%APPDATA%/Intelligence Monitor`
- macOS: `~/Library/Application Support/Intelligence Monitor`
- Linux: `$XDG_CONFIG_HOME/Intelligence Monitor` or `~/.config/Intelligence Monitor`

Override with `INTELLIGENCE_MONITOR_DATA_DIR` / `INTELLIGENCE_MONITOR_DB`. Source credentials are Fernet-encrypted with `{DATA_DIR}/secret.key`. See [`SECURITY.md`](../SECURITY.md).

## 2. Schema stamp 7

Source of truth: `server/db/schema_inspect.py`.

| Constant | Current value |
|----------|----------------|
| `CURRENT_SCHEMA_VERSION` / `PRAGMA user_version` | **7** |
| `SCHEMA_FLOOR` | **7** (same as current) |
| `SCHEMA_SEMVER` | `1.6.0` (public string; not `user_version`) |
| Production `SCHEMA_MIGRATIONS` | **empty** (`server/db/schema_steps.py`) |

Empty databases are created from the domain DDL aggregated in `server/db/schema.py`, then stamped 7. Additive walk only runs when `FLOOR <= version < CURRENT`. Floor equals current today, so that path is empty.

Startup classification:

- Stamps **1–6**: fingerprint is not the current baseline → **hard-reject**. Copy the file out of the data directory, then reset. There is no automatic 1→7 upgrade.
- Stamp **> 7** (including retired 27 / 45): treated as a **future stamp** → hard-reject with “update the application”; reset is a last resort.
- Corrupt or lookalike fingerprints → hard-reject and print the reset command.
- Startup **never** silently deletes or rebuilds a database.

Reset (stop Desktop / `npm run dev` first):

```bash
uv run python scripts/reset_local_databases.py --apply
```

The script removes known `intelligence_monitor.db` files and their `-wal` / `-shm` sidecars only. It does not remove backups, `secret.key`, sessions, or `connection.json`. A fresh current-stamp schema appears on the next start. `--apply` does **not** seed demo data.

## 3. Data scope

Most business rows carry `workset_id`. The builtin system row is `__general__` (UI “General”, `is_system=1`). Creating an analysis task, handwritten event, or item without a workset lands on `__general__`. Deleting a custom workset reassigns child rows to `__general__` first; `__general__` itself cannot be deleted or renamed.

Sidebar **Worksets** is `/worksets`. **Tasks** is a **standalone route** `/tasks` (not a tab under a workset; the old `/tasks/worksets/…` helper is gone). `GET /api/v1/tasks` returns analysis tasks only. Recurring calendar series live on `/api/v1/calendar/recurring`, not as rows in the task catalog.

Worksets also have:

- `notify_enabled` — default reminder for that workset
- `external_enabled` — whether MCP / A2A can see that workset’s intel / messages / items (default on; all-off is fail-closed). Calendar “My schedule” is household-scoped and does not use this flag. The built-in assistant is not constrained by it.

## 4. Auth

One household admin (`admin_accounts` singleton), device sessions, and revocable access keys.

**Device session** (browser after login): full read/write. Created by `POST /api/v1/setup/register` (first run) or `/login`; refresh via `/setup/refresh`. The Account page lists and revokes devices.

**Access keys** (`Authorization: Bearer <key>`; SSE may use `?token=`):

| Scope | Use |
|-------|-----|
| `*` | Full read/write. **Required** for MCP / A2A. The Account UI only mints `*`. |
| `read` | GET / HEAD / OPTIONS only. Existing read-only keys still work; the list shows “read-only”. |

There are no finer access-key scopes (for example `calendar:write`). Retired `a2a:agent` / `a2a:events` are rejected on create. Capability groups `mcp_cap_*` and `worksets.external_enabled` are **not** key scopes.

**Localhost:** `localhost_auth_exempt` applies only on a fresh install, before the first `POST /api/v1/setup/register`. Once an admin exists, loopback is no longer exempt; every request needs a session or a key. Password reset without the old password is loopback-only and requires `resetPasswordForLocal: true` in Desktop `connection.json` (the server clears it after success).

**MCP / A2A protocol surfaces:** household access key only, `*` required, **device sessions rejected**; the loopback exemption does **not** apply. Ordinary REST (including `GET /api/v1/mcp/status`) may still use a session.

Remote writes that are neither a full key nor a session get 403 on most paths (except `/api/v1/viewer/`). No built-in TLS; put a reverse proxy in front if you expose the port to the public internet.

## 5. HTTP API prefixes

Business APIs live under `/api/v1`. Main groups (OpenAPI / source are authoritative for the full list):

| Prefix | Role |
|--------|------|
| `/api/v1/setup` | First-run register, login, refresh, devices, password |
| `/api/v1/worksets` | Worksets |
| `/api/v1/tasks` | Analysis tasks (including templates, activity-spans, agent-ticks) |
| `/api/v1/sources`, `/messages`, `/channels` | Sources and collected messages |
| `/api/v1/results` | Intel events (map / list; separate from the calendar window) |
| `/api/v1/calendar` | `window` (analysis + handwritten + recurring + item reminders), `user-events`, `recurring`, `imports` (ICS preview / commit), dismissals, importance, holidays |
| `/api/v1/items` | Items |
| `/api/v1/agent/chat` | Human assistant (local tool loop) |
| `/api/v1/a2a/agent` | A2A natural-language façade (`POST`) |
| `/api/v1/mcp` | MCP Streamable HTTP (ASGI mount, **not** in OpenAPI) |
| `/api/v1/mcp/status` | Settings connection probe (session is enough) |
| `/api/v1/calendar-share/*` | Public-hub proxy (see §6) |
| `/api/v1/access-keys` | Access keys |
| `/api/v1/events` | SSE |
| `/api/v1/health` | Health (no auth) |

MCP: `{API origin}/api/v1/mcp`, Streamable HTTP only. OpenClaw config example and the tool allowlist are in [`agent/mcp.md`](agent/mcp.md). A2A request shape and error codes are in [`agent/a2a.md`](agent/a2a.md). Both share the same base tool handlers; MCP does **not** run an LLM loop on this server. Writes set `user_events.origin` to `mcp` or `a2a` (clients cannot forge that).

Household master switches: `system_config.mcp_enabled` and `a2a_enabled` (default on, independent). Off → 403 on that HTTP surface. The same `mcp_cap_*` groups filter MCP `list_tools` / `call_tool` and the A2A internal tool loop.

## 6. Calendar share

Optional. Default public origin: `https://subscribe.devents.tech` (`DEFAULT_BASE_URL` in `server/calendar_share/constants.py`). That hub is a separate public service, **not** this product’s brand or a required component.

This app is only a proxy: the UI calls `/api/v1/calendar-share/*` and **never** talks to the hub directly. Proxy paths cover session / timezone / profile, publish (push / unpublish per workset), subscriptions, and search. Tokens and the auto-sync interval live in local `system_config`. Stamp 7’s `calendar_share_publish` table no longer depends on the old household auto-sync cache columns.

Hub traffic has its own rate limit; the prefix skips some of the general `/api/v1` HTTP limits. There is no bidirectional CalDAV / OAuth sync. One-shot ICS import is local (`/api/v1/calendar/imports/preview` and `/commit`).

## 7. Desktop connection

Electron `userData/connection.json` (same filename convention as `{DATA_DIR}/connection.json` on the server):

| Field | Meaning |
|-------|---------|
| `mode` | `host` (default: run the API locally) or `client` (use `serverUrl`) |
| `serverUrl` | Required in client mode; must be `http` / `https`. Invalid values fall back to host |
| `resetPasswordForLocal` | Default `false`. When `true`, loopback may use the forgot-password rescue; the server clears it after success |

Shell load URL: host + production → `localhost:18820`; host + dev → Vite; client → `serverUrl`. All get `?desktop=1`. Legacy LAN-bind flags are dropped on read.

## 8. Recurring series / RRULE

Keep these two lines apart:

**Calendar recurring series** (`recurring_schedules`, edited in My schedule / `/api/v1/calendar/recurring`): RFC 5545 RRULE body (no `RRULE:` prefix). Expanded **at query time only** (`GET /api/v1/calendar/window` and assistant / MCP calendar tools). They **never trigger AI analysis** and never create analysis scheduler jobs. Pause with `is_active`; a hard delete removes the series row.

**Analysis-task schedules** (`analysis_tasks`, Tasks / `/api/v1/tasks`): named presets — 10-second, hourly, daily, weekly, custom seconds. Internally a RRULE-**shaped** string may be stored so APScheduler can compute the next run. That string is trigger-only and is **not** expanded into the month window. Analysis tasks do not use a calendar RRULE to schedule AI.

Calendar FREQ allows DAILY / WEEKLY / MONTHLY / YEARLY. ICS import is preview / commit; expansion runs in Python, not React.

## 9. Explicit non-goals

The current design does not do (or has removed):

- SQLite FTS5 / vector RAG. Message and intel search is `LIKE` on title / body.
- MCP stdio, SSE-only legacy transport, or a local-subprocess MCP server.
- Fine-grained access-key scopes (capability groups ≠ key scopes).
- Wrapping analysis tasks, sources, notifications, or LLM settings as MCP tools.
- A dedicated A2A events CRUD façade, or a server-side multi-turn A2A session store.
- In-app TLS / certificate management.
- Bidirectional external calendars (webcal / CalDAV / OAuth). One-shot ICS and the optional hub proxy are the exceptions.
- Cloud STT or local Whisper as the default speech stack.
- Silently deleting the database to “upgrade” stamps 1–6.

## 10. Related contracts

| Document | Contents |
|----------|----------|
| [README](../README.en.md) | Intro and usage ([繁體](../README.md), [简体](../README.zh-Hans.md)) |
| [`agent/mcp.md`](agent/mcp.md) | Streamable HTTP, auth, capability groups, tool allowlist |
| [`agent/a2a.md`](agent/a2a.md) | `POST /api/v1/a2a/agent`, liaison slot, error codes |
| [`SECURITY.md`](../SECURITY.md) | Threat model and vulnerability reporting |
| This page in other languages | [繁體中文](TECH.md), [简体中文](TECH.zh-Hans.md) |
