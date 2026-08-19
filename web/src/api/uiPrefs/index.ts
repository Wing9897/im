/**
 * REST client for SQLite-backed UI prefs (ops board, local notify, assistant…).
 *
 * INVARIANTS:
 * - After successful hydrate/PUT, server (SQLite) is SoT. Empty / unconfigured
 *   server → client defaults. Retired localStorage migration/cleanup bridges
 *   are not part of this boundary.
 * - Device chrome stays local forever: `im:monitor-mode`, `im:pages-last-path`
 *   (see `MonitorModeContext` / `boardPrefsStore`) — never put those in ui-prefs.
 * - Browse-position UI (F5 restore) stays on local `im:*` keys via
 *   `usePersistedState` — constants live in `domain/prefs`.
 *   Board gantt day/month zoom is server-side only:
 *   `widgetState.ganttViewModes` on `/ui-prefs/board` (not localStorage).
 * - Unsaved drafts use sessionStorage (`storage: "session"`).
 * - Timeline client statuses / time overrides: `/ui-prefs/timeline/annotations`
 *   (not soft-dismiss; that stays on `/api/v1/calendar/dismissals`).
 * - Card glyphs live on entity `emoji` columns (tasks / user_events /
 *   recurring_schedules / items). Stamp 43 dropped ui_prefs maps.
 * - UI locale remains LS-first (`i18n/locale.ts`); do not make server authoritative
 *   for `auto` locale the same way as board layout.
 * Transport is hand-written; request/response shapes derive from OpenAPI
 * `components["schemas"]` (see `server/api/schemas/responses/ui_prefs.py`).
 */

export * from "./board";
export * from "./notify";
export * from "./assistant";
export * from "./timelineAnnotations";
