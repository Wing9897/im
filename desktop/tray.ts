import { Tray, Menu, BrowserWindow, app, nativeImage } from 'electron';
import {
  formatTrayTooltip,
  getShellCopy,
  type ServerStatusKey,
} from './shell-i18n';

/** Server status values displayed in the tray tooltip (stable English keys). */
export type ServerStatus = ServerStatusKey;

let tray: Tray | null = null;
let mainWindowRef: BrowserWindow | null = null;
let restartServerHandler: (() => void) | null = null;
let showRestartServer = true;

// Current state for tooltip
let currentStatus: ServerStatus = 'Stopped';

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
          mainWindowRef.show();
          mainWindowRef.focus();
        }
      },
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
}

/**
 * Creates and manages the system tray icon with context menu.
 *
 * Context menu items:
 *  - Show Window → show and focus window
 *  - Separator
 *  - Restart Server → calls the provided restart handler
 *  - Separator
 *  - Quit → quit application
 *
 * Double-clicking the tray icon shows and focuses the window.
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

  applyTrayChrome();

  // Double-click on tray icon shows and focuses the window
  tray.on('double-click', () => {
    if (mainWindowRef) {
      mainWindowRef.show();
      mainWindowRef.focus();
    }
  });

  return tray;
}

/**
 * Rebuild tray tooltip + context menu for the current UI locale.
 */
export function refreshTrayLocale(): void {
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
  currentStatus = 'Stopped';
}
