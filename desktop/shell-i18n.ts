/**
 * Shared desktop-shell copy for tray / menu / crash / schema dialogs.
 * Locale is pushed from the renderer via ``setNotificationLocale`` IPC.
 */

export type ShellLocale = 'zh-Hant' | 'zh-Hans' | 'en';

/** Stored UI language preference (manual lock or follow OS / browser). */
export type ShellLocalePreference = 'auto' | ShellLocale;

export const SHELL_LOCALE_PREFERENCES: readonly ShellLocalePreference[] = [
  'auto',
  'zh-Hant',
  'zh-Hans',
  'en',
];

export type ServerStatusKey = 'Running' | 'Stopped' | 'Error';

/**
 * Must match ``server/db/schema_inspect.py`` (drift-tested by architecture-invariants).
 * Bump these when SCHEMA stamp / SemVer changes — do not hardcode elsewhere in this file.
 */
export const SHELL_SCHEMA_BASELINE = 4;
export const SHELL_SCHEMA_SEMVER = '1.3.0';
/** Schema floor (must match ``SCHEMA_FLOOR``). Stamp 1 auto-upgrades; future stamps reject. */
export const SHELL_SCHEMA_FLOOR = 1;

export type ShellCopy = {
  showWindow: string;
  languageMenu: string;
  languageAuto: string;
  languageZhHant: string;
  languageZhHans: string;
  languageEn: string;
  analysisMenu: string;
  pauseAnalysis: string;
  resumeAnalysis: string;
  emergencyAbort: string;
  abortDialogTitle: string;
  abortDialogBody: string;
  abortConfirm: string;
  abortCancel: string;
  restartServer: string;
  quit: string;
  statusRunning: string;
  statusStopped: string;
  statusError: string;
  menuEdit: string;
  menuView: string;
  menuWindow: string;
  serverCrashedBody: string;
  serverStartFailedTitle: string;
  serverStartFailedBody: (message: string) => string;
  incompatibleDatabaseTitle: string;
  schemaHardRejectHint: string;
  serverStartupTimeoutTitle: string;
  serverStartupTimeoutBody: (seconds: number, schemaHint: string) => string;
  analysisCompleted: string;
  analysisFailed: string;
  unknownError: string;
};

const PRODUCT_NAME = 'Intelligence Monitor';

function schemaHardRejectHint(locale: ShellLocale): string {
  const baseline = SHELL_SCHEMA_BASELINE;
  const semver = SHELL_SCHEMA_SEMVER;
  const floor = SHELL_SCHEMA_FLOOR;
  if (locale === 'zh-Hans') {
    return (
      `本地数据库结构不兼容（schema baseline ${baseline}／schemaSemver ${semver}／SCHEMA_FLOOR ${floor}；` +
      `stamp 1 会经 SCHEMA_MIGRATIONS 自动升到 ${baseline}）。\n\n` +
      '未来 stamp：请升级应用。坏库／无法识别：请先备份，再到设置 → 数据 重置，或运行：\n' +
      'scripts/reset_local_databases.py --apply\n\n' +
      '然后重新启动应用程序。'
    );
  }
  if (locale === 'en') {
    return (
      `The local database schema is incompatible (schema baseline ${baseline} / schemaSemver ${semver} / SCHEMA_FLOOR ${floor}; ` +
      `stamp 1 auto-upgrades via SCHEMA_MIGRATIONS to ${baseline}).\n\n` +
      'Future stamps: update the application. Corrupt or unrecognized databases: back up, then reset with Settings → Data, or run:\n' +
      'scripts/reset_local_databases.py --apply\n\n' +
      'Then restart the app.'
    );
  }
  return (
    `本機資料庫結構不相容（schema baseline ${baseline}／schemaSemver ${semver}／SCHEMA_FLOOR ${floor}；` +
    `stamp 1 會經 SCHEMA_MIGRATIONS 自動升到 ${baseline}）。\n\n` +
    '未來 stamp：請升級應用。壞庫／無法識別：請先備份，再到設定 → 資料 重置，或執行：\n' +
    'scripts/reset_local_databases.py --apply\n\n' +
    '然後重新啟動應用程式。'
  );
}

const SHELL_COPY: Record<ShellLocale, ShellCopy> = {
  'zh-Hant': {
    showWindow: '顯示視窗',
    languageMenu: '介面語言',
    languageAuto: '自動',
    languageZhHant: '繁體中文',
    languageZhHans: '简体中文',
    languageEn: 'English',
    analysisMenu: 'AI 分析',
    pauseAnalysis: '暫停分析',
    resumeAnalysis: '繼續分析',
    emergencyAbort: '緊急中止…',
    abortDialogTitle: '緊急中止分析',
    abortDialogBody: '確定要緊急中止所有分析嗎？此操作無法復原。',
    abortConfirm: '緊急中止',
    abortCancel: '取消',
    restartServer: '重新啟動伺服器',
    quit: '結束',
    statusRunning: '執行中',
    statusStopped: '已停止',
    statusError: '錯誤',
    menuEdit: '編輯',
    menuView: '檢視',
    menuWindow: '視窗',
    serverCrashedBody: '伺服器意外停止，正在嘗試重新啟動…',
    serverStartFailedTitle: '伺服器啟動失敗',
    serverStartFailedBody: (message) => `無法啟動內建伺服器：\n\n${message}`,
    incompatibleDatabaseTitle: '資料庫不相容',
    schemaHardRejectHint: schemaHardRejectHint('zh-Hant'),
    serverStartupTimeoutTitle: '伺服器啟動逾時',
    serverStartupTimeoutBody: (seconds, schemaHint) =>
      `伺服器未能在 ${seconds} 秒內啟動。請檢查日誌以取得詳細資訊。\n\n${schemaHint}`,
    analysisCompleted: '分析完成',
    analysisFailed: '分析失敗',
    unknownError: '未知錯誤',
  },
  'zh-Hans': {
    showWindow: '显示窗口',
    languageMenu: '界面语言',
    languageAuto: '自动',
    languageZhHant: '繁體中文',
    languageZhHans: '简体中文',
    languageEn: 'English',
    analysisMenu: 'AI 分析',
    pauseAnalysis: '暂停分析',
    resumeAnalysis: '继续分析',
    emergencyAbort: '紧急中止…',
    abortDialogTitle: '紧急中止分析',
    abortDialogBody: '确定要紧急中止所有分析吗？此操作无法复原。',
    abortConfirm: '紧急中止',
    abortCancel: '取消',
    restartServer: '重新启动服务器',
    quit: '退出',
    statusRunning: '运行中',
    statusStopped: '已停止',
    statusError: '错误',
    menuEdit: '编辑',
    menuView: '查看',
    menuWindow: '窗口',
    serverCrashedBody: '服务器意外停止，正在尝试重新启动…',
    serverStartFailedTitle: '服务器启动失败',
    serverStartFailedBody: (message) => `无法启动内置服务器：\n\n${message}`,
    incompatibleDatabaseTitle: '数据库不兼容',
    schemaHardRejectHint: schemaHardRejectHint('zh-Hans'),
    serverStartupTimeoutTitle: '服务器启动超时',
    serverStartupTimeoutBody: (seconds, schemaHint) =>
      `服务器未能在 ${seconds} 秒内启动。请检查日志以获取详细信息。\n\n${schemaHint}`,
    analysisCompleted: '分析完成',
    analysisFailed: '分析失败',
    unknownError: '未知错误',
  },
  en: {
    showWindow: 'Show Window',
    languageMenu: 'Interface language',
    languageAuto: 'Auto',
    languageZhHant: '繁體中文',
    languageZhHans: '简体中文',
    languageEn: 'English',
    analysisMenu: 'AI analysis',
    pauseAnalysis: 'Pause analysis',
    resumeAnalysis: 'Resume analysis',
    emergencyAbort: 'Emergency abort…',
    abortDialogTitle: 'Emergency abort analysis',
    abortDialogBody: 'Abort all analysis now? This cannot be undone.',
    abortConfirm: 'Emergency abort',
    abortCancel: 'Cancel',
    restartServer: 'Restart Server',
    quit: 'Quit',
    statusRunning: 'Running',
    statusStopped: 'Stopped',
    statusError: 'Error',
    menuEdit: 'Edit',
    menuView: 'View',
    menuWindow: 'Window',
    serverCrashedBody: 'Server crashed unexpectedly. Attempting restart...',
    serverStartFailedTitle: 'Server Start Failed',
    serverStartFailedBody: (message) =>
      `Failed to start the bundled server:\n\n${message}`,
    incompatibleDatabaseTitle: 'Incompatible Database',
    schemaHardRejectHint: schemaHardRejectHint('en'),
    serverStartupTimeoutTitle: 'Server Startup Timeout',
    serverStartupTimeoutBody: (seconds, schemaHint) =>
      `Server failed to start within ${seconds} seconds. Check logs for details.\n\n${schemaHint}`,
    analysisCompleted: 'Analysis completed',
    analysisFailed: 'Analysis failed',
    unknownError: 'Unknown error',
  },
};

let uiLocale: ShellLocale = 'zh-Hant';
const localeListeners = new Set<() => void>();

export function normalizeShellLocale(value: string | null | undefined): ShellLocale {
  if (value === 'en' || value === 'zh-Hans' || value === 'zh-Hant') return value;
  return 'zh-Hant';
}

export function isShellLocalePreference(value: unknown): value is ShellLocalePreference {
  return value === 'auto' || value === 'en' || value === 'zh-Hans' || value === 'zh-Hant';
}

export function normalizeShellLocalePreference(
  value: unknown,
): ShellLocalePreference {
  return isShellLocalePreference(value) ? value : 'zh-Hant';
}

export function getShellLocale(): ShellLocale {
  return uiLocale;
}

/** Product name stays English across locales. */
export function getProductName(): string {
  return PRODUCT_NAME;
}

export function getShellCopy(locale: ShellLocale = uiLocale): ShellCopy {
  return SHELL_COPY[locale];
}

export function formatTrayTooltip(
  status: ServerStatusKey,
  locale: ShellLocale = uiLocale,
): string {
  const copy = SHELL_COPY[locale];
  const statusLabel =
    status === 'Running'
      ? copy.statusRunning
      : status === 'Stopped'
        ? copy.statusStopped
        : copy.statusError;
  return `${PRODUCT_NAME} - ${statusLabel}`;
}

/**
 * Push UI locale for desktop shell + notification copy.
 * Notifies subscribers (tray / menu rebuild).
 */
export function setShellLocale(locale: string | null | undefined): void {
  const next = normalizeShellLocale(locale);
  if (next === uiLocale) return;
  uiLocale = next;
  for (const listener of localeListeners) {
    listener();
  }
}

/** Subscribe to locale changes; returns unsubscribe. */
export function onShellLocaleChange(listener: () => void): () => void {
  localeListeners.add(listener);
  return () => {
    localeListeners.delete(listener);
  };
}

/** Test helper: reset locale + listeners. */
export function resetShellLocaleForTests(): void {
  uiLocale = 'zh-Hant';
  localeListeners.clear();
}
