/**
 * Central registry of device-local `im:*` storage / event keys.
 *
 * Board layout remains server `ui_prefs` (SQLite) — never listed here as SoT.
 * Browse chrome, drafts, and same-tab events live under `im:*`.
 */

/** One-time wipe marker written after legacy `im:*` keys are cleared. */
export const PREFS_SCHEMA_VERSION_KEY = "im:prefs-schema-version";
/** Bump when first-launch wipe of prior-generation local prefs is required. */
export const PREFS_SCHEMA_VERSION = "6";

// ── Chrome / shell ──────────────────────────────────────────────────────────

export const SIDEBAR_COLLAPSED_KEY = "im:sidebar-collapsed";
export const SIDEBAR_COLLAPSED_EVENT = "im:sidebar-collapsed-change";
export const SIDEBAR_RAIL_MODE_KEY = "im:sidebar-rail-mode";
export const SIDEBAR_RAIL_MODE_EVENT = "im:sidebar-rail-mode-change";
export const MONITOR_MODE_KEY = "im:monitor-mode";
export const PAGES_LAST_PATH_KEY = "im:pages-last-path";
export const SIMPLE_MODE_STORAGE_KEY = "im:ui:simple-mode";
export const DESKTOP_SHELL_KEY = "im:desktop-shell";
export const UI_LOCALE_STORAGE_KEY = "im:ui-locale";

// ── Theme ───────────────────────────────────────────────────────────────────

export const STORAGE_KEY_THEME = "im:theme";

export function storageBgKey(themeId: string): string {
  return `im:theme-bg:${themeId}`;
}

export function storageBgOpacityKey(themeId: string): string {
  return `im:theme-bg-opacity:${themeId}`;
}

export function storageThemeColorsKey(themeId: string): string {
  return `im:theme-colors:${themeId}`;
}

export function storageThemeTextureKey(themeId: string): string {
  return `im:theme-texture:${themeId}`;
}

// ── Intelligence ────────────────────────────────────────────────────────────

export const INTELLIGENCE_VIEW_MODE_STORAGE_KEY = "im:view-mode:intelligence";
export const INTELLIGENCE_SEARCH_STORAGE_KEY = "im:intelligence:search";
export const INTELLIGENCE_SELECTED_SOURCES_STORAGE_KEY =
  "im:intelligence:selected-sources";
export const INTELLIGENCE_SORT_STORAGE_KEY = "im:intelligence:sort";
export const INTELLIGENCE_TIME_PRESET_STORAGE_KEY = "im:intelligence:time-preset";
export const INTELLIGENCE_READ_ITEM_IDS_STORAGE_KEY = "im:intelligence:read-item-ids";
export const INTELLIGENCE_SEARCH_FILTER_OPEN_STORAGE_KEY =
  "im:intelligence:search-filter-open";

// ── Map ─────────────────────────────────────────────────────────────────────

export const SHARED_DANMAKU_MODE_KEY = "im:map:shared-danmaku-mode";
export const MAP_LIVE_MODE_STORAGE_KEY = "im:map:live-mode";
export const MAP_TIME_WINDOW_STORAGE_KEY = "im:map:time-window";
export const MAP_OVERLAY_DISPLAY_MODE_STORAGE_KEY = "im:map:overlay-display-mode";
export const MAP_LIVE_WINDOW_HOURS_STORAGE_KEY = "im:map:live-window-hours";
export const MAP_EVENT_PANEL_HEIGHT_STORAGE_KEY = "im:map:event-panel-height";
export const MAP_LIVE_INFO_PANEL_HEIGHT_STORAGE_KEY = "im:map:live-info-panel-height";

// ── Monitor / wall ──────────────────────────────────────────────────────────

export const MONITOR_VIEW_MODE_STORAGE_KEY = "im:view-mode:monitor";
export const MONITOR_FILTERS_STORAGE_KEY = "im:monitor:filters";
export const MONITOR_READ_IDS_STORAGE_KEY = "im:monitor:read-message-ids";
export const MONITOR_WALL_CHANNELS_STORAGE_KEY = "im:wall:channels";
export const MONITOR_FILTER_BAR_OPEN_STORAGE_KEY = "im:monitor:filter-bar-open";

// ── Timeline ────────────────────────────────────────────────────────────────

export const TIMELINE_SELECTED_SOURCES_STORAGE_KEY = "im:timeline:selected-sources";
export const TIMELINE_VIEW_MODE_STORAGE_KEY = "im:timeline:view-mode";
export const TIMELINE_SHOW_DISMISSED_STORAGE_KEY = "im:timeline:show-dismissed";
export const TIMELINE_SHOW_ONGOING_STORAGE_KEY = "im:timeline:show-ongoing";
export const TIMELINE_SHOW_ENDING_STORAGE_KEY = "im:timeline:show-ending";
export const TIMELINE_FOCUSED_DAY_STORAGE_KEY = "im:timeline:focused-day";
export const TIMELINE_SELECTED_GANTT_TASK_ID_STORAGE_KEY =
  "im:timeline:selected-gantt-task-id";
export const TIMELINE_TIME_SCALE_STORAGE_KEY = "im:timeline:time-scale";
export const TIMELINE_TIME_CURSOR_STORAGE_KEY = "im:timeline:time-cursor";
export const TIMELINE_EVENT_LIST_SHOW_ALL_STORAGE_KEY = "im:timeline:event-list-show-all";

// ── Tasks / chat editor ─────────────────────────────────────────────────────

export const TASKS_GROUPING_VIEW_STORAGE_KEY = "im:tasks:grouping-view";
export const SHOW_SYSTEM_TASKS_STORAGE_KEY = "im:tasks:show-system-tasks";
export const SHOW_SYSTEM_WORKSETS_STORAGE_KEY = "im:tasks:show-system-worksets";
export const TASKS_MODE_FILTER_STORAGE_KEY = "im:tasks:mode-filter";
export const TASKS_DETAIL_CHANNELS_EXPANDED_STORAGE_KEY =
  "im:tasks:detail:channels-expanded";
export const TASKS_SEARCH_STORAGE_KEY = "im:tasks:search";
export const CHAT_EDITOR_TEMPLATE_USAGE_KEY = "im:task-template-usage";

export function chatEditorFormStorageKey(taskId: string | undefined): string {
  return taskId
    ? `im:tasks:chat-editor:form:${taskId}`
    : "im:tasks:chat-editor:form:new";
}

export function chatEditorMessagesStorageKey(taskId: string | undefined): string {
  return taskId
    ? `im:tasks:chat-editor:messages:${taskId}`
    : "im:tasks:chat-editor:messages:new";
}

export function chatEditorInputStorageKey(taskId: string | undefined): string {
  return taskId
    ? `im:tasks:chat-editor:input:${taskId}`
    : "im:tasks:chat-editor:input:new";
}

// ── Leaderboard / logs / viewer / sources ───────────────────────────────────

export const LEADERBOARD_SELECTED_TASK_ID_STORAGE_KEY = "im:leaderboard:selected-task-id";
export const LEADERBOARD_EXPANDED_TOPIC_ID_STORAGE_KEY =
  "im:leaderboard:expanded-topic-id";
export const LOGS_LEVEL_FILTER_STORAGE_KEY = "im:logs:level-filter";
export const LOGS_CATEGORY_FILTER_STORAGE_KEY = "im:logs:category-filter";
export const LOGS_SEARCH_STORAGE_KEY = "im:logs:search";
export const LOGS_SELECTED_ID_STORAGE_KEY = "im:logs:selected-id";
export const LOGS_SHOW_ANALYSIS_TRACE_STORAGE_KEY = "im:logs:show-analysis-trace";
export const VIEWER_TASKS_SELECTED_ID_STORAGE_KEY = "im:viewer:tasks:selected-id";
export const DISCORD_CHANNELS_EXPANDED_STORAGE_KEY =
  "im:sources:discord:channels-expanded";

// ── Assistant / voice / runtime / profile ───────────────────────────────────

export const ASSISTANT_COMPOSER_DRAFTS_STORAGE_KEY = "im:assistant:composer-drafts";
/** SoT — re-exported by `domain/assistant/assistantSessions` (do not redefine there). */
export const ASSISTANT_SESSIONS_CHANGED_EVENT = "im:assistant-sessions-changed";
export const ASSISTANT_CLIENT_INSTANCE_STORAGE_KEY = "im:assistant:client-instance-id";
export const VOICE_SETTINGS_CHANGED_EVENT = "im:voice-settings-changed";
export const VOICE_REMINDER_SETTINGS_CHANGED_EVENT = "im:voice-reminder-settings-changed";
export const VOICE_REMINDER_HISTORY_CHANGED_EVENT = "im:voice-reminder-history-changed";
export const RUNTIME_LOG_CACHE_STORAGE_KEY = "im:runtime:stored-log-cache";
/** SoT — re-exported by `domain/user/userProfile` (do not redefine there). */
export const USER_PROFILE_KEY = "im:user:profile:v1";
export const USER_PROFILE_EVENT = "im:user:profile:v1-change";
/** sessionStorage: unsaved profile editor fields (not the committed SoT key above). */
export const USER_PROFILE_DRAFT_KEY = "im:user:profile:draft:v1";
export const CONNECTION_STORAGE_KEY = "im:connection";
