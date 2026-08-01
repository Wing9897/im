# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed

- **Docs / CI hygiene:** Product version authority is **git tags** (`v*`); repo `VERSION` may lag and is never bot-committed back to `main`. Integer schema stamp / public `SCHEMA_SEMVER` are DB-contract identities and are **not** required to equal the product tag. `bump_version.py` defaults to print-only (explicit `--write` to update `VERSION`); CI keeps `--from-tags --print-only`. Package job runs `verify:desktop:full` (= `desktop_verify` only; desktop vitest stays in `quality`). Workflow triggers on `main` only. Post-deploy live check primary name: `npm run verify:deploy` (`smoke` is an alias).

## [0.1.0-beta.6] - 2026-07-31

### Notes

- **Current baseline:** schema stamp **v5** / public `schemaSemver` **0.1.0-beta.6** (wipe-only; **no** migration registry; prior stamps hard-reject → reset). Stamp / `SCHEMA_SEMVER` are **decoupled** from product release tags — they identify the DB contract, not the shipped app SemVer. Product version authority is git tags (`v*`); root `VERSION` / packages / OpenAPI / health `version` are packaging／display and may lag tags. Auth access-key scopes: `*` (full)／`read` (GET-only). Calendar HTTP under `/api/v1/calendar/*` (`items`／`imports`／`dismissals`／`user-events`); legacy `/results/calendar`、`/user-events`、`/timeline/dismissals`、`/calendar-imports/*`、`/system/schema/*` stay 404.

### Fixed

- **Desktop sidecar ASGI import:** frozen entry passes the `app` object to uvicorn (not `"server.main:app"` string import). Fixes packaged host crash `Could not import module "server.main"` that surfaced as 「Server startup cancelled」.
- **Startup error surfacing:** if the sidecar exits during first start, the shell dialog shows recent stderr instead of a generic cancel.

## [0.1.0-beta.5] - 2026-07-31

### Notes

- **Baseline at release (historical):** schema stamp **v3** / public `schemaSemver` **0.1.0-beta.5** (empty `SCHEMA_MIGRATIONS`; prior stamps hard-reject → reset). Product `VERSION` / packages / OpenAPI / health `version` = `0.1.0-beta.5`.

### Fixed

- **Desktop sidecar Missing VERSION:** PyInstaller now bundles root `VERSION` into `_internal/`; `server.version` reads `sys._MEIPASS` when frozen. Fixes packaged host startup (`RuntimeError: Missing VERSION` → shell 「伺服器啟動失敗」). `desktop_verify` full mode asserts the bundled VERSION file exists.

## [0.1.0-beta.4] - 2026-07-31

### Notes

- **Baseline at release (historical):** schema stamp **v3** / public `schemaSemver` **0.1.0-beta.4** (empty `SCHEMA_MIGRATIONS`; prior stamps hard-reject → reset). Product `VERSION` / packages / OpenAPI / health `version` = `0.1.0-beta.4`. Matrix／upgrade／reset: [`docs/ARCHITECTURE.md` Schema support matrix](docs/ARCHITECTURE.md#schema-support-matrix).
- **Docs:** index [`docs/README.md`](docs/README.md); intentional deltas [`docs/KNOWN-SIMPLIFICATIONS.md`](docs/KNOWN-SIMPLIFICATIONS.md); Agent／A2A／project [`docs/agent/assistant.md`](docs/agent/assistant.md)／[`docs/agent/a2a.md`](docs/agent/a2a.md)／[`docs/agent/project.md`](docs/agent/project.md).

### Fixed

- **Timeline / workset provenance:** Timeline calendar bars reuse Board `mergeWithCalendarOccurrences` dedupe; selecting a workset filters `user_events` by ownership `worksetId` (not expanded member provenance); Gantt span lookup supports `worksetId` for `sourceKind=workset`.

### Changed

- **Tech-debt cleanup:** unify thin intelligence/timeline source-filter wrappers; Board event fetch via `boardFetchWindows` / `fetchBoardEventsList`; shared MQTT/RSS form fields; hard-cut legacy theme panel-opacity LS migration; remove dead `tools_calendar/constants` shim; consolidate schema wipe-floor hard-reject tests; thin `useRefreshOnAnalysisEvent` suite.

## [0.1.0-beta.3] - 2026-07-31

### Notes

- **Baseline at release (historical):** schema stamp **v3** / public `schemaSemver` **0.1.0-beta.3** (empty `SCHEMA_MIGRATIONS`; prior stamps hard-reject → reset). Product `VERSION` / packages / OpenAPI / health `version` = `0.1.0-beta.3`. Matrix／upgrade／reset: [`docs/ARCHITECTURE.md` Schema support matrix](docs/ARCHITECTURE.md#schema-support-matrix).
- **Docs:** index [`docs/README.md`](docs/README.md); intentional deltas [`docs/KNOWN-SIMPLIFICATIONS.md`](docs/KNOWN-SIMPLIFICATIONS.md); Agent／A2A／project [`docs/agent/assistant.md`](docs/agent/assistant.md)／[`docs/agent/a2a.md`](docs/agent/a2a.md)／[`docs/agent/project.md`](docs/agent/project.md).

### Changed

- **Wipe-floor stamp 3 + ownership hard-cut:** empty `SCHEMA_MIGRATIONS` (DDL sole truth; prior stamps hard-reject → reset). `user_events.workset_id` is `NOT NULL DEFAULT '__user__'`; deleting a custom workset reassigns events to `__user__`. Agent / voice prefs wire only `worksetId` / `defaultWorksetId` (removed `calendarTaskId` / `defaultCalendarTaskId`). FE filter UI unified on `SourceFilterDialog` + `{ taskIds, worksetIds }`. Activity-spans add `worksetId` (`sourceKind=workset` → authoritative `worksetId`, `taskId=null`; task rows → `worksetId=null`). Board `widgetState.sourceFilters` hard-renames former `taskFilters`; CSS/testid `board-source-filter` replaces `board-task-filter`.
- **Compat-layer cleanup:** drop Legacy task-id filter adapters / flat board filter APIs; rename FE `selectedTaskIds`→`selectedSources` where it means hierarchical selection; project user events with provenance-only `taskId` + ownership `worksetId`; reject list filter `task_id=__user__` (use `workset_id`); OpenAPI types voice `sourceFilter` + assistant `defaultWorksetId`.
- **Docs / deeplink examples:** ownership and Desktop calendar import copy use `worksetId` (not `taskId=__user__` /「選任務」); apiDocs inline deep-link sample matches `desktop/calendar-import.ts`.
- **CI/CD:** Actions on Node 24 runtime majors; tag builds create GitHub Release with three-platform Desktop artifacts. (Historical note: early tag builds required the tag to equal root `VERSION`; current policy is tag authority — CI does not bot-commit `VERSION` to `main`.)

### Added

- **Builtin system workset + event ownership:** schema stamp **v3** / `schemaSemver` **0.1.0-beta.3** — `worksets.is_system` + seeded `__user__`; `user_events.workset_id`; WorksetResponse `isSystem`; user-events / agent create by `worksetId`; prefs `defaultWorksetId`. Tree filter persists `{ taskIds, worksetIds }`.
- **Worksets (工作集) ownership:** schema stamp **v2** / `schemaSemver` **0.1.0-beta.2** — `worksets` table + optional `analysis_tasks.workset_id`; CRUD `GET/POST/PUT/DELETE /api/v1/worksets`; task wire `worksetId`. (Historical note: 1→2／2→3 MigrationSteps were folded into wipe-floor stamp 3.)

## [0.1.0-beta.1] - 2026-07-29

### Notes

- **Baseline at release (historical):** schema stamp **v1** / public `schemaSemver` **0.1.0-beta.1** (product SemVer restart; empty `SCHEMA_MIGRATIONS`; legacy stamps including 2–24 hard-reject — **must reset**). Internal `PRAGMA user_version` stays int `1` (not a SemVer string). **Current** stamp／`schemaSemver`／product version: see **[0.1.0-beta.6]** above. Matrix／upgrade／reset: [`docs/ARCHITECTURE.md` Schema support matrix](docs/ARCHITECTURE.md#schema-support-matrix).
- **Docs:** index [`docs/README.md`](docs/README.md); intentional deltas [`docs/KNOWN-SIMPLIFICATIONS.md`](docs/KNOWN-SIMPLIFICATIONS.md); Agent／A2A／project [`docs/agent/assistant.md`](docs/agent/assistant.md)／[`docs/agent/a2a.md`](docs/agent/a2a.md)／[`docs/agent/project.md`](docs/agent/project.md).

### Added

- **Cross-platform Desktop packaging + GHCR:** `dist:mac`／`dist:linux`／`dist:current` alongside `dist:win`; electron-builder mac (DMG/zip) + linux (AppImage/deb). CI quality matrix on Windows／Ubuntu／macOS; package artifacts on `workflow_dispatch`／`v*` tags; `Dockerfile` + `docker-compose.yml` push server+SPA image to `ghcr.io/<owner>/<repo>` on `main`／tags／dispatch.
- **Desktop calendar import (.ics + deep link):** Packaged app registers `.ics` file association and `intelligencemonitor://calendar/import` protocol. Opening a file or link queues a draft into the shared user-event dialog (pick workset / optional `worksetId` → `POST /user-events`). First VEVENT only; not webcal/CalDAV sync.
- **Unified Desktop／CLI data root:** Default writable state (DB, `secret.key`, `sessions/`, `connection.json`) lives under the same product folder as packaged Electron userData (`%APPDATA%\Intelligence Monitor` on Windows). CLI no longer uses cwd DB or `~/.intelligence-monitor` as the default root.
- **Full reset clears secret.key + connection.json:** Settings「完全重置」／`POST /system/reset/database` and `scripts/reset_local_databases.py --apply` now delete encryption `secret.key` (and drop the in-process Fernet cache) plus Desktop `connection.json`, in addition to the database and Telegram sessions — no local runtime exceptions.
- **Product SemVer restart `0.1.0-beta.1` + schema wipe-baseline 1:** Repo `VERSION` / packages / OpenAPI / health `version` restart at `0.1.0-beta.1`. SQLite `CURRENT_SCHEMA_VERSION` collapses to integer stamp **1** with empty `SCHEMA_MIGRATIONS`. Health／schema status expose public `schemaSemver`; int `schemaVersion` remains for gate arithmetic. **Existing local databases must be reset** before reuse.
- **Baseline product surface (folded into stamp-1 DDL):** per-task analysis scheduling overrides; `analysis_mode=project` + project detail UI; `user_events.task_id`／`origin` including `project`; recurring／calendar_task modes; A2A `POST /a2a/agent`; admin password auth + device sessions + access keys; Telegram QR login; typed OpenAPI gate; Desktop notification SSE.

### Changed

- **Wire vocab hard-cut:** Project ticks write `user_events.origin=project`. Calendar item wire `source` is `recurring` only. Writers reject `RRULE:` prefix. Monitor／agent message filters accept `7d`／`30d` only.
- **Settings full reset:** Single **完全重置** control; `POST /system/reset/database` (also restarts collector); `POST /reset/runtime` removed.
- **Local reset／sessions:** `reset_local_databases.py --apply` also deletes schema `*.bak*` and Telegram sessions under data-root and legacy `~/.intelligence-monitor/sessions`. No auto-copy of session tokens into Desktop `DATA_DIR`.
- **Auth:** pairing codes and API-key→device-session login bridge removed; household uses admin username/password + device sessions／API keys for automation.
- **Docs SoT:** thin `docs/api|schema|frontend` folded into [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); index at [`docs/README.md`](docs/README.md).
- **i18n:** product chrome in `zh-Hant`／`zh-Hans`／`en`.

### Fixed

- **REST hard task delete → dismissals:** also removes matching `timeline_dismissals` for recurring prefixes.
- **Access key scopes:** Non-`*` keys gated to `/api/v1/a2a/`; `last_used_at` updated on use.
- **Auth:** invalid Bearer after a device session exists returns **401** (not 503).
- **Full／database reset on Windows:** in-place schema wipe instead of `os.remove` on a locked DB (WinError 32).
- **Full／database reset:** also deletes on-disk Telegram session files under data-root and legacy home.

### Performance

- Events `include_total=false` defaults on board map／calendar／gantt paths; retention batched deletes; weather／assistant timeouts; board stretch／map scrub hot paths.
