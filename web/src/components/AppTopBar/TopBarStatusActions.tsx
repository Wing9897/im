import { Bell, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useToast } from "../../context/ToastContext";
import { toErrorMessage } from "../../utils/errors";
import { openViewerWindow } from "../../utils/openViewerWindow";
import { useAnalysisControls } from "../analysis/useAnalysisControls";
import { AnalysisStatusControl } from "./AnalysisStatusControl";
import { buildSystemStatus } from "./buildSystemStatus";
import { useAnalysisStatus } from "../../context/AnalysisStatusContext";
import { useCollectorStatus } from "../../context/CollectorStatusContext";
import { useRecentInbox } from "../../hooks/useRecentInbox";

type TopBarStatusActionsProps = {
  /** Compact layout for the Electron custom title bar. */
  variant?: "default" | "titleBar";
};

export function TopBarStatusActions({ variant = "default" }: TopBarStatusActionsProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { collectorStatus, aiEngineStatus } = useCollectorStatus();
  const { activeAnalyses } = useAnalysisStatus();
  const {
    analysisPaused,
    updatingAnalysisPaused,
    abortingAnalysis,
    handleAnalysisPausedChange,
    handleEmergencyAbort,
  } = useAnalysisControls();
  const { showToast } = useToast();
  const { unread, open: inboxOpen, setOpen: setInboxOpen } = useRecentInbox();

  const systemStatus = buildSystemStatus({
    collectorStatus,
    aiEngineStatus,
    analysisPaused,
    activeAnalyses: activeAnalyses ?? new Map(),
  });

  const busy = updatingAnalysisPaused || abortingAnalysis;
  const controlsDisabled = collectorStatus === "error";
  const aiUnavailable = aiEngineStatus === "unavailable";

  const handleOpenViewer = () => {
    try {
      openViewerWindow();
    } catch (error) {
      showToast(toErrorMessage(error), "error");
    }
  };

  const iconAreaClass = "flex shrink-0 items-center gap-sm";

  const statusAreaClass =
    variant === "titleBar"
      ? "flex min-w-0 items-center gap-md overflow-visible"
      : "ml-md flex min-w-0 items-center gap-md overflow-visible";

  return (
    <>
      <div className={iconAreaClass} data-testid="topbar-icon-actions">
        <button
          type="button"
          className={`im-icon-btn relative${variant === "titleBar" ? " desktop-title-bar-icon-btn" : ""}`}
          aria-label={t("notify.inboxOpenAria")}
          aria-pressed={inboxOpen}
          title={t("notify.inboxTitle")}
          data-testid="recent-day-inbox-btn"
          onClick={() => setInboxOpen(!inboxOpen)}
        >
          <Bell size={variant === "titleBar" ? 15 : 17} strokeWidth={2} aria-hidden="true" />
          {unread > 0 ? (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-0.5 text-[10px] font-bold text-[var(--text-on-accent)]"
              aria-label={t("notify.inboxBadgeAria", { count: unread })}
              data-testid="recent-day-inbox-badge"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          className={`im-icon-btn${variant === "titleBar" ? " desktop-title-bar-icon-btn" : ""}`}
          aria-label={t("topBar.openViewer")}
          title={t("topBar.openViewerHint", { defaultValue: t("topBar.openViewer") })}
          data-testid="open-viewer-btn"
          onClick={handleOpenViewer}
        >
          <ExternalLink size={variant === "titleBar" ? 15 : 17} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <div className={statusAreaClass} data-testid="topbar-status-area">
        <AnalysisStatusControl
          color={systemStatus.color}
          label={systemStatus.label}
          title={systemStatus.title}
          pulse={systemStatus.pulse}
          analysisPaused={analysisPaused}
          busy={busy}
          disabled={controlsDisabled}
          abortingAnalysis={abortingAnalysis}
          aiUnavailable={aiUnavailable}
          onOpenAiSettings={() => {
            navigate("/ai/provider");
          }}
          onTogglePause={() => {
            void handleAnalysisPausedChange(!analysisPaused);
          }}
          onEmergencyAbort={handleEmergencyAbort}
        />
      </div>
    </>
  );
}
