import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../context/ToastContext";
import { toErrorMessage } from "../../utils/errors";
import { openViewerWindow } from "../../utils/openViewerWindow";
import { useAnalysisControls } from "../analysis/useAnalysisControls";
import { AnalysisStatusControl } from "./AnalysisStatusControl";
import { buildSystemStatus } from "./buildSystemStatus";
import { useAnalysisStatus } from "../../context/AnalysisStatusContext";
import { useCollectorStatus } from "../../context/CollectorStatusContext";

type TopBarStatusActionsProps = {
  /** Compact layout for the Electron custom title bar. */
  variant?: "default" | "titleBar";
};

export function TopBarStatusActions({ variant = "default" }: TopBarStatusActionsProps) {
  const { t } = useTranslation("common");
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

  const systemStatus = buildSystemStatus({
    collectorStatus,
    aiEngineStatus,
    analysisPaused,
    activeAnalyses: activeAnalyses ?? new Map(),
  });

  const busy = updatingAnalysisPaused || abortingAnalysis;
  const controlsDisabled = collectorStatus === "error";

  const handleOpenViewer = () => {
    try {
      openViewerWindow();
    } catch (error) {
      showToast(toErrorMessage(error), "error");
    }
  };

  const statusAreaClass =
    variant === "titleBar"
      ? "flex min-w-0 items-center gap-md overflow-visible"
      : "ml-auto flex min-w-0 items-center gap-md overflow-visible";

  const iconAreaClass =
    variant === "titleBar"
      ? "flex shrink-0 items-center gap-sm"
      : "ml-md flex shrink-0 items-center gap-sm border-l border-surface-border pl-md";

  return (
    <>
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
          onTogglePause={() => {
            void handleAnalysisPausedChange(!analysisPaused);
          }}
          onEmergencyAbort={handleEmergencyAbort}
        />
      </div>

      <div className={iconAreaClass} data-testid="topbar-icon-actions">
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
    </>
  );
}
