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
export const SHELL_SCHEMA_BASELINE = 7;
export const SHELL_SCHEMA_SEMVER = '1.6.0';
/** Schema floor (must match ``SCHEMA_FLOOR``). Stamp 7 is current; stamp 1–6 reject. */
export const SHELL_SCHEMA_FLOOR = 7;

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
  schemaResetRequiredTitle: string;
  schemaResetRequiredHeadline: string;
  schemaResetRequiredBody: string;
  schemaFutureStampTitle: string;
  schemaFutureStampHeadline: string;
  schemaFutureStampBody: string;
  schemaDetailsToggle: string;
  schemaOpenFolder: string;
  schemaResetAndRetry: string;
  schemaQuit: string;
  schemaResetConfirmTitle: string;
  schemaResetConfirmBody: string;
  schemaResetConfirm: string;
  schemaResetCancel: string;
  schemaResetFailedTitle: string;
  schemaResetFailedBody: string;
  schemaResetDoneTitle: string;
  schemaResetDoneBody: string;
  schemaRelaunch: string;
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
      `SCHEMA_MIGRATIONS 为空。stamp 1–6 请先备份再重置）。\n\n` +
      '未来 stamp：请升级应用。坏库／无法识别：请先备份，再于启动对话框选择“重置数据库”，完成后重新启动，或运行：\n' +
      'scripts/reset_local_databases.py --apply\n\n' +
      '然后重新启动应用程序。'
    );
  }
  if (locale === 'en') {
    return (
      `The local database schema is incompatible (schema baseline ${baseline} / schemaSemver ${semver} / SCHEMA_FLOOR ${floor}; ` +
      `SCHEMA_MIGRATIONS is empty. Stamp 1–6: back up, then reset).\n\n` +
      'Future stamps: update the application. Corrupt or unrecognized databases: back up, then choose “Reset database” in the startup dialog and restart, or run:\n' +
      'scripts/reset_local_databases.py --apply\n\n' +
      'Then restart the app.'
    );
  }
  return (
    `本機資料庫結構不相容（schema baseline ${baseline}／schemaSemver ${semver}／SCHEMA_FLOOR ${floor}；` +
    `SCHEMA_MIGRATIONS 為空。stamp 1–6 請先備份再重置）。\n\n` +
      '未來 stamp：請升級應用。壞庫／無法識別：請先備份，再於啟動對話框選擇「重置資料庫」，完成後重新啟動，或執行：\n' +
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
    schemaResetRequiredTitle: '無法使用此資料庫',
    schemaResetRequiredHeadline: '此版本無法原地升級舊資料庫',
    schemaResetRequiredBody:
      '目前安裝的 Intelligence Monitor 無法將這份舊資料庫升級到可用結構，也不會遷移既有資料。請先備份，再重置本機資料庫。完成後會請你重新啟動應用程式以建立全新資料庫；原有內容只會保留在同一資料夾的備份中。',
    schemaFutureStampTitle: '資料庫版本較新',
    schemaFutureStampHeadline: '請改安裝較新版本的應用程式',
    schemaFutureStampBody:
      '這份資料庫是由較新版本的 Intelligence Monitor 建立的，目前安裝無法讀取。請升級應用程式。重置是最後手段，會清除本機資料且無法遷移。',
    schemaDetailsToggle: '詳細資料',
    schemaOpenFolder: '開啟資料夾',
    schemaResetAndRetry: '重置資料庫',
    schemaQuit: '結束',
    schemaResetConfirmTitle: '確定要重置資料庫？',
    schemaResetConfirmBody:
      '系統會先把現有資料庫備份到同一資料夾，再刪除本機資料庫檔。此版本不會遷移舊資料。完成後會請你重新啟動應用程式。',
    schemaResetConfirm: '備份並重置',
    schemaResetCancel: '取消',
    schemaResetFailedTitle: '無法重置資料庫',
    schemaResetFailedBody: '無法備份或刪除本機資料庫。請確認沒有其他 Intelligence Monitor 視窗正在使用該檔案，然後重試。',
    schemaResetDoneTitle: '資料庫已重置',
    schemaResetDoneBody: '備份已寫入同一資料夾。請重新啟動應用程式以建立全新資料庫並進入首次設定。',
    schemaRelaunch: '重新啟動',
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
    schemaResetRequiredTitle: '无法使用此数据库',
    schemaResetRequiredHeadline: '此版本无法原地升级旧数据库',
    schemaResetRequiredBody:
      '当前安装的 Intelligence Monitor 无法将这份旧数据库升级到可用结构，也不会迁移既有数据。请先备份，再重置本地数据库。完成后会请你重新启动应用程序以建立全新数据库；原有内容只会保留在同一文件夹的备份中。',
    schemaFutureStampTitle: '数据库版本较新',
    schemaFutureStampHeadline: '请改安装较新版本的应用程序',
    schemaFutureStampBody:
      '这份数据库由较新版本的 Intelligence Monitor 创建，当前安装无法读取。请升级应用程序。重置是最后手段，会清除本地数据且无法迁移。',
    schemaDetailsToggle: '详细资料',
    schemaOpenFolder: '打开文件夹',
    schemaResetAndRetry: '重置数据库',
    schemaQuit: '退出',
    schemaResetConfirmTitle: '确定要重置数据库？',
    schemaResetConfirmBody:
      '系统会先把现有数据库备份到同一文件夹，再删除本地数据库文件。此版本不会迁移旧数据。完成后会请你重新启动应用程序。',
    schemaResetConfirm: '备份并重置',
    schemaResetCancel: '取消',
    schemaResetFailedTitle: '无法重置数据库',
    schemaResetFailedBody: '无法备份或删除本地数据库。请确认没有其他 Intelligence Monitor 窗口正在使用该文件，然后重试。',
    schemaResetDoneTitle: '数据库已重置',
    schemaResetDoneBody: '备份已写入同一文件夹。请重新启动应用程序以建立全新数据库并进入首次设置。',
    schemaRelaunch: '重新启动',
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
    schemaResetRequiredTitle: 'This database cannot be used',
    schemaResetRequiredHeadline: 'This version cannot upgrade this older database in place',
    schemaResetRequiredBody:
      'This installation of Intelligence Monitor cannot upgrade this older database in place, and will not migrate existing data. Back up first, then reset the local database. You will be asked to restart the app so it can create a new empty database; original content is kept only in the backup in the same folder.',
    schemaFutureStampTitle: 'Database is newer than this app',
    schemaFutureStampHeadline: 'Install a newer version of the application',
    schemaFutureStampBody:
      'This database was created by a newer version of Intelligence Monitor and cannot be opened here. Update the application. Reset is a last resort: it deletes local data and will not migrate it.',
    schemaDetailsToggle: 'Technical details',
    schemaOpenFolder: 'Open folder',
    schemaResetAndRetry: 'Reset database',
    schemaQuit: 'Quit',
    schemaResetConfirmTitle: 'Reset the database?',
    schemaResetConfirmBody:
      'The current database will be copied into a backup folder next to it, then the live files will be deleted. This version will not migrate old data. You will then be asked to restart the app.',
    schemaResetConfirm: 'Back up and reset',
    schemaResetCancel: 'Cancel',
    schemaResetFailedTitle: 'Could not reset the database',
    schemaResetFailedBody:
      'The local database could not be backed up or deleted. Make sure no other Intelligence Monitor window is using the file, then try again.',
    schemaResetDoneTitle: 'Database reset',
    schemaResetDoneBody:
      'A backup was written in the same folder. Restart the app to create a new empty database and continue first-run setup.',
    schemaRelaunch: 'Restart',
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
