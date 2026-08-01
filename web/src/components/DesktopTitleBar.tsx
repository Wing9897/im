import { useEffect, useState } from "react";
import { Minus, Square, X, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMonitorMode } from "../context/MonitorModeContext";
import { getElectronWindow, isElectronDesktop } from "../electron/electronWindow";
import { ShellChromeCore } from "./ShellChromeCore";

/**
 * Electron title bar: shared chrome ({@link ShellChromeCore}) + OS window controls.
 * Browser shells use {@link AppTopBar} / canvas bar — no minimize/maximize/close.
 */
export function DesktopTitleBar() {
  const { t } = useTranslation("common");
  const [isMaximized, setIsMaximized] = useState(false);
  const api = getElectronWindow();
  const { monitorMode } = useMonitorMode();
  const pagesMode = monitorMode === "pages";

  useEffect(() => {
    if (!api) {
      return;
    }

    let cancelled = false;

    void api.getState().then((state) => {
      if (!cancelled) {
        setIsMaximized(state.isMaximized);
      }
    }).catch(() => {});

    const unsubscribe = api.onMaximizedChange((maximized) => {
      setIsMaximized(maximized);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [api]);

  if (!isElectronDesktop()) {
    return null;
  }

  return (
    <header className="desktop-title-bar" aria-label={t("window.controlsAria")} data-testid="desktop-title-bar">
      <ShellChromeCore
        layout="desktop"
        showCollapse={pagesMode}
        brandClassName="desktop-title-bar-title"
        collapseClassName="desktop-title-bar-collapse"
        modeClassName="desktop-title-bar-mode"
        actionsClassName="desktop-title-bar-actions"
      />

      <div className="desktop-title-bar-controls" data-testid="desktop-window-controls">
        <button
          type="button"
          className="desktop-title-bar-btn"
          aria-label={t("window.minimize")}
          title={t("window.minimize")}
          onClick={() => api?.minimize()}
        >
          <Minus size={14} strokeWidth={2} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="desktop-title-bar-btn"
          aria-label={isMaximized ? t("window.restore") : t("window.maximize")}
          title={isMaximized ? t("window.restore") : t("window.maximize")}
          onClick={() => api?.toggleMaximize()}
        >
          {isMaximized ? (
            <Copy size={13} strokeWidth={2} aria-hidden="true" />
          ) : (
            <Square size={12} strokeWidth={2} aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          className="desktop-title-bar-btn desktop-title-bar-btn--close"
          aria-label={t("window.close")}
          title={t("window.close")}
          onClick={() => api?.close()}
        >
          <X size={14} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
