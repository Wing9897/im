import { useCallback, useEffect, useReducer, useRef, useState, type HTMLAttributes } from "react";
import { BrowserRouter } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppSidebar, MAIN_SIDEBAR_PREFETCH_PATHS } from "./components/AppSidebar";
import { AppTopBar } from "./components/AppTopBar";
import { DesktopTitleBar } from "./components/DesktopTitleBar";
import { ShellChromeCore } from "./components/ShellChromeCore";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { SchemaUpgradeGate } from "./components/SchemaUpgradeGate";
import { SecretsBrokenGate } from "./components/SecretsBrokenGate";
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
import { CommandPaletteProvider } from "./hooks/useCommandPalette";
import { AssistantQuickProvider } from "./hooks/useAssistantQuick";
import { AssistantChatProvider } from "./hooks/useAssistantChat";
import { fetchHealth } from "./api/system";
import { FirstRunWizard } from "./components/FirstRunWizard";
import { SessionReauthWizard } from "./components/SessionReauthWizard";
import { resolveAuthGate } from "./domain/connection/authGate";
import {
  bootReduce,
  initialBootState,
  shouldReenterAuthOnSessionChange,
} from "./domain/connection/bootMachine";
import {
  clearDeviceSession,
  hasDeviceSession,
  subscribeConnection,
} from "./domain/connection/connectionStore";
import { syncDesktopConnectionOnBoot } from "./electron/electronConnection";
import { isElectronDesktop } from "./electron/electronWindow";
import { useRevealScrollbarOnScroll } from "./hooks/useRevealScrollbarOnScroll";
import { prefetchRoute } from "./routing/prefetchRoute";
import { applyTheme, getStoredThemeId, loadBgForTheme } from "./styles/themeData";
import { useVoiceReminderScanner } from "./voiceReminder/useVoiceReminderScanner";

/**
 * App shell entry (pages ↔ canvas).
 *
 * INVARIANTS:
 * - Dual keep-mount: BoardRoot + pages pane stay mounted; hide with
 *   `shellVisibilityProps` (Tailwind `hidden` + `inert`). Do NOT unmount the
 *   inactive shell (loses deep-link / scroll / widget state).
 * - Pages pane is painted after board so a failed hide cannot steal sidebar clicks.
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
 */
function shellVisibilityProps(
  isHidden: boolean,
): HTMLAttributes<HTMLDivElement> & { className: string } {
  return {
    hidden: isHidden,
    "aria-hidden": isHidden,
    className: isHidden
      ? "pointer-events-none absolute inset-0 z-0 hidden min-h-0 min-w-0 overflow-hidden"
      : "absolute inset-0 z-[2] flex min-h-0 min-w-0 overflow-hidden",
    // React 18 types omit `inert`; empty string is the valid HTML boolean form.
    // Only set when hidden — omit when visible so React removes a stuck inert attr.
    ...(isHidden ? ({ inert: "" } as HTMLAttributes<HTMLDivElement>) : {}),
  };
}

// Apply theme before first render to avoid FOUC
applyTheme(getStoredThemeId());
loadBgForTheme(getStoredThemeId());

/** Browser canvas top bar — same chrome as pages (assistant + search + status). */
function BrowserCanvasBar() {
  return (
    <header className="browser-monitor-bar" data-testid="browser-monitor-bar">
      <ShellChromeCore
        layout="web"
        showCollapse={false}
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
  const [boardImmersive, setBoardImmersive] = useState(false);
  useRevealScrollbarOnScroll(mainScrollRef);
  useVoiceReminderScanner();

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
      className="flex h-screen min-h-screen flex-col overflow-hidden bg-surface-base text-text-primary"
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
          <AppSidebar />
          <div
            ref={mainScrollRef}
            className="im-auto-scrollbar im-page-canvas flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-sm"
          >
            <main className="app-main-content flex min-h-0 min-w-0 flex-1 flex-col">
              <AppRoutes />
            </main>
          </div>
        </div>
      </div>
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

function BootUnavailable({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation("common");
  return (
    <div className="min-h-screen max-w-[480px] bg-surface-base p-6 text-text-primary">
      <h1 className="mt-0 text-xl">{t("boot.unavailableTitle")}</h1>
      <p className="leading-normal text-text-secondary">{message}</p>
      <p className="leading-normal text-text-secondary">
        {t("boot.unavailableHint", {
          script: "scripts/reset_local_databases.py --apply",
        })}
      </p>
      <button type="button" onClick={onRetry} className="mt-lg min-h-9">
        {t("boot.retry")}
      </button>
    </div>
  );
}

function App() {
  const { t } = useTranslation("common");
  const [boot, dispatchBoot] = useReducer(bootReduce, initialBootState);

  const runAuthGate = useCallback(async (opts?: { fromSessionLoss?: boolean }) => {
    dispatchBoot({ type: "check_started" });
    try {
      const decision = await resolveAuthGate(opts);
      if (decision.kind === "ready") {
        dispatchBoot({ type: "auth_ready" });
        return;
      }
      dispatchBoot({
        type: "auth_setup",
        status: decision.status,
        reason: decision.reason,
      });
    } catch (error) {
      dispatchBoot({
        type: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  const markSchemaReady = useCallback(() => {
    dispatchBoot({ type: "gate_complete" });
    void runAuthGate();
  }, [runAuthGate]);

  const checkBoot = useCallback(async () => {
    dispatchBoot({ type: "check_started" });
    try {
      const health = await fetchHealth();
      if (health.secretsReady === false) {
        clearDeviceSession();
        dispatchBoot({ type: "secrets_blocked", error: health.secretsError ?? null });
        return;
      }
      if (!health.runtimeReady) {
        dispatchBoot({ type: "schema_blocked" });
        return;
      }
      dispatchBoot({ type: "schema_ok" });
      await runAuthGate();
    } catch (error) {
      dispatchBoot({
        type: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [runAuthGate]);

  const markSecretsRecovered = useCallback(() => {
    dispatchBoot({ type: "secrets_gate_complete" });
    void checkBoot();
  }, [checkBoot]);

  // Desktop host: await connection sync before schema/auth so a stale remote
  // baseUrl cannot poison the first checkBoot (false "unavailable").
  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        if (isElectronDesktop()) {
          await syncDesktopConnectionOnBoot();
        }
        if (!cancelled) {
          await checkBoot();
        }
      } catch (error) {
        if (!cancelled) {
          dispatchBoot({
            type: "failed",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [checkBoot]);

  // Session cleared (refresh failure / revoke-all / logout) → reauth / first-run by reason.
  useEffect(() => {
    return subscribeConnection(() => {
      if (!shouldReenterAuthOnSessionChange(boot.phase, hasDeviceSession())) return;
      dispatchBoot({ type: "session_lost" });
      void runAuthGate({ fromSessionLoss: true });
    });
  }, [boot.phase, runAuthGate]);

  const onSetupComplete = () => {
    dispatchBoot({ type: "setup_complete" });
    void runAuthGate();
  };

  return (
    <ErrorBoundary>
      {boot.phase === "loading" ? (
        <div className="min-h-screen bg-surface-base p-6 text-text-primary">{t("boot.checking")}</div>
      ) : boot.phase === "unavailable" ? (
        <BootUnavailable
          message={boot.error || t("boot.serviceUnavailable")}
          onRetry={() => {
            void checkBoot();
          }}
        />
      ) : boot.phase === "secrets_blocked" ? (
        <SecretsBrokenGate
          onRecoverComplete={markSecretsRecovered}
          secretsError={boot.secretsError}
        />
      ) : boot.phase === "gate" ? (
        <SchemaUpgradeGate onReady={markSchemaReady} />
      ) : boot.phase === "setup" && boot.setupStatus ? (
        boot.setupStatus.bootstrapped ? (
          // Admin exists: one login card (expired vs cold login only changes copy).
          <SessionReauthWizard
            onComplete={onSetupComplete}
            tone={boot.setupReason === "session_expired" ? "expired" : "login"}
            hasActiveDevice={boot.setupStatus.hasActiveDevice}
            allowLocalPasswordReset={boot.setupStatus.resetPasswordForLocal}
          />
        ) : (
          // No admin yet: create-system (Desktop may still choose remote login).
          <FirstRunWizard status={boot.setupStatus} onComplete={onSetupComplete} />
        )
      ) : boot.phase === "ready" ? (
        <AppShell />
      ) : (
        // setup without status, or unexpected phase — never mount shell (avoids SSE 401 storms)
        <div className="min-h-screen bg-surface-base p-6 text-text-primary">{t("boot.checking")}</div>
      )}
    </ErrorBoundary>
  );
}

export { App };
