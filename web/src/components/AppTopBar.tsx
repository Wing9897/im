import { isElectronDesktop } from "../electron/electronWindow";
import { ShellChromeCore } from "./ShellChromeCore";

/**
 * Browser (non-Electron) global top bar — full-width above the sidebar.
 * Shared controls live in {@link ShellChromeCore}; desktop OS window buttons
 * stay in {@link DesktopTitleBar} only.
 */
export function AppTopBar() {
  if (isElectronDesktop()) {
    return null;
  }

  return (
    <header
      className="im-surface-chrome z-10 flex h-[var(--app-top-bar-height,52px)] shrink-0 items-center gap-md border-b border-[var(--surface-border-alpha,var(--surface-border))] px-2xl"
      data-testid="app-top-bar"
    >
      <ShellChromeCore layout="web" />
    </header>
  );
}
