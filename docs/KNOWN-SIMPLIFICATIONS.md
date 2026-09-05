# Known Simplifications

Intentional product／ops **deltas** vs naive “full platform” expectations. Live shapes: `server/tests/test_contract_*.py` and `server/tests/test_dead_endpoints.py`. Retired HTTP index: [`RETIRED-API.md`](./RETIRED-API.md). **Do not** recreate removed historical integrations unless a user-visible bug requires it.

SoT: [`ARCHITECTURE.md`](./ARCHITECTURE.md)＋[`README.md`](./README.md). Agent: [`agent/assistant.md`](./agent/assistant.md)、[`agent/a2a.md`](./agent/a2a.md)、[`agent/mcp.md`](./agent/mcp.md)。

## MCP control plane

SoT: [`agent/mcp.md`](./agent/mcp.md) (`/api/v1/mcp`)、[`agent/a2a.md`](./agent/a2a.md) (`POST /api/v1/a2a/agent`). Intentional v1 **not-to-do** — do **not** “complete” without a product decision:

- **No stdio** (or other local-subprocess MCP transports); Streamable HTTP + Bearer only.
- **No per-key tool scopes** (`calendar:write` 等). Identity is household `scopes: ["*"]`; `mcp_cap_*` and `worksets.external_enabled` are household filters, not key scopes. In-app assistant is not gated by them.
- **No config-class MCP tools** (tasks／sources／Actions／LLM／agent tick／system settings). No MCP create/delete workset. `web.search`／`web.fetch`／`tasks.consult_advisor` stay out of MCP.

## API / stats deltas

`GET /api/v1/results/stats` is dashboard-only (`TaskAnalysisStats`: `taskId` / `analyzedCount` / `unanalyzedCount` / `queuedMessageCount`). Per-task `failedBatches`／`completedBatches` are **not** on that route; viewer `GET /api/v1/viewer/stats` exposes global batch totals only (no `failedBatches`).

**Batch failure model:** see [Batch retries and auto-pause](#batch-retries-and-auto-pause). Schema／gate SoT: [`SCHEMA-BASELINE.md` Schema support matrix](./SCHEMA-BASELINE.md#schema-support-matrix).

## Frontend usage deltas

Dashboard maps `useTaskAnalysisStats` → `web/src/domain/dashboard/taskCardStats.ts`（待分析／排隊中／已分析）. Intelligence sort／display／page-by-page timeline／voice: [`ARCHITECTURE.md` Unified event analysis](./ARCHITECTURE.md#unified-event-analysis-pipeline); FE quirks below under [Intelligence](#intelligence--events-time-semantics).

**Dashboard vs Viewer:** Dashboard is the **operable** surface (create／edit／ops). Viewer (`/viewer/*`) is **read-only diagnostics** of live task／batch／status — not a second control plane. Do **not** extract a shared read-model or delete `/viewer/*` as duplicate debt.

## Prompt and analysis

- Message blocks: `[id=...][time=...][sender] content`. `analysis_strategy_mode` is evidence guidance (server default `balanced`). Prompt revision correlation is via git / prompt files — not a `system_config` tag.
- **`intel_event` mode:** task `promptTemplate` = domain intent only; JSON field rules live in `EVENT_SCHEMA_INSTRUCTION` (`server/prompts/analysis.py`).
- **Agent (`analysis_mode=agent`):** unified tick (`agent_tick` → `AgentRuntime` + `build_agent_base_prompt` / `AgentTaskSpec`). Triggers: message cursor drain, message threshold, or schedule. Caps control calendar read/write and web search (force-search for web_scout preset). Search routing shared with assistant (`WebSearchExecutionService.tool_search`／native); provider result cap **8** (`MAX_COUNT`) vs assistant tool default **5**. Assistant master switch does **not** gate ticks. Failures: one in-fire retry → `completed`+`error_message` + `record_batch_failure` + SSE (`retrying: true`); streak to `max_batch_retries` deactivates **that** task (not global pause). Details: `server/scheduler/agent_tick.py`.
- CJK-aware token heuristic; no `truncated_by_count` in batch metadata.

## Leaderboard

Board capped at **Top 10**; ranking is **server-side by score only** (LLM emits `topic` + `score`, no `rank`). Prompt context shows topic + score; API/DB still expose `rank` 1–10 for display. `topic_messages` are **replaced** when a batch supplies new `related_message_ids`.

## Scheduling / retention / ops routes

Scheduler (schema floor 7 / current stamp 7): [`SCHEMA-BASELINE.md`](./SCHEMA-BASELINE.md). See also [`ARCHITECTURE.md`](./ARCHITECTURE.md#scheduler). Retention TTLs + `POST /api/v1/system/retention/run`; ops `POST /api/v1/system/collector/restart`.

**Retention defaults** (`CONFIG_DEFAULTS` in `server/config.py`; `0` disables that category):

| Key | Bucket | Default |
|-----|--------|---------|
| `retention_messages_days` | `messages` (+ markers / action trigger history) | `90` |
| `retention_analysis_days` | `analysis_events` + completed `analysis_batches`（情报／分析结果） | `0`（默认不删除） |
| `retention_leaderboard_days` | `trending_topics` | `90` |
| `retention_app_logs_days` | `app_logs` | `30` |
| `retention_user_events_days` | `user_events`（日历／用户／助手一笔事件） | `0`（默认不删除） |

`recurring_schedules` are not TTL-purged. Orphan `timeline_dismissals` and device-auth expiry always run. Keys absent from `system_config` fall back to `CONFIG_DEFAULTS`; **already-stored values are not rewritten** (no stamp bump) — set Settings → Data retention to `0` (or wipe DB) to opt into the new keep-forever defaults on existing installs.

## Sources

Platform-first `PATCH /api/v1/sources/{email|rss|mqtt|telegram|discord}/{source_id}`. List: unfiltered `GET /api/v1/sources` or typed `GET /api/v1/sources/{platform}`; `?platform=` → **400**. Channel list: `GET /api/v1/channels` (`ChannelWithSource[]`; retired `/channels/with-sources` → 404). Calendar time-window SoT: `GET /api/v1/calendar/window` (display + notify). Retired `GET /api/v1/calendar/occurrences` is 404; Agent／MCP expand via Python helpers. RSS／Email default poll **300s** (`poll_interval_seconds`, clamped 60–86400). Trigger history: `GET /api/v1/actions/trigger-history` (legacy `/actions/history` paths remain 404).

**FE board kit:** shared list/card/layout hooks live under `web/src/pages/sources/board/` (`SourceCard*`, `SourceTabLayout`, `useSourceListTab*`, …). Platform folders (`rss/`／`telegram/`／…) stay in place — not a whole-tree Sources rewrite.

**Calendar holidays:** `GET /api/v1/calendar/holidays` overlays Nager.Date public holidays for the household weather location's ISO 3166-1 country (not city / subdivision). City aliases live in `server/services/location_map.py` (shared with weather geocode). Timeline month and board calendar month reuse the same overlay (board paints red dates only — not a second month-grid). Fail-soft empty overlay when Nager is down or the country is unsupported. Not CalDAV.

**Input／Process registries (in-repo, not a plugin SDK):**
- Platforms: leaf `server/domain/collector_platforms.py` → DDL CHECK + `ADAPTER_BUILDERS` + FE `domain/sources/collectorPlatforms.ts` (drift-tested).
- Modes: `AnalysisModeSpec` in `server/domain/analysis_modes.py` → derived frozensets + DDL CHECK + FE `domain/tasks/analysisModeCapabilities.ts` (drift-tested).
Still update sources routes／OpenAPI／pipeline／UI when adding — registry is the vocabulary／capability SoT, not zero-touch hot-plug.

## Schema baseline

Pointer only — stamp / semver / floor SoT: [`SCHEMA-BASELINE.md`](./SCHEMA-BASELINE.md).

## LLM simplifications (intentional)

Still in force under schema floor **7** / current stamp **7** / `SCHEMA_SEMVER` `1.6.0`. Do **not** restore without a new contract:

| Simplification | Keep / do not reintroduce |
|----------------|---------------------------|
| LLM `provider`／`staff_class` CHECK DDL from Python SoT (+ drift tests) | No second DDL literal vocabulary |
| Calendar `kind`／`direction` CHECK from domain SoT | Same pattern as origin／timeline `source` |
| No `llm_profiles.is_default` column; no make-default API | Resolve via **hard-bound global slots** only |
| No `assistant` in `llm_staff_instances` | Staff table = task modes (`leaderboard`／`intel_event`／`agent`) only |
| Global slots hard-bind (assistant／liaison／taskEditor) | Unbound slot → hard-fail (assistant same as liaison); UI on `/settings/ai/provider` + `GET/PUT /api/v1/llm/global-slots` |
| Fresh DDL seeds **zero** profiles | Tests seed `SEED_LLM_PROFILE_ID` (`server/tests/seed.py`); production has no fallback profile id constant |

**Intentional keeps (not debt):** `qalias` camel-only Query helper; agent `tool_args` snake tolerance; MCP v1 limits (see [MCP control plane](#mcp-control-plane)); ports four-mirror + drift tests; `test_dead_endpoints` / `retiredSourcePaths` locks; photo-BG surface system; FE `LINKED_*_TITLES` UX presets (kind remains authority); fixture `SEED_LLM_PROFILE_ID` test id; `cryptg` pinned dependency (optional Telethon crypto accelerator — no import site in `server/`, Telethon picks it up at runtime); `recurring_schedules.timezone_ical` storing the raw `VTIMEZONE` block verbatim (expansion re-parses it; deliberately not normalized into columns); Viewer `/viewer/*` as read-only diagnostics (Dashboard stays the operable surface — not duplicate debt).

### Debt purge notes

Removed without stamp bump (no leftover DDL / API columns); do not revive:

| Category | Removed |
|----------|---------|
| Dead modules / helpers | `server/items/linked_dates.py`; unused `resolve_assistant_profile_id`／`count_profiles`／`get_task_row`／`child_mode` |
| Title-preset helpers | Python `LINKED_*_TITLES` frozensets; FE `isLinked*Title` helpers |
| Hand DTO mirrors → OpenAPI | `RecurringSeries`／`UserEvent`; AiEngine status/test DTOs (`AiEngineHealthStatusResponse`／`AiEngineTestResultResponse`／`AiEngineTestBody`) |
| Misc dead code | mid-move `web/src/utils/rrule*`; identity keys in `PROVIDER_ALIASES`; duplicate LLM INSERT SQL + calendar NULL-event SELECT fragment; pre-beta `LEGACY_HOME`／`~/.intelligence-monitor` wipe scans |

## Calendar / RRULE expansion

One builder (`server/calendar/normalize.py`); RRULE stored without optional `RRULE:` prefix (`server/services/task_writes.py`). Validation／expansion live in `server/calendar/rrule.py` (not under `analyzer/`).

- **Sub-day frequencies are rejected on write:** `validate_rrule` only allows `FREQ ∈ {DAILY, WEEKLY, MONTHLY, YEARLY}` (`unsupported_freq`). `SECONDLY`／`MINUTELY`／`HOURLY` (and any other FREQ) fail task create／update. Query-time expansion still snaps wall clocks and budgets dense windows for legacy／synthetic rows used in budget tests — writers never emit those freqs.
- **Desktop ICS／deep-link import:** one-shot multi-VEVENT preview and atomic commit; no webcal／CalDAV／provider OAuth or bidirectional sync. RRULE entries become standalone calendar series, one-time items become user events; unsupported overrides stay visible but unselectable. Public-HTTP(S)-only remote URL policy, supported RFC 5545 subset, size/event limits, and floating-time behavior: [`DESKTOP-ICS.md`](./DESKTOP-ICS.md).
- **Publish snapshot is unexpanded series:** Timeline dismiss of a single RRULE occurrence does not set `pendingSync` (no exdate on the public replica). Local `timeline_dismissals` still hide that occurrence for the household. Do not re-open as a dirty-flag bug.

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
| Query params | **HTTP is camelCase-only** on the wire (`taskId`, `rangeStart`, `startDate`, `endDate`, `hasTime`, `hasCoords`, …). Snake_case dual-read is **gone** — do not reintroduce HTTP aliases. See [`ARCHITECTURE.md` Wire conventions](./ARCHITECTURE.md#wire-conventions). Thin `server/api/query_aliases.qalias` is the **camel-only Query helper — keep** (not worth dissolving into per-route `Query(alias=...)` noise) |
| LLM tool arguments | **Permanent Agent-boundary tolerance (not HTTP):** schemas expose canonical camelCase, while `server/agent/tool_args.py` accepts selected snake_case pairs and useful semantic aliases (for example `allTime`／`all_time` and `timeRange`／`time_range = "all"`). Model-generated arguments vary, so do not hard-cut this coercion; it stays a separate permanent boundary from the HTTP contract |
| SSE resource／status payloads | camelCase, same as HTTP (`adapterName`, `errorSummary` on `collector_status_changed`). Do not reintroduce wire `adapter_name`／`error_summary` |
| Error bodies | `error_code`, `correlation_id` (snake_case) |
| `GET /config/settings` | settings snapshot (camelCase); use `PUT /config/settings` to update |
| `analysisPaused` | read via settings snapshot; write via `POST /system/analysis/pause` only |
| Source URL styles | All platforms use `/api/v1/sources/{platform}/{id}/...` for platform-scoped mutations (retired `/api/v1/accounts*` stay 404) |
| Source list | `GET /api/v1/sources` → `Source[]`; typed `GET /api/v1/sources/{telegram,discord,rss,mqtt,email,http}`; `?platform=` → 400 |
| Schema stamp v2 | Floor + `1→2` SoT: [`SCHEMA-BASELINE.md`](./SCHEMA-BASELINE.md) (support matrix, stamp-1 backup-then-walk, future-stamp reject, explicit reset). Product note: [`CHANGELOG.md` Unreleased](../CHANGELOG.md#unreleased). Unique here: `schema_domains/vocabulary.py` is a re-export hub only (no assembly); `item_id` FK is `ON DELETE SET NULL`. |
| Task catalog vs recurring series | `GET /tasks` returns analysis tasks only (no `parentTaskId`／`itemId`／`topLevelOnly`). Child recurring rows are fetched from `/calendar/recurring?parentTaskId=…`; `topLevelOnly` on the recurring endpoint hides child series that have a parent agent task. |
| Batch diagnostics | `error_message` / token counts on queue `processingBatches` / `attentionBatches` |
| Web builds | Root `build:web` runs Vite through `build-web.mjs`; `web` package `build` also runs `tsc`. CI relies on `typecheck` |
| Timeline / board `calendar` ids | UI `viewMode:"calendar"` and board widget `"calendar"` are **layout** ids — not `analysisMode:"recurring"`. Do not rename these layout wire ids |
| Timeline 全局 vs 塊 | Gantt **全局** (`im:timeline:overview-mode`) is a continuous pan／zoom window, not a `TimelineScale`. Calendar **塊** is month `split` cards. Do not treat either as the other, and do not add Overview to board gantt |
| Board widgets display-only | Board tiles do **not** navigate via `openInPages` / click-to-page. Regression: `web/src/board/widgets/boardWidgetNav.test.tsx` (keep) |
| `TaskEmployeeId` | Intentional display alias of `AnalysisMode` (`web/src/domain/tasks/taskEmployee.ts`) — named helpers kept even though mapping is 1:1 |
| Global LLM slots | Assistant／A2A／task advisor singletons live in `system_config` (`llm_global_slot_*`) via `server/llm_global_slots.py` — profile-id pointers only. Trio UI is global-slots only; `llm_staff_instances` holds task-mode classes (`leaderboard`／`intel_event`／`agent`) exclusively. Unbound slots hard-fail (assistant same as liaison). No `is_default` column or make-default API |
| FE `MASKED_SECRET` | Same `"********"` literal in `utils/configValidation` and `types/llmProfiles` (and `server.secrets`) — keep local copies; do not re-export across types↔utils (cycle) |
| Device-local browser state | UI-only state that must remain per browser／Electron profile stays in localStorage or sessionStorage: locale/theme/background, shell chrome and last path, drafts, view/filter/read state, runtime-log cache, and the stable assistant client-instance id. These are active stores, not migration bridges |
| Theme focal (Bing daily) BG | Optional `data-theme-bg=focal` — not required for core offline use. Server proxies Bing HPImageArchive (`GET /api/v1/theme/focal-background?idx=0..7`) and image bytes (`…/image`). `idx` 0=today … 7=recent days (not infinite random). SPA Settings **Refresh** advances idx (cycle 0–7) and rewrites device `im:theme-focal-cache` (includes `idx` + `fetchedAt`). Optional auto-refresh interval (`im:theme-focal-refresh-hours`: 0/1/6/12/24) uses a visibility-aware FE timer. Apply via CSS vars `--theme-bg-image` / `--theme-bg-wash-pct` on `.im-page-canvas` + `.im-shell-sidebar`. Prefers same-origin blob URL; Bing hotlink is metadata/fallback. Upstream must use `format=js` (JSON); `format=json` returns XML — server XML-falls-back. Failure → last cache or motif/`none`. Unsplash deferred. Privacy: focal causes outbound Bing from the local server. |
| Photo-BG surface layers | **Done:** photo ambient on `.im-page-canvas` + `.im-shell-sidebar`; chrome / panels / insets via `--surface-chrome` / `--surface-panel` / `--surface-inset` (+ `.im-material-panel`). Nested `.im-page-shell` stays transparent. `data-theme-bg=none` stays dense/opaque. Prefer layer helpers over `bg-surface-card` exceptions. **Readable glass defaults (photo):** panel 63% / chrome 70% / inset 86%; blur panel 22px / chrome 18px; wash bias −8pp with min wash 40%; personalization `--surface-panel` floor 63% under photo BG; sidebar uses chrome frost over photo; map overlays / danmaku / EmojiPicker host consume surface tokens. Do **not** reintroduce `--im-panel-opacity*` or body-level `#im-theme-bg` (see [Removed / not restored](#removed--not-restored)). |
| Desktop STT / browser-only IO | Electron hides mic and disables browser STT direct mode; use text input. Provider ids are hard-cut to `browser` only (no Whisper/Doubao reserved ids); local Whisper / cloud STT-TTS stay out of scope — see [`agent/assistant.md`](./agent/assistant.md) |

## Intelligence / Events time semantics

**Time-range tokens:** task / analysis windows use `TaskAnalysisTimeRange` (`1d`／`7d`／`30d`／`all`／…). Monitor message-query filters may also use **`12h`／`24h`** (`MessageTimeRange`) — query-only tokens, **not** `analysis_time_range` DB/API values. FE preset helpers (`normalizePresetTimeRange`) map unknown preset strings (including `12h`) onto editor vocabulary; they do not invent analysis windows.

The intelligence UI treats **event time** as the user-facing clock. Preference order matches map filters: structured `startTime` → `sourceMessageTime` → `createdAt` (`getEventTimestamp` / `mapFilters`).

| Layer | Behavior |
|-------|----------|
| Frontend display / card-list filter | Server-side `startDate`/`endDate` on `/results/events`; API returns event-time order by default |
| API sort | `sort=event_time` (default): `ORDER BY COALESCE(ae.start_time, m.timestamp, ae.created_at) DESC`; `sort=analyzed_at`: `ORDER BY ae.created_at DESC` |
| API `startDate` / `endDate` | Filter on the same `COALESCE(...)` expression (HTTP camelCase wire names; not `start_date`／`end_date`) |
| Frontend fetch | `useIntelligenceSource` → `fetchEvents`; sends `startDate` / `endDate` from card/list `useTimeFilter` or map `timeWindow`; `sort` from toolbar / `im:intelligence:sort` |

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
- Default listen port: `server/constants.py` `SERVICE_PORT` (SoT) ↔ FE `web/src/config/serviceEndpoints.ts` `DEFAULT_API_PORT` ↔ desktop `desktop/ports.ts` `DEFAULT_SERVER_PORT` ↔ `scripts/service-ports.mjs` (drift-tested in `serviceEndpoints.drift.test.ts` / `service-port-drift.test.ts`)
- Post-deploy live check: `npm run verify:deploy` (`smoke` is an alias)
- Root vitest: `tests/smoke/` + security tests
- Analysis batch failures → `app_logs` via `AppLog.record` / `record_batch_failure` (category `analysis`, kind `batch.failure`) with envelope v1 `details` (includes capped HTTP/parse response snippets on AI failures; not full prompt dumps). Other curated Settings→Logs events: `scheduler.paused`／`scheduler.resumed`, `source.error`, `retention.cleanup`. Stdlib loggers stay stdout-only.
- GitHub Actions: PR 跑 `ci.yml` quality；**push `main`** 跑 `release.yml`（quality → `git tag`／`git push` → win／mac／linux Desktop → GitHub Release → GHCR）。CLI 用該 tag 源碼。不 bot commit main。

## Security (outbound requests)

Action handlers, RSS fetches, MQTT brokers, and LLM clients call `server/outbound.py` before connecting. Hostnames are resolved and rejected when any address is non-global. RSS re-validates each redirect hop.

**Accepted limitation:** DNS rebinding between validate and TCP connect is not mitigated with IP pinning (local single-user deployments).

## Release checklist (Desktop + source CLI + container)

1. Merge／push to `main` and confirm `quality` + build pass
2. Push `main`: Release runs quality, auto-bumps, `git tag`s, packages Desktop×3, and creates the GitHub Release. CLI is that tag's source (`uv sync --locked` + `uv run python -m server`). Does **not** push commits to main.
3. Sign installers for public／store distribution (unsigned CI builds are for QA only)
4. Container: same path → `ghcr.io/<owner>/<repo>`, or locally `npm run docker:build` + `npm run verify:deploy`

## Email IMAP outbound policy

Email collectors validate `imap_host` with the same public-IP DNS policy as HTTP/MQTT outbound via `server.outbound.validate_imap_host` (default ports 993/143). Poll uses synchronous `imap-tools` inside `asyncio.to_thread`; UID cursors live in encrypted `sources.credentials.folder_cursors`, with matching per-folder UIDVALIDITY in `folder_uidvalidities`. A missing or changed UIDVALIDITY resets only that folder's cursor.

Email channel IDs use the host-qualified shape `host:port/username/folder` (`email_channel_platform_id`). The one-shot data migration that remapped legacy `username/folder` keys was retired with a prior stamp; fresh installs write host-qualified keys from the start.

## Collector status: polling vs long-lived adapters

| Kind | Platforms | Initial connect failure | Runtime / poll errors |
|------|-----------|-------------------------|-------------------------|
| **Long-lived session** | Telegram, Discord, MQTT | Source → `error` / disconnected; SSE `source_status_changed` | Connect/disconnect and reconnect failures update status and broadcast SSE. **Telegram:** after handler registration, one bounded serial `iter_messages` backfill (100/dialog); `FloodWait` sleeps with jitter, wait >120s aborts remaining dialogs; no full history / edit-delete sync |
| **Poll loop** | RSS, Email (IMAP) | Validation/login failure → source `error` | **RSS:** consecutive failures (default 3) escalate to `error` + SSE. **Email:** transient poll errors retry; repeated IMAP auth failures escalate to `error` + SSE |

## Deploy verify

`npm run verify:deploy` runs `scripts/smoke.py` against a live server at `http://127.0.0.1:{SERVICE_PORT}` (default **18820**; override via `VERIFY_BASE` / `DESKTOP_VERIFY_BASE`). After admin register, set `VERIFY_BEARER` or `IM_ACCESS_TOKEN`.

## Removed / not restored

Legacy Tauri migration guards were retired with the delivery slim-down and stay removed. Windows／macOS／Linux Desktop + Docker/Web are first-class delivery surfaces. Do not revive Tauri IPC.

Theme glass shims retired with the photo-BG surface pass: do not reintroduce `--im-panel-opacity` / `--im-panel-opacity-pct` parallel CSS vars, or a body-level `#im-theme-bg` DOM layer (photo paints into `.im-page-canvas` / `.im-shell-sidebar` via `--theme-bg-image`).

`server/items/linked_dates.py` (`is_linked_expiry_kind`) was unused and removed — expiry authority stays `user_events.kind=expires` + items derive-on-read. Do not revive a second helper module for that boolean.

Desktop `connection.json` `allowLanAccess` and Settings → General 「允許區域網路存取」toggle were removed — bind is always `0.0.0.0` (`DEFAULT_BIND_HOST` / Desktop sidecar env). Legacy key is ignored on read and not rewritten. Auth still required; TLS only for public internet exposure. Do not reintroduce a user-facing LAN bind toggle (`general.lanAccess*` i18n／`allow-lan-access-toggle`／`setDesktopAllowLanAccess` stay banned).

Assistant page per-session 「LLM 設定檔」block (`AssistantSessionLlmProfileSelect` + `assistant.llmProfile.*` keys) was removed — binding is global assistant slot on `/settings/ai/provider` only. Wire／`ui-prefs` may still carry optional `llmProfileId`; do not restore the picker UI.

Items category hub and finance chrome omit redundant top-bar titles 「物品」／「物品財務」(`items:pageTitle`／`items:finance.pageTitle` forbidden). Nav already labels the page; keep titles only on entry／form chrome when needed.

## Agent workspace hygiene

Heavy parallel agent edits on a large dirty tree have been observed to leave **0-byte source files** (Cursor file-cache／writeback class bug — not intentional empty Writes). Prefer commit／worktree isolation before big cleanups; one writable agent per tree; scan `web/src|server|docs` for `Length -eq 0` around gate runs.
