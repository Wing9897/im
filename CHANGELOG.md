# Changelog

Stable product baseline starts at **1.0.0**. Schema stamp／`SCHEMA_SEMVER` identify the database contract and need not match the product tag.

## [Unreleased]

- Retired public `GET /api/v1/calendar/occurrences` (404). Time-window reads stay on `GET /api/v1/calendar/window`; Agent／MCP expand via Python `query_window`／`expand_active_calendar_occurrences`.
- Schema stamp **2** (`SCHEMA_SEMVER` `1.1.0`) adds `schema_meta`. Stamp-1 databases backup once then walk `SCHEMA_MIGRATIONS` `1→2`. Empty DBs create current DDL (seeded `schema_meta` row, same as the 1→2 step) and stamp 2. Future stamps (retired 3–45 while CURRENT=2) hard-reject with “update the application”; pre-cut stamp-2 lookalikes and corrupt fingerprints still require explicit reset. Never silent wipe.
- **push `main`** 直接跑 Release：quality → `git tag` + `git push` → 一次 Vite（`web_dist`，Actions artifact `web-dist` 僅 `web/dist`、保留 7 天）→ 三平台 Desktop 共用該包，安裝程式仍直接掛到 GitHub Release（安裝包不走 Actions artifact）。CLI 用該 tag 源碼。
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
