import { Tray, Menu, BrowserWindow, app, nativeImage, dialog } from 'electron';
import {
  formatTrayTooltip,
  getShellCopy,
  setShellLocale,
  type ServerStatusKey,
  type ShellLocalePreference,
} from './shell-i18n';

export type AnalysisTrayCommand = 'pause' | 'resume' | 'abort';

/** Server status values displayed in the tray tooltip (stable English keys). */
export type ServerStatus = ServerStatusKey;

let tray: Tray | null = null;
let mainWindowRef: BrowserWindow | null = null;
let restartServerHandler: (() => void) | null = null;
let showRestartServer = true;
let localePreference: ShellLocalePreference = 'zh-Hant';
let analysisPaused = false;
let analysisControlsEnabled = false;
let onLocalePreferenceHandler: ((pref: ShellLocalePreference) => void) | null = null;
let onAnalysisCommandHandler: ((command: AnalysisTrayCommand) => void) | null = null;

// Current state for tooltip
let currentStatus: ServerStatus = 'Stopped';

/**
 * Tray left-click steals focus on Windows before `click` fires. Treat a blur
 * within this window as still-focused so a second click can hide the window.
 */
const TRAY_BLUR_HIDE_MS = 250;
let lastBlurAt = 0;
let blurTrackingBound = false;

function showAndFocusWindow(win: BrowserWindow): void {
  if (typeof win.isDestroyed === 'function' && win.isDestroyed()) return;
  if (typeof win.isMinimized === 'function' && win.isMinimized()) {
    win.restore();
  }
  win.show();
  win.focus();
}

/**
 * Cursor-style tray click: hide when the window is in front; otherwise show.
 * Visible + unfocused (e.g. behind another app) focuses rather than hiding.
 */
function toggleWindowFromTray(): void {
  const win = mainWindowRef;
  if (!win) return;
  if (typeof win.isDestroyed === 'function' && win.isDestroyed()) return;

  const minimized = typeof win.isMinimized === 'function' && win.isMinimized();
  if (minimized) {
    showAndFocusWindow(win);
    return;
  }

  const visible = typeof win.isVisible !== 'function' || win.isVisible();
  const focused = typeof win.isFocused === 'function' ? win.isFocused() : true;
  const recentlyBlurred = Date.now() - lastBlurAt < TRAY_BLUR_HIDE_MS;

  if (visible && (focused || recentlyBlurred)) {
    win.hide();
    return;
  }

  showAndFocusWindow(win);
}

function bindWindowBlurTracking(win: BrowserWindow): void {
  if (blurTrackingBound || typeof win.on !== 'function') return;
  blurTrackingBound = true;
  win.on('blur', () => {
    lastBlurAt = Date.now();
  });
}

function applyLocalePreference(pref: ShellLocalePreference): void {
  localePreference = pref;
  if (pref !== 'auto') {
    setShellLocale(pref);
  }
  applyTrayChrome();
  onLocalePreferenceHandler?.(pref);
}

async function confirmEmergencyAbort(): Promise<boolean> {
  const copy = getShellCopy();
  const options: Electron.MessageBoxOptions = {
    type: 'warning',
    buttons: [copy.abortConfirm, copy.abortCancel],
    defaultId: 1,
    cancelId: 1,
    title: copy.abortDialogTitle,
    message: copy.abortDialogTitle,
    detail: copy.abortDialogBody,
    noLink: true,
  };

  const win = mainWindowRef;
  const usable =
    win &&
    (typeof win.isDestroyed !== 'function' || !win.isDestroyed());

  const result = usable
    ? await dialog.showMessageBox(win, options)
    : await dialog.showMessageBox(options);
  return result.response === 0;
}

function buildLanguageSubmenu(): Electron.MenuItemConstructorOptions[] {
  const copy = getShellCopy();
  const items: Array<{ pref: ShellLocalePreference; label: string }> = [
    { pref: 'auto', label: copy.languageAuto },
    { pref: 'zh-Hant', label: copy.languageZhHant },
    { pref: 'zh-Hans', label: copy.languageZhHans },
    { pref: 'en', label: copy.languageEn },
  ];
  return items.map(({ pref, label }) => ({
    label,
    type: 'radio',
    checked: localePreference === pref,
    click: () => {
      applyLocalePreference(pref);
    },
  }));
}

function buildAnalysisSubmenu(): Electron.MenuItemConstructorOptions[] {
  const copy = getShellCopy();
  return [
    {
      label: analysisPaused ? copy.resumeAnalysis : copy.pauseAnalysis,
      enabled: analysisControlsEnabled,
      click: () => {
        if (!analysisControlsEnabled) return;
        onAnalysisCommandHandler?.(analysisPaused ? 'resume' : 'pause');
      },
    },
    {
      label: copy.emergencyAbort,
      enabled: analysisControlsEnabled,
      click: () => {
        if (!analysisControlsEnabled) return;
        void confirmEmergencyAbort().then((ok) => {
          if (ok) onAnalysisCommandHandler?.('abort');
        });
      },
    },
  ];
}

/**
 * Builds the context menu template for the tray.
 */
function buildContextMenu(): Electron.Menu {
  const copy = getShellCopy();
  const items: Electron.MenuItemConstructorOptions[] = [
    {
      label: copy.showWindow,
      click: () => {
        if (mainWindowRef) {
          showAndFocusWindow(mainWindowRef);
        }
      },
    },
    { type: 'separator' },
    {
      label: copy.languageMenu,
      submenu: buildLanguageSubmenu(),
    },
    { type: 'separator' },
    {
      label: copy.analysisMenu,
      submenu: buildAnalysisSubmenu(),
    },
  ];

  if (showRestartServer) {
    items.push(
      { type: 'separator' },
      {
        label: copy.restartServer,
        click: () => {
          if (restartServerHandler) {
            restartServerHandler();
          }
        },
      },
    );
  }

  items.push(
    { type: 'separator' },
    {
      label: copy.quit,
      click: () => {
        app.quit();
      },
    },
  );

  return Menu.buildFromTemplate(items);
}

function applyTrayChrome(): void {
  if (!tray) return;
  tray.setToolTip(formatTrayTooltip(currentStatus));
  tray.setContextMenu(buildContextMenu());
}

export interface CreateTrayOptions {
  /** Handler called when "Restart Server" is selected from the context menu. */
  onRestartServer?: () => void;
  /** When false, hides the Restart Server menu item (dev mode). */
  showRestartServer?: boolean;
  /** Tray language radio → renderer `setAppLocalePreference`. */
  onLocalePreference?: (pref: ShellLocalePreference) => void;
  /** Pause / resume / abort after confirmation. */
  onAnalysisCommand?: (command: AnalysisTrayCommand) => void;
}

/**
 * Creates and manages the system tray icon with context menu.
 *
 * Context menu items:
 *  - Show Window → show and focus window
 *  - Interface language → radio submenu (auto / zh-Hant / zh-Hans / en)
 *  - AI analysis → pause/resume + confirmed emergency abort
 *  - Restart Server → calls the provided restart handler (host production)
 *  - Quit → quit application
 *
 * Left-click toggles the window (Cursor-style). Right-click keeps the menu.
 */
export function createTray(
  iconPath: string,
  window: BrowserWindow,
  options?: CreateTrayOptions
): Tray {
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  mainWindowRef = window;
  restartServerHandler = options?.onRestartServer ?? null;
  showRestartServer = options?.showRestartServer ?? true;
  onLocalePreferenceHandler = options?.onLocalePreference ?? null;
  onAnalysisCommandHandler = options?.onAnalysisCommand ?? null;

  applyTrayChrome();
  bindWindowBlurTracking(window);

  // macOS: treat a double-click as two clicks so toggle stays on a single press.
  if (typeof tray.setIgnoreDoubleClickEvents === 'function') {
    tray.setIgnoreDoubleClickEvents(true);
  }

  tray.on('click', () => {
    toggleWindowFromTray();
  });

  return tray;
}

/**
 * Rebuild tray tooltip + context menu for the current UI locale.
 */
export function refreshTrayLocale(): void {
  applyTrayChrome();
}

/** Update language radio from the renderer (LanguageSwitcher / boot sync). */
export function setTrayLocalePreference(pref: ShellLocalePreference): void {
  if (pref === localePreference) return;
  localePreference = pref;
  applyTrayChrome();
}

/** Update pause label + enabled state from the renderer. */
export function setTrayAnalysisState(state: { paused: boolean; enabled: boolean }): void {
  const nextPaused = Boolean(state.paused);
  const nextEnabled = Boolean(state.enabled);
  if (nextPaused === analysisPaused && nextEnabled === analysisControlsEnabled) return;
  analysisPaused = nextPaused;
  analysisControlsEnabled = nextEnabled;
  applyTrayChrome();
}

/**
 * Updates the tray tooltip to reflect the current server status.
 * The update is applied immediately (within the same event loop tick).
 *
 * @param status - Server status: 'Running', 'Stopped', or 'Error'
 */
export function updateTrayStatus(status: ServerStatus): void {
  currentStatus = status;

  if (tray) {
    tray.setToolTip(formatTrayTooltip(status));
  }
}

/**
 * Destroys the tray icon and releases associated resources.
 */
export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
  mainWindowRef = null;
  restartServerHandler = null;
  showRestartServer = true;
  localePreference = 'zh-Hant';
  analysisPaused = false;
  analysisControlsEnabled = false;
  onLocalePreferenceHandler = null;
  onAnalysisCommandHandler = null;
  currentStatus = 'Stopped';
  lastBlurAt = 0;
  blurTrackingBound = false;
}
