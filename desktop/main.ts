import { app, BrowserWindow, dialog, globalShortcut, Notification } from 'electron';
import type { BrowserWindowConstructorOptions } from 'electron';
import * as path from 'path';
import {
  extractImportTargetsFromArgv,
  focusMainWindow,
  handleImportTargets,
  registerCalendarImportIpc,
  registerCalendarImportOsHandlers,
  registerCalendarImportProtocolClient,
  setCalendarImportMainWindow,
  unregisterCalendarImportIpc,
} from './calendar-import';
import { maybeRecoverChromiumDiskCache } from './chromium-cache';
import {
  loadConnection,
  resolveNotificationServerUrl,
  resolveShellLoadUrl,
  withDesktopQuery,
  type ConnectionConfig,
} from './connection';
import { registerConnectionIpc, unregisterConnectionIpc } from './connection-ipc';
import { ProcessManager } from './process-manager';
import { resolveFrontendDistPath, resolveServerCwd, validatePaths } from './paths';
import { createTray, destroyTray, updateTrayStatus, refreshTrayLocale } from './tray';
import { buildApplicationMenu, refreshApplicationMenu } from './menu';
import { initAnalysisNotifications, stopAnalysisNotifications } from './notifications';
import { registerWindowControls, unregisterWindowControls } from './window-controls';
import { getProductName, getShellCopy, onShellLocaleChange } from './shell-i18n';

// macOS may emit open-file / open-url before ready — register early.
registerCalendarImportOsHandlers();

// --- App Configuration ---

const APP_CONFIG = {
  serverPort: 18820,
  viteDevPort: 1420,
  windowWidth: 1280,
  windowHeight: 800,
  windowMinWidth: 900,
  windowMinHeight: 600,
  trayIconPath: path.join(__dirname, '..', 'resources', 'icon.ico'),
};

// --- Parse --dev flag from process.argv ---

const devMode: boolean = process.argv.includes('--dev');

// --- State ---

let mainWindow: BrowserWindow | null = null;
let processManager: ProcessManager | null = null;
let isQuitting = false;
let activeConnection: ConnectionConfig = { mode: 'host' };

// --- Single Instance Lock (Requirement 1.1, 1.2, 1.3, 1.4) ---
// Dev mode skips the lock so `npm run dev` always opens a window even if a
// stale Electron process is still in the tray from a previous session.

const gotLock = devMode || app.requestSingleInstanceLock();

if (!gotLock) {
  // Another instance is already running — exit immediately
  app.quit();
} else {
  if (!devMode) {
    // When a second instance is launched, focus existing window and handle
    // .ics / intelligencemonitor:// args from the new process.
    app.on('second-instance', (_event, commandLine) => {
      focusMainWindow();
      const targets = extractImportTargetsFromArgv(commandLine);
      if (targets.protocolUrl || targets.icsPath) {
        void handleImportTargets(targets);
      }
    });
  }

  // --- App Ready ---

  app.whenReady().then(() => handleAppReady());
}

// --- Window Creation (Requirements 4.1–4.5, 11.1–11.3) ---

// Frameless window — native title bar hidden; custom in-app title bar via preload API.
const FRAMELESS_WINDOW_OPTS: BrowserWindowConstructorOptions = {
  frame: false,
  // Dev keeps the menu visible so View → DevTools works without F12.
  autoHideMenuBar: !devMode,
  ...(process.platform === 'win32' ? { thickFrame: true } : {}),
};

const PRELOAD_SCRIPT = path.join(__dirname, 'preload.js');

function sharedWebPreferences(): BrowserWindowConstructorOptions['webPreferences'] {
  return {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
    preload: PRELOAD_SCRIPT,
  };
}

/**
 * Every window (main shell and children such as Viewer) shares the same
 * frameless chrome, preload wiring and centre-on-first-paint behaviour.
 */
function createShellWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: APP_CONFIG.windowWidth,
    height: APP_CONFIG.windowHeight,
    minWidth: APP_CONFIG.windowMinWidth,
    minHeight: APP_CONFIG.windowMinHeight,
    show: false,
    ...FRAMELESS_WINDOW_OPTS,
    webPreferences: sharedWebPreferences(),
  });

  registerWindowControls(win);
  win.webContents.setWindowOpenHandler(({ url }) => {
    createChildWindow(url);
    return { action: 'deny' };
  });

  win.once('ready-to-show', () => {
    win.center();
    win.show();
  });

  return win;
}

function createChildWindow(url: string): BrowserWindow {
  const win = createShellWindow();
  win.loadURL(withDesktopQuery(url));
  return win;
}

function createWindow(loadUrl: string, retryOnFail: boolean): BrowserWindow {
  const win = createShellWindow();

  win.loadURL(loadUrl);

  win.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`[main] Preload failed (${preloadPath}):`, error);
  });

  // Load failure: capped retries in dev (Vite still starting) or client (remote).
  // Recovery: log + retry; switch mode via connection IPC + restartShell (see README).
  const MAX_LOAD_RETRIES = 5;
  let loadFailRetries = 0;
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`[main] Failed to load ${loadUrl}: ${errorDescription} (${errorCode})`);
    if (!retryOnFail) return;
    if (loadFailRetries >= MAX_LOAD_RETRIES) {
      console.error(
        `[main] Giving up after ${MAX_LOAD_RETRIES} load retries for ${loadUrl}`,
      );
      return;
    }
    loadFailRetries += 1;
    console.log(
      `[main] Retrying connection to server (${loadFailRetries}/${MAX_LOAD_RETRIES})...`,
    );
    setTimeout(() => {
      win.loadURL(loadUrl);
    }, 2000);
  });
  win.webContents.on('did-finish-load', () => {
    loadFailRetries = 0;
  });

  // Production: hide to tray on close. Dev: quit so npm run dev can exit cleanly.
  win.on('close', (event) => {
    if (!isQuitting) {
      if (devMode) {
        app.quit();
        return;
      }
      event.preventDefault();
      win.hide();
    }
  });

  setCalendarImportMainWindow(win);
  return win;
}

async function startHostSidecar(): Promise<boolean> {
  const frontendDist = resolveFrontendDistPath(false);
  const serverCwd = resolveServerCwd(false);
  validatePaths(frontendDist, serverCwd);

  // The PyInstaller sidecar includes Python and all server dependencies.
  // Writable state must live in userData (resources/ is read-only when installed).
  // Same default root as CLI (`server.paths.default_data_dir` / productName).
  const serverExecutable = path.join(
    serverCwd,
    process.platform === 'win32'
      ? 'intelligence-monitor-server.exe'
      : 'intelligence-monitor-server'
  );
  const userData = app.getPath('userData');
  processManager = new ProcessManager({
    command: serverExecutable,
    args: [],
    cwd: serverCwd,
    env: {
      IM_FRONTEND_DIST: frontendDist,
      // Single data root: db + secret.key + sessions/ (+ connection.json beside it).
      INTELLIGENCE_MONITOR_DATA_DIR: userData,
      INTELLIGENCE_MONITOR_DB: path.join(userData, 'intelligence_monitor.db'),
      INTELLIGENCE_MONITOR_SECRET_KEY_FILE: path.join(userData, 'secret.key'),
    },
    healthUrl: `http://localhost:${APP_CONFIG.serverPort}/api/v1/health`,
    healthTimeout: 30000,
    healthInterval: 1000,
    killTimeout: 5000,
  });

  // Wire onUnexpectedExit for notification purposes (Requirement 2.5)
  processManager.onUnexpectedExit((code) => {
    console.warn(`[main] Server exited unexpectedly with code ${code}`);
    if (Notification.isSupported()) {
      new Notification({
        title: getProductName(),
        body: getShellCopy().serverCrashedBody,
      }).show();
    }
  });

  // Start the server; on failure show error dialog and exit (Requirements 2.1, 3.3, 4.1)
  try {
    await processManager.start();
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const copy = getShellCopy();
    dialog.showErrorBox(
      copy.serverStartFailedTitle,
      copy.serverStartFailedBody(message),
    );
    app.exit(1);
    return false;
  }
}

// --- App Lifecycle ---

async function handleAppReady(): Promise<void> {
  // Wipe corrupted Chromium HTTP caches before any BrowserWindow loads a page.
  maybeRecoverChromiumDiskCache(app.getPath('userData'));

  activeConnection = loadConnection(app.getPath('userData'));
  registerConnectionIpc(() => app.getPath('userData'));
  registerCalendarImportIpc();
  registerCalendarImportProtocolClient(devMode);

  const isClient = activeConnection.mode === 'client';

  // host (default): start bundled sidecar in production.
  // client: skip ProcessManager; load remote serverUrl.
  // Dev always skips sidecar (uses Vite / external server).
  if (!devMode && !isClient) {
    const started = await startHostSidecar();
    if (!started) return;
  } else if (isClient) {
    console.log(
      `[main] Client mode — skipping sidecar; UI → ${activeConnection.serverUrl}`,
    );
  }

  // Build and set the native application menu
  buildApplicationMenu({
    appName: getProductName(),
    isMac: process.platform === 'darwin',
  });

  // Rebuild tray/menu when renderer pushes a new UI locale.
  onShellLocaleChange(() => {
    refreshTrayLocale();
    refreshApplicationMenu();
  });

  const loadUrl = resolveShellLoadUrl(activeConnection, {
    devMode,
    serverPort: APP_CONFIG.serverPort,
    viteDevPort: APP_CONFIG.viteDevPort,
  });
  const retryOnFail = devMode || isClient;
  mainWindow = createWindow(loadUrl, retryOnFail);

  // Register global shortcut: Ctrl+Q triggers quit sequence (Requirements 7.4, 7.5)
  globalShortcut.register('CommandOrControl+Q', () => {
    app.quit();
  });

  globalShortcut.register('F12', () => {
    mainWindow?.webContents.toggleDevTools();
  });
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    mainWindow?.webContents.toggleDevTools();
  });

  // Create system tray; restart server only when we own the sidecar
  const showRestartServer = !devMode && !isClient;
  createTray(APP_CONFIG.trayIconPath, mainWindow, {
    showRestartServer,
    onRestartServer: async () => {
      if (processManager) {
        updateTrayStatus('Stopped');
        await processManager.stop();
        try {
          await processManager.start();
          updateTrayStatus('Running');
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          updateTrayStatus('Error');
          console.error(`[main] Server restart failed: ${message}`);
        }
      }
    },
  });

  // Set initial tray status — server is already running at this point (host production)
  if (!devMode && processManager) {
    updateTrayStatus('Running');
  }

  // Initialize analysis notifications (SSE listener → native OS notifications)
  // serverUrl follows connection mode (remote origin when client).
  initAnalysisNotifications(mainWindow, {
    serverUrl: resolveNotificationServerUrl(activeConnection, APP_CONFIG.serverPort),
    enabled: true,
  });

  // Cold-start: Windows/Linux pass .ics path or protocol URL on argv.
  const coldStart = extractImportTargetsFromArgv(process.argv);
  if (coldStart.protocolUrl || coldStart.icsPath) {
    void handleImportTargets(coldStart);
  }
}

// --- Before Quit (Requirements 7.4, 7.5) ---

app.on('before-quit', (event) => {
  if (!isQuitting) {
    isQuitting = true;
    event.preventDefault();

    const shutdown = async () => {
      if (processManager) {
        await processManager.stop();
      }
      app.exit(0);
    };

    shutdown();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopAnalysisNotifications();
  unregisterWindowControls();
  unregisterConnectionIpc();
  unregisterCalendarImportIpc();
  setCalendarImportMainWindow(null);
  destroyTray();
});
