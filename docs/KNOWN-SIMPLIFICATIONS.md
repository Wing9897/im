# Known Simplifications

Intentional product／ops **deltas** vs naive “full platform” expectations. Live shapes: `server/tests/test_contract_*.py` and `server/tests/test_dead_endpoints.py`. **Do not** recreate removed historical integrations unless a user-visible bug requires it.

SoT: [`ARCHITECTURE.md`](./ARCHITECTURE.md)＋[`README.md`](./README.md). Agent: [`agent/assistant.md`](./agent/assistant.md)、[`agent/a2a.md`](./agent/a2a.md)。

## API / stats deltas

`GET /api/v1/results/stats` is dashboard-only (`TaskAnalysisStats`: `taskId` / `analyzedCount` / `unanalyzedCount` / `queuedMessageCount`). Per-task `failedBatches`／`completedBatches` are **not** on that route; viewer `GET /api/v1/viewer/stats` exposes global batch totals only (no `failedBatches`).

**Batch failure model:** see [Batch retries and auto-pause](#batch-retries-and-auto-pause). Schema／gate SoT: [`ARCHITECTURE.md` Schema support matrix](./ARCHITECTURE.md#schema-support-matrix).

## Frontend usage deltas

Dashboard maps `useTaskAnalysisStats` → `web/src/pages/dashboard/taskCardStats.ts`（待分析／排隊中／已分析）. Intelligence sort／display／page-by-page timeline／voice: [`ARCHITECTURE.md` Unified event analysis](./ARCHITECTURE.md#unified-event-analysis-pipeline); FE quirks below under [Intelligence](#intelligence--events-time-semantics).

**Viewer** (`/viewer/*`) is a **secondary read-only projection** of live task／batch／status — not a second control plane. Prefer the main app for edits and ops.

## Prompt and analysis

- Message blocks: `[id=...][time=...][sender] content`. `analysis_strategy_mode` is evidence guidance (server default `balanced`). Prompt revision correlation is via git / prompt files — not a `system_config` tag.
- **`intel_event` mode:** task `promptTemplate` = domain intent only; JSON field rules live in `EVENT_SCHEMA_INSTRUCTION` (`server/prompts/analysis.py`).
- **Agent (`analysis_mode=agent`):** unified tick (`agent_tick` → `AgentRuntime` + `build_agent_base_prompt` / `AgentTaskSpec`). Triggers: message cursor drain, message threshold, or schedule. Caps control calendar read/write and web search (force-search for web_scout preset). Search routing shared with assistant (`WebSearchExecutionService.tool_search`／native); provider result cap **8** (`MAX_COUNT`) vs assistant tool default **5**. Assistant master switch does **not** gate ticks. Failures: one in-fire retry → `completed`+`error_message` + `record_batch_failure` + SSE (`retrying: true`); streak to `max_batch_retries` deactivates **that** task (not global pause). Details: `server/scheduler/agent_tick.py`.
- CJK-aware token heuristic; no `truncated_by_count` in batch metadata.

## Leaderboard

Board capped at **Top 10**; ranking is **server-side by score only** (LLM emits `topic` + `score`, no `rank`). Prompt context shows topic + score; API/DB still expose `rank` 1–10 for display. `topic_messages` are **replaced** when a batch supplies new `related_message_ids`.

## Scheduling / retention / ops routes

Scheduler／stamp-23 wipe-only: [`ARCHITECTURE.md`](./ARCHITECTURE.md#scheduler). Retention TTLs + `POST /api/v1/system/retention/run`; ops `POST /api/v1/system/collector/restart`.

## Sources

Platform-first `PATCH /api/v1/sources/{email|rss|mqtt|telegram|discord}/{source_id}`. List: unfiltered `GET /api/v1/sources` or typed `GET /api/v1/sources/{platform}`; `?platform=` → **400**. Still active: `GET /api/v1/calendar/items`. RSS／Email default poll **300s** (`poll_interval_seconds`, clamped 60–86400). Trigger history: `GET /api/v1/actions/trigger-history` (legacy `/actions/history` paths remain 404).

**FE board kit:** shared list/card/layout hooks live under `web/src/pages/sources/board/` (`SourceCard*`, `SourceTabLayout`, `useSourceListTab*`, …). Platform folders (`rss/`／`telegram/`／…) stay in place — not a whole-tree Sources rewrite.

**Input／Process registries (in-repo, not a plugin SDK):**
- Platforms: leaf `server/domain/collector_platforms.py` → DDL CHECK + `ADAPTER_BUILDERS` + FE `domain/sources/collectorPlatforms.ts` (drift-tested).
- Modes: `AnalysisModeSpec` in `server/domain/analysis_modes.py` → derived frozensets + DDL CHECK + FE `domain/tasks/analysisModeCapabilities.ts` (drift-tested).
Still update sources routes／OpenAPI／pipeline／UI when adding — registry is the vocabulary／capability SoT, not zero-touch hot-plug.

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
| Query params | camelCase only (`taskId`, `rangeStart`, …); HTTP snake_case dual-read **removed** — see [`ARCHITECTURE.md` Wire conventions](./ARCHITECTURE.md#wire-conventions). Thin `server/api/query_aliases.qalias` is the **camel-only Query helper — keep** (not worth dissolving into per-route `Query(alias=...)` noise) |
| LLM tool arguments | **Permanent Agent-boundary tolerance:** schemas expose canonical camelCase, while `server/agent/tool_args.py` accepts selected snake_case pairs and useful semantic aliases (for example `allTime`／`all_time` and `timeRange`／`time_range = "all"`). Model-generated arguments vary, so do not hard-cut this coercion; it is not an HTTP contract |
| SSE `collector_status_changed` | payload uses `adapter_name`, `error_summary` (snake_case) |
| Error bodies | `error_code`, `correlation_id` (snake_case) |
| `GET /config/settings` | settings snapshot (camelCase); use `PUT /config/settings` to update |
| `analysisPaused` | read via settings snapshot; write via `POST /system/analysis/pause` only |
| Source URL styles | All platforms use `/api/v1/sources/{platform}/{id}/...` for platform-scoped mutations (retired `/api/v1/accounts*` stay 404) |
| Source list | `GET /api/v1/sources` → `Source[]`; typed `GET /api/v1/sources/{telegram,discord,rss,mqtt,email,http}`; `?platform=` → 400 |
| Schema stamp v23 | See [`ARCHITECTURE.md` Schema support matrix](./ARCHITECTURE.md#schema-support-matrix) and [reset procedure](./ARCHITECTURE.md#schema-v23-explicit-reset) (wipe-only floor, domain DDL aggregate, `sources`, `source_channels`, `messages.source_id`; `SCHEMA_SEMVER` `0.1.0-beta.24`) |
| Task catalog vs `top_level_only` | Shared FE catalog (`useTaskCatalogLoader`) **must NOT** pass `top_level_only` — it loads full `GET /tasks` so agent detail (`/tasks/:taskId/agent`, legacy `/project` redirect) can resolve child recurring via `parentTaskId`. Dashboard uses client-side `selectTopLevelTasks`; list API `?top_level_only=true` stays available only for other callers that want server-side hide |
| Batch diagnostics | `error_message` / token counts on queue `processingBatches` / `attentionBatches` |
| Web builds | Root `build:web` runs Vite through `build-web.mjs`; `web` package `build` also runs `tsc`. CI relies on `typecheck` |
| Timeline / board `calendar` ids | UI `viewMode:"calendar"` and board widget `"calendar"` are **layout** ids — not `analysisMode:"recurring"`. Do not rename these layout wire ids |
| Device-local browser state | UI-only state that must remain per browser／Electron profile stays in localStorage or sessionStorage: locale/theme/background, shell chrome and last path, drafts, view/filter/read state, runtime-log cache, and the stable assistant client-instance id. These are active stores, not migration bridges |
| Desktop STT / browser-only IO | Electron hides mic and disables browser STT direct mode; use text input. Provider ids are hard-cut to `browser` only (no Whisper/Doubao reserved ids); local Whisper / cloud STT-TTS stay out of scope — see [`agent/assistant.md`](./agent/assistant.md) |

## Intelligence / Events time semantics

**Time-range tokens:** task / analysis windows use `TaskAnalysisTimeRange` (`1d`／`7d`／`30d`／`all`／…). Monitor message-query filters may also use **`12h`／`24h`** (`MessageTimeRange`) — query-only tokens, **not** `analysis_time_range` DB/API values. FE preset helpers (`normalizePresetTimeRange`) map unknown preset strings (including `12h`) onto editor vocabulary; they do not invent analysis windows.

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
- Analysis batch failures → `app_logs` via `AppLog.record` / `record_batch_failure` (category `analysis`, kind `batch.failure`) with envelope v1 `details` (includes capped HTTP/parse response snippets on AI failures; not full prompt dumps). Other curated Settings→Logs events: `scheduler.paused`／`scheduler.resumed`, `source.error`, `retention.cleanup`. Stdlib loggers stay stdout-only.
- GitHub Actions: Ubuntu `quality` + build on PR／main；只有明確執行 **`workflow_dispatch`** 才會從最新 `v*` tag 算下一版（不 bot commit main）→ win／mac／linux `package`（Desktop+CLI；`desktop_verify` only — vitest already in `quality`）→ push tag + GitHub Release → GHCR。

## Security (outbound requests)

Action handlers, RSS fetches, MQTT brokers, and LLM clients call `server/outbound.py` before connecting. Hostnames are resolved and rejected when any address is non-global. RSS re-validates each redirect hop.

**Accepted limitation:** DNS rebinding between validate and TCP connect is not mitigated with IP pinning (local single-user deployments).

## Release checklist (Desktop + CLI + container)

1. Merge／push to `main` and confirm `quality` + build pass; this never publishes
2. Explicitly run `workflow_dispatch`: `quality` → `version` (`bump_version.py --from-tags --print-only`; no tags → `VERSION` as-is) → package×3 → release tag + GitHub Release (does **not** push commits to main)
3. Sign installers for public／store distribution (unsigned CI builds are for QA only)
4. Container: same path → `ghcr.io/<owner>/<repo>`, or locally `npm run docker:build` + `npm run verify:deploy`

## Email IMAP outbound policy

Email collectors validate `imap_host` with the same public-IP DNS policy as HTTP/MQTT outbound via `server.outbound.validate_imap_host` (default ports 993/143). Poll uses synchronous `imap-tools` inside `asyncio.to_thread`; UID cursors live in encrypted `sources.credentials.folder_cursors`, with matching per-folder UIDVALIDITY in `folder_uidvalidities`. A missing or changed UIDVALIDITY resets only that folder's cursor.

Email channel IDs use the host-qualified shape `host:port/username/folder` (`email_channel_platform_id`). The one-shot data migration that remapped legacy `username/folder` keys was retired with a pre-wipe-floor / prior stamp; fresh installs write host-qualified keys from the start.

## Collector status: polling vs long-lived adapters

| Kind | Platforms | Initial connect failure | Runtime / poll errors |
|------|-----------|-------------------------|-------------------------|
| **Long-lived session** | Telegram, Discord, MQTT | Source → `error` / disconnected; SSE `source_status_changed` | Connect/disconnect and reconnect failures update status and broadcast SSE. **Telegram:** after handler registration, one bounded serial `iter_messages` backfill (100/dialog); `FloodWait` sleeps with jitter, wait >120s aborts remaining dialogs; no full history / edit-delete sync |
| **Poll loop** | RSS, Email (IMAP) | Validation/login failure → source `error` | **RSS:** consecutive failures (default 3) escalate to `error` + SSE. **Email:** transient poll errors retry; repeated IMAP auth failures escalate to `error` + SSE |

## Deploy verify

`npm run verify:deploy` runs `scripts/smoke.py` against a live server at `http://127.0.0.1:18820`. After admin register, set `VERIFY_BEARER` or `IM_ACCESS_TOKEN`.

## Removed / not restored

Legacy Tauri migration guards were retired with the delivery slim-down and stay removed. Windows／macOS／Linux Desktop + Docker/Web are first-class delivery surfaces. Do not revive Tauri IPC.

## Agent workspace hygiene

Heavy parallel agent edits on a large dirty tree have been observed to leave **0-byte source files** (Cursor file-cache／writeback class bug — not intentional empty Writes). Prefer commit／worktree isolation before big cleanups; one writable agent per tree; scan `web/src|server|docs` for `Length -eq 0` around gate runs.
