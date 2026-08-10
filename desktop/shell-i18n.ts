/**
 * Shared desktop-shell copy for tray / menu / crash / schema dialogs.
 * Locale is pushed from the renderer via ``setNotificationLocale`` IPC.
 */

export type ShellLocale = 'zh-Hant' | 'zh-Hans' | 'en';

export type ServerStatusKey = 'Running' | 'Stopped' | 'Error';

/**
 * Must match ``server/db/schema_inspect.py`` (drift-tested by architecture-invariants).
 * Bump these when SCHEMA stamp / SemVer changes — do not hardcode elsewhere in this file.
 */
export const SHELL_SCHEMA_BASELINE = 25;
export const SHELL_SCHEMA_SEMVER = '0.1.0-beta.26';
/** Inclusive hard-reject ceiling = baseline - 1 when wipe-floor is current-only. */
export const SHELL_SCHEMA_HARD_REJECT_CEILING = SHELL_SCHEMA_BASELINE - 1;

export type ShellCopy = {
  showWindow: string;
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
  const ceiling = SHELL_SCHEMA_HARD_REJECT_CEILING;
  if (locale === 'zh-Hans') {
    return (
      `本地数据库结构不兼容（schema baseline ${baseline}／schemaSemver ${semver}；` +
      `v1–v${ceiling} hard-rejected，旧库须重置）。\n\n` +
      '请先备份数据，再到设置 → 数据 重置，或运行：\n' +
      'scripts/reset_local_databases.py --apply\n\n' +
      '然后重新启动应用程序。'
    );
  }
  if (locale === 'en') {
    return (
      `The local database schema is incompatible (schema baseline ${baseline} / schemaSemver ${semver}; ` +
      `v1–v${ceiling} hard-rejected; older databases must be reset).\n\n` +
      'Back up the data first, then reset with Settings → Data, or run:\n' +
      'scripts/reset_local_databases.py --apply\n\n' +
      'Then restart the app.'
    );
  }
  return (
    `本機資料庫結構不相容（schema baseline ${baseline}／schemaSemver ${semver}；` +
    `v1–v${ceiling} hard-rejected，舊庫須重置）。\n\n` +
    '請先備份資料，再到設定 → 資料 重置，或執行：\n' +
    'scripts/reset_local_databases.py --apply\n\n' +
    '然後重新啟動應用程式。'
  );
}

const SHELL_COPY: Record<ShellLocale, ShellCopy> = {
  'zh-Hant': {
    showWindow: '顯示視窗',
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
