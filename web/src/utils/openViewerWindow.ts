import { isElectronDesktop } from "../electron/electronWindow";

/** Open the LAN viewer UI in a new window (frameless when Electron handles it). */
export function openViewerWindow(): Window | null {
  const url = new URL("/viewer", window.location.origin);
  if (isElectronDesktop()) {
    url.searchParams.set("desktop", "1");
  }
  return window.open(url.toString(), "_blank", "noopener,noreferrer");
}
