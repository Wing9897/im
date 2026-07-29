import { DESKTOP_SHELL_KEY } from "./electronPersistedKeys";

interface ElectronWindowApi {
  isDesktopShell: true;
  getState: () => Promise<{ isMaximized: boolean }>;
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void;
}

declare global {
  interface Window {
    electronWindow?: ElectronWindowApi;
  }
}

function persistDesktopShell(): void {
  try {
    sessionStorage.setItem(DESKTOP_SHELL_KEY, "1");
  } catch {
    // ignore quota / private mode
  }
}

function hasPersistedDesktopShell(): boolean {
  try {
    return sessionStorage.getItem(DESKTOP_SHELL_KEY) === "1";
  } catch {
    return false;
  }
}

function hasDesktopQueryFlag(): boolean {
  return new URLSearchParams(window.location.search).get("desktop") === "1";
}

export function getElectronWindow(): ElectronWindowApi | undefined {
  return window.electronWindow;
}

/** True when running inside the Electron desktop shell (survives SPA navigation). */
export function isElectronDesktop(): boolean {
  if (window.electronWindow?.isDesktopShell === true) {
    persistDesktopShell();
    return true;
  }
  if (hasDesktopQueryFlag()) {
    persistDesktopShell();
    return true;
  }
  return hasPersistedDesktopShell();
}
