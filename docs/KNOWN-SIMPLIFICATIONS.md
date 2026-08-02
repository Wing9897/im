# Known Simplifications

Intentional product／ops **deltas** vs naive “full platform” expectations. Live shapes: `server/tests/test_contract_*.py` and `server/tests/test_dead_endpoints.py`. **Do not** recreate removed historical integrations unless a user-visible bug requires it.

Contract／schema／API SoT: [`ARCHITECTURE.md`](./ARCHITECTURE.md)（[API contract](./ARCHITECTURE.md#api-contract)、[Schema support matrix](./ARCHITECTURE.md#schema-support-matrix)、[Removed endpoints](./ARCHITECTURE.md#removed-endpoints)、[Scheduler](./ARCHITECTURE.md#scheduler)、[Unified event analysis](./ARCHITECTURE.md#unified-event-analysis-pipeline)、[Telegram session storage](./ARCHITECTURE.md#telegram-session-storage)）. Agent contracts: [`agent/assistant.md`](./agent/assistant.md)、[`agent/a2a.md`](./agent/a2a.md). Docs index: [`README.md`](./README.md).

## API / stats deltas

`GET /api/v1/results/stats` is dashboard-only (`TaskAnalysisStats`: `taskId` / `analyzedCount` / `unanalyzedCount` / `queuedMessageCount`). Per-task `failedBatches`／`completedBatches` are **not** on that route; viewer `GET /api/v1/viewer/stats` exposes global batch totals only (no `failedBatches`).

**Batch failure model:** see [Batch retries and auto-pause](#batch-retries-and-auto-pause). Schema／gate SoT: [`ARCHITECTURE.md` Schema support matrix](./ARCHITECTURE.md#schema-support-matrix).

## Frontend usage deltas

Dashboard maps `useTaskAnalysisStats` → `web/src/pages/dashboard/taskCardStats.ts`（待分析／排隊中／已分析）. Intelligence sort／display／page-by-page timeline／voice: [`ARCHITECTURE.md` Unified event analysis](./ARCHITECTURE.md#unified-event-analysis-pipeline); FE quirks below under [Intelligence](#intelligence--events-time-semantics).

## Prompt and analysis

- Message blocks: `[id=...][time=...][sender] content`. `intelligence_rules_version` is a version marker in the system prompt; `analysis_strategy_mode` is evidence guidance (server default `balanced`).
- **Event mode:** task `promptTemplate` = domain intent only; JSON field rules live in `EVENT_SCHEMA_INSTRUCTION` (`server/prompts/analysis.py`).
- **Web intel:** schedule tick uses `webSearchQuery` + `promptTemplate` (no local message claim); empty query/prompt completes a `skipped:` batch with SSE instead of a silent no-op.
- CJK-aware token heuristic; no `truncated_by_count` in batch metadata.

## Leaderboard

Board capped at **Top 10**; ranking is **server-side by score only** (LLM emits `topic` + `score`, no `rank`). Prompt context shows topic + score; API/DB still expose `rank` 1–10 for display. `topic_messages` are **replaced** when a batch supplies new `related_message_ids`.

## Scheduling / retention / ops routes

Scheduler SoT: [`ARCHITECTURE.md` Scheduler](./ARCHITECTURE.md#scheduler). Retention: five category TTLs (0 disables) + daily `server/scheduler/retention.py`; immediate `POST /api/v1/system/retention/run`. Ops also: `POST /api/v1/system/collector/restart`. Stamp 9 is wipe-only: no migration registry, `_data_migrations` ledger, or runtime schema-upgrade gate remains.

## Sources / accounts

Platform-first `PATCH /api/v1/accounts/{email|rss|mqtt|telegram|discord}/{account_id}`. List: unfiltered `GET /accounts` or typed `GET /accounts/{platform}`; `?platform=` → **400**. Still active: `GET /api/v1/calendar/items`. RSS／Email default poll **300s** (`poll_interval_seconds`, clamped 60–86400). Trigger history: `GET /api/v1/actions/trigger-history` (legacy `/actions/history` paths remain 404).

**Input／Process registries (in-repo, not a plugin SDK):**
- Platforms: leaf `server/domain/collector_platforms.py` → DDL CHECK + `ADAPTER_BUILDERS` + FE `domain/sources/collectorPlatforms.ts` (drift-tested).
- Modes: `AnalysisModeSpec` in `server/domain/analysis_modes.py` → derived frozensets + DDL CHECK + FE `domain/tasks/analysisModeCapabilities.ts` (drift-tested).
Still update accounts routes／OpenAPI／pipeline／UI when adding — registry is the vocabulary／capability SoT, not zero-touch hot-plug.

## Schema baseline

Pointer only — stamp / semver / wipe-floor SoT: [`ARCHITECTURE.md` Schema support matrix](./ARCHITECTURE.md#schema-support-matrix).

## Calendar / RRULE expansion

One builder (`server/calendar/normalize.py`); RRULE stored without optional `RRULE:` prefix (`server/services/task_writes.py`). Validation／expansion live in `server/calendar/rrule.py` (not under `analyzer/`).

- **Sub-day frequencies are rejected on write:** `validate_rrule` only allows `FREQ ∈ {DAILY, WEEKLY, MONTHLY, YEARLY}` (`unsupported_freq`). `SECONDLY`／`MINUTELY`／`HOURLY` (and any other FREQ) fail task create／update. Query-time expansion still snaps wall clocks and budgets dense windows for legacy／synthetic rows used in budget tests — writers never emit those freqs.
- **Desktop ICS／deep-link import:** one-shot multi-VEVENT preview and atomic commit; no webcal／CalDAV／provider OAuth or bidirectional sync. RRULE series become recurring tasks, one-time items become user events; unsupported overrides stay visible but unselectable. Public-HTTP(S)-only remote URL policy, supported RFC 5545 subset, size/event limits, and floating-time behavior: [`ARCHITECTURE.md` ICS import support](./ARCHITECTURE.md#ics-import-support-and-limits).

## Batch stats semantics (version-aware)

- Per-task `GET /api/v1/results/stats`, viewer batch counts, and `GET /api/v1/results/queue` only include batches matching each task's **current** `version` (`task_version_join`).
- `analyzedCount` counts markers only on `status='completed'` batches.
- `queuedMessageCount` sums `message_count` on `pending`／`processing` (includes retries).

### Batch retries and auto-pause

| State | Meaning |
|-------|---------|
| `queuedMessageCount` | Messages in pending/processing batches (retries included) | Dashboard「排隊中」 |
| `analysisPaused` | Global pause (manual or auto after retries exhausted) | Settings / queue API |
| `deletedBatchCount` (task mutations) | Incomplete batches removed on update/delete | Task API response |

LLM batch errors: stay `pending`, increment `retry_count`, log to `app_logs`. When `retry_count >= max_batch_retries`, `retry_count` resets to 0 and optional `autoPauseOnRetriesExhausted` pauses analysis. Operational invalidation: incomplete batches are **deleted** (markers cascade).

Ops: prefer contract tests + `npm run verify:deploy`（live check）for day-to-day checks; heavy historical eval／ops scripts are not part of the supported workflow.

## Cross-layer contract quirks (do not "fix" without updating the client)

| Topic | Detail |
|-------|--------|
| Message cursor | `GET /messages/page` → `{ timestamp, id }` |
| Log cursor | `GET /logs` → `{ time, id }` |
| Query params | snake_case: `task_id`, `cursor_time`, `range_start`, etc. |
| LLM tool arguments | **Permanent Agent-boundary tolerance:** schemas expose canonical camelCase, while `server/agent/tool_args.py` accepts selected snake_case pairs and useful semantic aliases (for example `allTime`／`all_time` and `timeRange`／`time_range = "all"`). Model-generated arguments vary, so do not hard-cut this coercion; it is not an HTTP contract |
| SSE `collector_status_changed` | payload uses `adapter_name`, `error_summary` (snake_case) |
| Error bodies | `error_code`, `correlation_id` (snake_case) |
| `GET /config/settings` | settings snapshot (camelCase); use `PUT /config/settings` to update |
| `analysisPaused` | read via settings snapshot; write via `POST /system/analysis/pause` only |
| Account URL styles | All platforms use `/{platform}/{id}/...` for platform-scoped mutations |
| Account list | `GET /accounts` → `Account[]`; typed `GET /accounts/{telegram,discord,rss,mqtt,email,http}`; `?platform=` → 400 |
| Schema stamp v9 | See [`ARCHITECTURE.md` Schema support matrix](./ARCHITECTURE.md#schema-support-matrix) and [reset procedure](./ARCHITECTURE.md#schema-v9-explicit-reset) (wipe-only, `schedule_rrule` trigger-only, `recurring_schedules`, `__user__`, `user_events.workset_id`, items) |
| Task catalog vs `top_level_only` | Shared FE catalog (`useTaskCatalogLoader`) **must NOT** pass `top_level_only` — it loads full `GET /tasks` so project detail can resolve child recurring via `parentTaskId`. Dashboard uses client-side `selectTopLevelTasks`; list API `?top_level_only=true` stays available only for other callers that want server-side hide |
| Batch diagnostics | `error_message` / token counts on queue `processingBatches` / `attentionBatches` |
| Web builds | Root `build:web` runs Vite through `build-web.mjs`; `web` package `build` also runs `tsc`. CI relies on `typecheck` |
| Timeline / board `calendar` ids | UI `viewMode:"calendar"` and board widget `"calendar"` are **layout** ids — not `analysisMode:"recurring"`. Do not rename these layout wire ids |
| Device-local browser state | UI-only state that must remain per browser／Electron profile stays in localStorage or sessionStorage: locale/theme/background, shell chrome and last path, drafts, view/filter/read state, runtime-log cache, and the stable assistant client-instance id. These are active stores, not migration bridges |
| Desktop STT / no Whisper | Electron hides mic and disables browser STT direct mode; use text input. Local Whisper / Doubao cloud STT-TTS remain unimplemented adapters only — see [`agent/assistant.md`](./agent/assistant.md) |

## Intelligence / Events time semantics

The intelligence UI treats **event time** as the user-facing clock. Preference order matches map filters: structured `startTime` → `sourceMessageTime` → `createdAt` (`getEventTimestamp` / `mapFilters`).

| Layer | Behavior |
|-------|----------|
| Frontend display / card-list filter | Server-side `start_date`/`end_date` on `/results/events`; API returns event-time order by default |
| API sort | `sort=event_time` (default): `ORDER BY COALESCE(ae.start_time, m.timestamp, ae.created_at) DESC`; `sort=analyzed_at`: `ORDER BY ae.created_at DESC` |
| API `start_date` / `end_date` | Filter on the same `COALESCE(...)` expression |
| Frontend fetch | `useIntelligenceSource` → `fetchEvents`; sends `start_date` / `end_date` from card/list `useTimeFilter` or map `timeWindow`; `sort` from toolbar / `im:intelligence:sort` |

Map mode passes its time window to the API so background sync needs fewer pages; client-side map filtering remains for live-mode display.

### Intelligence map / feed behavior

| Topic | Behavior |
|-------|----------|
| Default view mode | `im:view-mode:intelligence` defaults to `"map"` |
| Independent time filters | Card/list uses `useTimeFilter`; map uses `useMapView` `timeWindow` + Live mode — toolbar `TimeFilter` hidden in map mode |
| Map background sync | Cap: `MAP_SYNC_MAX_TOTAL_PAGES` × 200 = **1000** items; UI shows i18n `map.syncCapHint`（zh-Hant SoT：「已達地圖自動載入上限，可載入下一批或縮小時間窗」）when capped |
| Map client time filter | `useMapView` pre-parses then `filterTimedItems` after API window — intentional for live-mode rolling window |
| Map body scroll lock | `IntelligencePage` sets `document.body/html overflow: hidden` while map mode is active |
| Danmaku storage | Shared key `im:map:shared-danmaku-mode`; defaults to `"persistent"` when unset |

## Contract / drift checks

- API field shapes: `server/tests/test_contract_*.py`
- Frontend path literals vs FastAPI routes: `server/tests/test_route_inventory.py` — both directions. Server tests deliberately do **not** count as callers; genuinely external routes go in `_EXTERNAL_ONLY_PATHS`.
- Post-deploy live check: `npm run verify:deploy` (`smoke` is an alias)
- Root vitest: `tests/smoke/` + security tests
- Analysis batch failures → `app_logs` (category `analysis`) with full error JSON in `details`
- GitHub Actions: Ubuntu `quality` on PR／main; on **main** push or **`workflow_dispatch`**: next SemVer from latest `v*` tag (no bot commit to main) → win／mac／linux `package` (Desktop+CLI; `desktop_verify` only — vitest already in `quality`) → push tag + GitHub Release → GHCR.

## Security (outbound requests)

Action handlers, RSS fetches, MQTT brokers, and LLM clients call `server/outbound.py` before connecting. Hostnames are resolved and rejected when any address is non-global. RSS re-validates each redirect hop.

**Accepted limitation:** DNS rebinding between validate and TCP connect is not mitigated with IP pinning (local single-user deployments).

## Release checklist (Desktop + CLI + container)

1. Merge／push to `main` — no manual tag or VERSION commit required
2. CI: `quality` → `version` (`bump_version.py --from-tags --print-only`; no tags → `VERSION` as-is) → package×3 → release tag + GitHub Release (does **not** push commits to main)
3. Sign installers for public／store distribution (unsigned CI builds are for QA only)
4. Container: same path → `ghcr.io/<owner>/<repo>`, or locally `npm run docker:build` + `npm run verify:deploy`

## Email IMAP outbound policy

Email collectors validate `imap_host` with the same public-IP DNS policy as HTTP/MQTT outbound via `server.outbound.validate_imap_host` (default ports 993/143). Poll uses synchronous `imap-tools` inside `asyncio.to_thread`; UID cursors live in encrypted `accounts.credentials.folder_cursors`, with matching per-folder UIDVALIDITY in `folder_uidvalidities`. A missing or changed UIDVALIDITY resets only that folder's cursor.

Email channel IDs use the host-qualified shape `host:port/username/folder` (`email_channel_platform_id`). The one-shot data migration that remapped legacy `username/folder` keys was retired with a pre-wipe-floor / prior stamp; fresh installs write host-qualified keys from the start.

## Collector status: polling vs long-lived adapters

| Kind | Platforms | Initial connect failure | Runtime / poll errors |
|------|-----------|-------------------------|-------------------------|
| **Long-lived session** | Telegram, Discord, MQTT | Account → `error` / disconnected; SSE `account_status_changed` | Connect/disconnect and reconnect failures update status and broadcast SSE |
| **Poll loop** | RSS, Email (IMAP) | Validation/login failure → account `error` | **RSS:** consecutive failures (default 3) escalate to `error` + SSE. **Email:** transient poll errors retry; repeated IMAP auth failures escalate to `error` + SSE |

## Deploy verify

`npm run verify:deploy` runs `scripts/smoke.py` against a live server at `http://127.0.0.1:18820`. After admin register, set `VERIFY_BEARER` or `IM_ACCESS_TOKEN`. (`npm run smoke` is a deprecated alias.)

## Removed / not restored

Legacy Tauri migration guards were retired with the delivery slim-down and stay removed. Windows／macOS／Linux Desktop + Docker/Web are first-class delivery surfaces. Do not revive Tauri IPC.
