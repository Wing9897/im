import type { ActiveAnalysisState, AiEngineStatus, CollectorStatus } from "../../types";
import { formatBatchMessageCount } from "../../utils/analysis";
import i18n from "../../i18n";
import {
  statusColorsByCollectorState,
  statusLabelsByCollectorState,
  statusShortLabelsByCollectorState,
} from "./statusMaps";

interface SystemStatusView {
  color: string;
  label: string;
  title: string;
  pulse: boolean;
}

/**
 * Collapses collector + AI + analysis into one top-bar status pill.
 * Avoids redundant pairs when the collector is down.
 */
export function buildSystemStatus(input: {
  collectorStatus: CollectorStatus;
  aiEngineStatus: AiEngineStatus;
  analysisPaused: boolean;
  activeAnalysis: ActiveAnalysisState | null;
}): SystemStatusView {
  const { collectorStatus, aiEngineStatus, analysisPaused, activeAnalysis } = input;
  const t = (key: string, opts?: Record<string, string>) =>
    String(i18n.t(`topBar.${key}`, opts));

  if (activeAnalysis) {
    const taskLabel = activeAnalysis.taskName || t("unnamedTask");
    const batchLabel = formatBatchMessageCount(activeAnalysis.messageCount);
    return {
      color: "var(--info)",
      label: t("analyzingLabel", { task: taskLabel }),
      title: analysisPaused
        ? t("analyzingTitlePaused", { task: taskLabel, batch: batchLabel })
        : t("analyzingTitle", { task: taskLabel, batch: batchLabel }),
      pulse: true,
    };
  }

  if (collectorStatus !== "running") {
    return {
      color: statusColorsByCollectorState[collectorStatus],
      label: statusShortLabelsByCollectorState()[collectorStatus],
      title: statusLabelsByCollectorState()[collectorStatus],
      pulse: false,
    };
  }

  if (aiEngineStatus === "unavailable") {
    return {
      color: "var(--error)",
      label: t("aiUnavailable"),
      title: t("aiUnavailableTitle"),
      pulse: false,
    };
  }

  if (analysisPaused) {
    return {
      color: "var(--warning)",
      label: t("analysisPaused"),
      title: t("analysisPausedTitle"),
      pulse: false,
    };
  }

  return {
    color: "var(--success)",
    label: t("systemOk"),
    title: t("systemOkTitle"),
    pulse: false,
  };
}
