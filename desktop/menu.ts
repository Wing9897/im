import { Menu, MenuItemConstructorOptions } from 'electron';
import { getShellCopy } from './shell-i18n';

/**
 * Configuration for building the application menu.
 */
export interface MenuConfig {
  appName: string;
  isMac: boolean;
}

let lastMenuConfig: MenuConfig | null = null;

/**
 * Builds and returns the native application menu.
 *
 * Menu structure:
 * - Edit: Undo, Redo, Cut, Copy, Paste, Select All
 * - View: Reload, Toggle DevTools, Zoom In, Zoom Out, Reset Zoom
 * - Window: Minimize, Close
 * - macOS only: App menu with About and Quit (prepended)
 */
export function buildApplicationMenu(config: MenuConfig): Menu {
  lastMenuConfig = config;
  const { appName, isMac } = config;
  const copy = getShellCopy();

  const editMenu: MenuItemConstructorOptions = {
    label: copy.menuEdit,
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ],
  };

  const viewMenu: MenuItemConstructorOptions = {
    label: copy.menuView,
    submenu: [
      { role: 'reload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { role: 'resetZoom' },
    ],
  };

  const windowMenu: MenuItemConstructorOptions = {
    label: copy.menuWindow,
    submenu: [
      { role: 'minimize' },
      { role: 'close' },
    ],
  };

  const template: MenuItemConstructorOptions[] = [editMenu, viewMenu, windowMenu];

  // macOS: prepend app menu with About and Quit
  if (isMac) {
    const macAppMenu: MenuItemConstructorOptions = {
      label: appName,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    };
    template.unshift(macAppMenu);
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  return menu;
}

/** Rebuild the application menu using the last config + current locale. */
export function refreshApplicationMenu(): void {
  if (lastMenuConfig) {
    buildApplicationMenu(lastMenuConfig);
  }
}
