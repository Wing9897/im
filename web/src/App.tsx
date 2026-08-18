import { useEffect, useRef, useState, type HTMLAttributes } from "react";
import { BrowserRouter } from "react-router-dom";
import { AppSidebar, MAIN_SIDEBAR_PREFETCH_PATHS } from "./components/AppSidebar";
import { AppTopBar } from "./components/AppTopBar";
import { DesktopTitleBar } from "./components/DesktopTitleBar";
import { ShellChromeCore } from "./components/ShellChromeCore";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { AppBootGate } from "./components/AppBootGate";
import { AppRuntimeProvider } from "./context/AppRuntimeContext";
import { MonitorModeProvider, useMonitorMode } from "./context/MonitorModeContext";
import { SimpleModeProvider } from "./context/SimpleModeContext";
import { TaskCatalogProvider } from "./context/TaskCatalogContext";
import { ToastProvider } from "./context/ToastContext";
import { AppRoutes } from "./routing/AppRoutes";
import { BoardRoot } from "./board/BoardRoot";
import { CommandPalette } from "./components/CommandPalette";
import { ShortcutHelpDialog } from "./components/ShortcutHelpDialog";
import { AssistantQuickDialog } from "./components/AssistantQuickDialog";
import { CalendarImportHost } from "./components/calendar/CalendarImportHost";
import { RecentDayInboxDrawer } from "./components/notify/RecentDayInboxDrawer";
import { NotifyFlashHost } from "./components/notify/NotifyFlashHost";
import { CommandPaletteProvider } from "./hooks/useCommandPalette";
import { AssistantQuickProvider } from "./hooks/useAssistantQuick";
import { AssistantChatProvider } from "./hooks/useAssistantChat";
import { isElectronDesktop } from "./electron/electronWindow";
import { useRevealScrollbarOnScroll } from "./hooks/useRevealScrollbarOnScroll";
import { prefetchRoute } from "./routing/prefetchRoute";
import { useFocalBackgroundAutoRefresh } from "./hooks/useFocalBackgroundAutoRefresh";
import { applyTheme, getStoredThemeId, loadBgForTheme } from "./styles/themeData";
import { useNotifyScanner } from "./domain/notify/scanner/useNotifyScanner";

/**
 * App shell entry (pages ↔ canvas).
 *
 * INVARIANTS:
 * - Dual keep-mount: BoardRoot + pages pane stay mounted; hide with
 *   `shellVisibilityProps` (Tailwind `hidden` + `inert`). Do NOT unmount the
 *   inactive shell (loses deep-link / scroll / widget state).
 * - Pages pane is painted after board so a failed hide cannot steal sidebar clicks.
 * - Left nav is a surface overlay (portal drawer) at shell level for all pages;
 *   page canvas is always full-bleed. Overlay sidebar is a translucent panel
 *   (color-mix of --surface-card); the scrim is a light dim with no blur so
 *   the main canvas stays sharp. Do not clone wallpaper onto the drawer.
 * - Leave board immersive when leaving canvas; board poll must stay gated to canvas
 *   (`useBoardWidgetPoll`).
 * - Chrome forks: Electron `DesktopTitleBar` vs web `AppTopBar` vs canvas
 *   `BrowserCanvasBar` — window controls stay desktop-only (`ShellChromeCore`).
 * Regression fences: `Board.smoke.test.tsx`, canvas nav / shell chrome tests.
 */

/**
 * Hide a shell from layout + focus/interaction without unmounting.
 * Shells are absolutely stacked; the pages pane is painted after the board pane
 * so a failed hide can never leave the board stealing sidebar clicks.
 * Must use Tailwind `hidden` (display:none): author `.flex` otherwise overrides
 * the UA `[hidden]{display:none}` rule.
 * Hidden shells also set `content-visibility: hidden` so the browser can skip
 * expensive layout/paint while keep-mount preserves React state.
 */
function shellVisibilityProps(
  isHidden: boolean,
): HTMLAttributes<HTMLDivElement> & { className: string } {
  return {
    hidden: isHidden,
    "aria-hidden": isHidden,
    className: isHidden
      ? "pointer-events-none absolute inset-0 z-0 hidden min-h-0 min-w-0 overflow-hidden [content-visibility:hidden]"
      : "absolute inset-0 z-[2] flex min-h-0 min-w-0 overflow-hidden",
    // React 18 types omit `inert`; empty string is the valid HTML boolean form.
    // Only set when hidden — omit when visible so React removes a stuck inert attr.
    ...(isHidden ? ({ inert: "" } as HTMLAttributes<HTMLDivElement>) : {}),
  };
}

// Apply stored theme before first React paint (full data-theme / personalization).
// index.html already sets early data-theme-bg from localStorage.
applyTheme(getStoredThemeId());
loadBgForTheme(getStoredThemeId());

/** Browser canvas top bar — same chrome as pages (assistant + search + status). */
function BrowserCanvasBar() {
  return (
    <header className="browser-monitor-bar" data-testid="browser-monitor-bar">
      <ShellChromeCore
        layout="web"
        brandClassName="browser-monitor-bar__brand"
        modeClassName="browser-monitor-bar__mode"
        actionsClassName="browser-monitor-bar__actions"
      />
    </header>
  );
}

function AppShellBody() {
  const desktopShell = isElectronDesktop();
  const { monitorMode } = useMonitorMode();
  const mainScrollRef = useRef<HTMLDivElement>(null);
  useFocalBackgroundAutoRefresh();
  const [boardImmersive, setBoardImmersive] = useState(false);
  useRevealScrollbarOnScroll(mainScrollRef);
  useNotifyScanner();

  const isCanvas = monitorMode === "canvas";

  // Leave immersive when switching away from canvas (board may stay mounted).
  useEffect(() => {
    if (!isCanvas) {
      setBoardImmersive(false);
    }
  }, [isCanvas]);

  // Warm main sidebar lazy chunks after first paint (idle), so first click is snappy.
  useEffect(() => {
    const prefetchMainRoutes = () => {
      for (const path of MAIN_SIDEBAR_PREFETCH_PATHS) {
        prefetchRoute(path);
      }
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(prefetchMainRoutes);
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(prefetchMainRoutes, 1);
    return () => window.clearTimeout(timer);
  }, []);

  const showShellChrome = !boardImmersive;

  return (
    <div
      className="im-app-shell flex h-screen min-h-screen flex-col overflow-hidden text-text-primary"
      data-testid={isCanvas ? "app-shell-canvas" : "app-shell-pages"}
      data-monitor-mode={monitorMode}
      data-shell-mount="dual"
      data-board-immersive={boardImmersive ? "true" : undefined}
    >
      {showShellChrome && desktopShell ? (
        <DesktopTitleBar />
      ) : showShellChrome && isCanvas ? (
        <BrowserCanvasBar />
      ) : showShellChrome ? (
        <AppTopBar />
      ) : null}

      {/* Exclusive full-bleed shells: board first, pages second so pages wins
          hit-testing if a hide ever fails. Only one is visible at a time. */}
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <div
          data-testid="app-shell-board-pane"
          data-shell-pane="board"
          {...shellVisibilityProps(!isCanvas)}
        >
          <BoardRoot onImmersiveChange={setBoardImmersive} />
        </div>

        <div
          data-testid="app-shell-pages-pane"
          data-shell-pane="pages"
          {...shellVisibilityProps(isCanvas)}
        >
          <div
            ref={mainScrollRef}
            className="im-auto-scrollbar im-page-canvas flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto px-sm"
            data-testid="app-shell-page-canvas"
          >
            <main className="app-main-content flex min-h-0 min-w-0 w-full flex-1 flex-col">
              <AppRoutes />
            </main>
          </div>
        </div>
      </div>
      <AppSidebar />
    </div>
  );
}

function AppShell() {
  return (
    <AppRuntimeProvider>
      <TaskCatalogProvider>
        <ToastProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <SimpleModeProvider>
              <MonitorModeProvider>
                <AssistantChatProvider>
                  <AssistantQuickProvider>
                    <CommandPaletteProvider>
                      <AppShellBody />
                      <CommandPalette />
                      <ShortcutHelpDialog />
                      <AssistantQuickDialog />
                      <CalendarImportHost />
                      <RecentDayInboxDrawer />
                      <NotifyFlashHost />
                    </CommandPaletteProvider>
                  </AssistantQuickProvider>
                </AssistantChatProvider>
              </MonitorModeProvider>
            </SimpleModeProvider>
          </BrowserRouter>
        </ToastProvider>
      </TaskCatalogProvider>
    </AppRuntimeProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppBootGate>
        <AppShell />
      </AppBootGate>
    </ErrorBoundary>
  );
}

export { App };
