# Changelog

Stable product baseline starts at **1.0.0**. Schema stamp／`SCHEMA_SEMVER` identify the database contract and need not match the product tag.

## [Unreleased]

## [1.0.26] — 2026-09-05

Schema stamp **7** (`SCHEMA_SEMVER` `1.6.0`) is both floor and current. **This Release is wipe-only:** it does not upgrade stamp 1–6 databases in place. Backup then `python scripts/reset_local_databases.py --apply`. Fresh DBs create current DDL only. Household auto-sync lives only in `system_config` (no `calendar_share_publish` auto_sync cache columns; no listing-alias startup remap). Production `SCHEMA_MIGRATIONS` stays empty; there is no 6→7 additive walk. Future in-place upgrades start at stamp **8+**.

### SPA / navigation

- Sidebar can **pin** (dock ~200px, push pages) or stay the overlay drawer; unused icon-rail `collapsed` path is gone.
- `/tasks` toolbar no longer renders workset **目錄 | 流程圖** chrome (those pills stay on `/worksets` only).
- SPA unknown URLs render a NotFound page (home button) instead of silently redirecting to `/`. `/` and `viewerRoute` still use `DefaultHomeRedirect`.
- AI settings live under `/settings/ai/provider|voice|staff` (sidebar AI vs system settings). Leftover `/ai/*` (including `/ai/provider|voice|staff` and `/ai/analysis-strategy`) is `NotFoundPage` — no permanent redirect. `/assistant` is unchanged.
- `/tasks` is an independent 任務設定 page again (sidebar + command palette `nav:tasks`). Sidebar 任務設定 always opens the list `/tasks`, not the last editor. Workset catalog pills are **目錄 | 流程圖** only; leftover `/worksets?tab=tasks` stays on the catalog (no redirect). Workset detail keeps a scoped member-task list. Simple mode still hides `/tasks` and editors.

### Timeline / calendar

- Intelligence map LIVE range menu portals and flips up when the bottom chrome would clip it. Gantt **全局** has a 12h–1y range menu; calendar and Gantt share one **今天** control; the date-range label opens jump-to-date.
- Timeline **塊** cards for `subscribe` sources show the bookmark icon.
- Gantt **全局**: visible canvas and `GET /calendar/window` are separate. Fetch span is `min(visible × 2, 90d)` snapped to 14/30-day buckets so small pans reuse the same ISO bounds; a zoomed-out decade still never requests more than 90 days. Pan/zoom debounce 250ms; a newer load **aborts** the in-flight window request (cancel is not a toast or timeout wipe). Axis tick labels thin when they would overlap (prefer a nearby major tick).
- Timeline sidebar: when the focused day sits outside the visible 全局 window, the list follows the window center and shows **不在當前視圖**.
- Timeline **Block** view: same-source month mini-calendars (null expand ≤12), no right rail, standalone compact grid + day popover; per-card colors (14 presets + custom hex) with chrome following the card; selection stays inside one card.
- Calendar timezone: one pinned household IANA city (default prefill is the current OS city; it does not follow Windows while traveling). Local save works offline; a reminder stays until the public-server account timezone replica succeeds.
- Retired public `GET /api/v1/calendar/occurrences` (404). Time-window reads stay on `GET /api/v1/calendar/window`; Agent／MCP expand via Python `query_window`／`expand_active_calendar_occurrences`.

### Calendar share

- New households default calendar-share origin to **https://subscribe.devents.tech** (https, no trailing slash). Existing DBs keep the stored URL; self-host sidecar remains `http://127.0.0.1:8787`.
- Calendar-share cleanup: POST/DELETE `/subscriptions` fail closed (502) if the follow-up IC GET `/me/subscriptions` fails instead of returning an optimistic list; subscribe add/remove awaits catalog refresh; IntelligenceCalendar `GET /search` treats `%`/`_` in `q` as literals; concurrent IM `authorized_request` calls share one process refresh lock so a second 401 cannot rotate the same refresh token and log the session out. **取消上載 deletes the IC slug calendar** (events/series/grants/subscriptions CASCADE) instead of leaving an empty Closed shell; the local workset publish map clears fingerprints / server hash. Timeline source-filter subscribe column is disabled+greyed when logged out vs when IC is unreachable (502), with distinct copy; local workset column stays usable.
- Calendar share (local client): Subscriptions workspace signs in to the public calendar server via IM proxy (Fernet access + refresh; 401 retries refresh). Workset publish is the full timeline as remote `events[]` + unexpanded `series[]` (我的日程 one-off/recurring, task- and item-linked calendars, intel `analysis_events`, derived `item_remind`; skip dismissed; no display-window cap). First publish (or a 409 `baseHash` mismatch) sends a full snapshot; later syncs PATCH only uid add/update/delete against last server-acked fingerprints. Skip event upload when uid fingerprints and `publicVisibility` are unchanged (`baseHash` is the server `events_hash` / response `contentHash`, not a local aggregate); grants skip on `lastGrantsHash` and are per-handle busy/details. IM expands remote series locally for the request window. Gantt groups subscribed RRULE occurrences by `seriesId` (one-offs stay ungrouped). Renderer never talks to the public origin.
- Subscriptions live on `/subscriptions` (我的訂閱 / 我的發佈 / 搜尋訂閱). IntelligenceCalendar `subscriptions` is the source of truth; IM GET/POST/DELETE `/api/v1/calendar-share/subscriptions` proxy IC `/me/subscriptions` (DELETE unsubscribes on the server). Timeline events follow that same list. There is no local `calendar_share_subscriptions` cache — IC 502 fails closed. Closed or grant-revoked calendars drop from 我的訂閱 as soon as the owner writes (GET still prunes that subscriber’s own row as a safety net). Timeline still splits the source filter into side-by-side 本機 (`Layers`) / 訂閱 (`Bookmark`) columns (catalog add/remove is not in that dialog). Search uses calendar-server `GET /search` via IM `GET /api/v1/calendar-share/search` (IC 404 → empty list). **我的發佈** (`/subscriptions/published`) is the full public-calendar surface: list this device’s publish map (`GET /api/v1/calendar-share/publish`, including leftover rows after the workset was deleted), 取消上載 (DELETE IC slug, local workset stays), 更新公開副本, and slug/visibility/grants. Mine and Published always show the handle/slug/name filter, including empty lists. Workset pages are local-only.

### Desktop / AI / pipeline

- Desktop schema-floor recovery: after backup-and-reset, show 「資料庫已重置」and **Restart** (`app.relaunch`) instead of in-process sidecar retry (avoids Windows `Server startup cancelled` when the dialog was the only window).
- Desktop shows a formal schema-baseline dialog when the local stamp is below the floor (backup + `local-db-reset`), instead of leaving reset as CLI-only.
- Desktop tray right-click adds an interface-language radio submenu (自動 / 繁體中文 / 简体中文 / English) that hot-swaps the shell and Web UI, plus global AI analysis pause/resume and a confirmed emergency abort.
- Chrome/plain option lists use `MenuSelect` (RSS picker, calendar-share publish, subscriptions publish). Dense native schedule rows keep `SelectField`.
- Pipeline first-run checklist adds an optional step: create an AI profile and bind the assistant global slot (link to `/settings/ai/provider`; no `__default__` seed).
- P2 contracts: Agent stream and notify validation lock to generated OpenAPI schemas; Settings AI pages move under `/settings`; desktop SSE payload coverage; Viewer copy.
- Ops board (canvas) no longer shows the left-edge sidebar `>` chevron; pages mode still uses the overlay toggle. Switch back via 頁面 / 畫布 or the command palette.
- Caption overlay sits 20px from the window bottom (not 12% up) and uses `--text-primary` with `color-mix(--surface-card 86%, transparent)` (~80–90% opacity, denser than photo-BG `--surface-panel`) for glass contrast; persist history labels `editor.you` as 你 / You.
- System-bar composer toggle is 閃現 / 持續 (flash then `AGENT_HIDE_MS`, vs pinned transcript) instead of 顯示對話 hiding the whole overlay chat; `/assistant` history is unchanged.
- AI engine status/test no longer stringify HTTPException; empty-DB and unbound-assistant diagnostics return stable `errorCode` (`NO_LLM_PROFILE` / `ASSISTANT_SLOT_UNBOUND` / `LLM_PROFILE_INCOMPLETE`) mapped by frontend i18n, with assistant empty-state copy pointing at `/settings/ai/provider`.
- Assistant composer `sendDisabled` also covers an unbound/incomplete assistant slot; Enter and PTT honor the same gate, with a send-button hint pointing at the existing `/settings/ai/provider` banners.

### Packaging / docs

- README: mark SVG plus workflow / calendar / 全局 Gantt shots under `docs/images/`.
- Dev `1420`: when IP Helper (`svchost`) and leftover Vite both hold the port, skip killing `svchost` so `npm run dev` no longer aborts the whole session.
- Release hygiene: removed unused root `puppeteer` dependency and agent browser-smoke scratch (`.browser-smoke*`, `scripts/_browser_smoke_temp.mjs`).
- Release container job no longer uses Docker `type=gha` cache (avoids GitHub Actions cache quota failures). Staged `web-dist.tar.gz` is deleted only after all three package jobs succeed, so Re-run failed jobs can still download it. Desktop installer upload uses `gh release upload` with retries (avoids `action-gh-release`'s 10s `api.github.com` timeout).
- **push `main`** 直接跑 Release：quality → `git tag` + `git push` → 一次 Vite（`web_dist`，暫存 `web-dist.tar.gz` 到 GitHub Release 供三平台下載，收尾刪除；不走 Actions artifact，因私有倉配額已滿）→ 三平台 Desktop 共用該包，安裝程式直接掛到 GitHub Release。CLI 用該 tag 源碼。
- Release 收尾檢查用 `GH_REPO` 讀 GitHub Release（不依賴 runner 工作區的 `.git`）；資產檔名空白會被 GitHub 改成點。

## [1.0.7] — 2026-08-21

Upgrade from **v1.0.5 is wipe-only stamp 1**. Live DDL matches the former stamp-45 shape; retired stamps (including 2–45) hard-reject with no in-place migration. Reset before opening this build: `uv run python scripts/reset_local_databases.py --apply`. See [SCHEMA-BASELINE](docs/SCHEMA-BASELINE.md).

### Packaging / CI

- `desktop_verify` / `_verify_common` put the repo root on `sys.path` before importing `server`, so `uv run python scripts/desktop_verify.py` works with uv `package = false` (Release `package` job).
- Split GitHub Actions: `ci.yml` is quality-only on PR／`main` (no skipped publish jobs). `release.yml` publishes on **`git push` of `v*` tags**; `workflow_dispatch` pushes the next tag *before* packaging so a failed installer build does not hide the version. Release no longer shares a concurrency group with main CI.

### Assistant

- Assistant bubbles render a safe Markdown subset (headings, bold, lists, inline code, `[text](url)` links) instead of raw `**`; TTS speaks stripped plain text. Links open in a new tab (`rel="noopener"`); HTML is not parsed.
- Caption PTT overlay keeps the current turn (user → sending → reply) through the listen-to-send gap; `AGENT_HIDE_MS` starts only after the reply exists.
- Tool names and English wire summaries (`calendar.upcoming`, `3 items`) show localized labels in assistant chat and Agent tick extras. Server `summarize_tool_result` stays English.
- Overlay history / bubble max-height is smaller; opening the system-bar composer no longer stacks a duplicate turn bubble over `/monitor`.
- `/assistant` and the system-bar composer share one draft / workset / PTT / send shell (routes stay separate).

### Gemini / assistant

- Settings AI test probe uses 64 `maxOutputTokens` for canonical `gemini` and profile `gemini_compatible` (Gemini 3 thought signatures make `maxOutputTokens=1` return empty `MAX_TOKENS`). Settings Test HTTP timeout is 90s (not the global chat timeout). Analysis / assistant `complete()` is unchanged.
- Profile `thinking_enabled` now reaches Gemini: off sends `generationConfig.thinkingConfig.thinkingLevel: MINIMAL` only; on omits the block. Never send `thinkingBudget` and `thinkingLevel` together.
- Assistant toasts map Gemini `MAX_TOKENS` / no-candidates via `formatAnalysisErrorMessage` (zh-Hant SoT in `tasks.json`) instead of raw English.

### Tests

- Theme background helpers no-op when `localStorage` is gone after Vitest jsdom teardown; ModalDialog close timeout no-ops without `window`.

### API / product (carried from Unreleased)

- `GET /api/v1/calendar/window` query range is `startTime`／`endTime` only (short `start`／`end` aliases removed).
- Agent schedule／threshold ticks that write Intelligence events (`outputAnalysisEvents`) now persist `tool_calls_json` and `agent_message` on the batch. Scout ticks no longer show empty tools after Serper／web.search.
- SQLite contract cut: **stamp 1** (`SCHEMA_SEMVER` `1.0.0`) is the first database version.
- SPA notifications workspace page is `NotifyWorkspacePage` (`web/src/pages/notify/`; route `/notify`; tabs `types`／`notify`／`history`). HTTP `/api/v1/actions*` outbound automation unchanged. Unique `TimelineCalendarRendering` assertions moved into CalendarView／GanttView／ControlBar tests; that file is deleted. Dual-path `sharedCalendarFetch` (`/results/events` + `/calendar/occurrences`) is gone — notify scan now uses the same `GET /api/v1/calendar/window` as Timeline/Board.
- `GET /api/v1/channels` is the live channel list (`ChannelWithSource[]`). Retired `GET /api/v1/channels/with-sources` → 404.
- Test de-dupe (timeline / workset graph / notify) and unused-i18n scan on `npm run i18n:check`.

## [1.0.0] — baseline

First documented stable release line for Intelligence Monitor (Desktop + CLI + Docker/Web).

### Highlights

- Collector connections under `/api/v1/sources*` (`sources` / `source_channels` / `messages.source_id`)
- Wipe-only SQLite baseline **stamp 1** (`SCHEMA_SEMVER` `1.0.0`); non-current stamps hard-reject → explicit reset. (The 1.0.0 product tag historically documented stamp 27 / `0.1.0-beta.28` — that lineage is retired; see [SCHEMA-BASELINE](docs/SCHEMA-BASELINE.md).)
- `user_events.kind` (`normal`|`expires`|`purchase_effective`) is authority for expiry projection and finance; title presets remain UX only
- Remove item-level `price`; purchase_effective linked calendars carry `amount` + `direction` (`expense`|`income`)
- Task modes: `leaderboard` / `intel_event` / `agent`; recurring calendars are standalone `/api/v1/calendar/recurring` series
- Household auth: admin password → device session; revocable access keys; retired pairing / API-key mint bridges stay gone
- OpenAPI-sourced HTTP contract (`web/openapi/openapi.json` + generated `schema.d.ts`)

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/KNOWN-SIMPLIFICATIONS.md`](docs/KNOWN-SIMPLIFICATIONS.md) for live contract detail.
