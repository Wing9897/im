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
 *
 * The pill click toggles analysis pause (not collector restart). Prefer
 * analysis-facing labels when they match the control action; surface
 * collector-down as secondary context so copy is not misleading.
 */
export function buildSystemStatus(input: {
  collectorStatus: CollectorStatus;
  aiEngineStatus: AiEngineStatus;
  analysisPaused: boolean;
  activeAnalyses?: Map<string, ActiveAnalysisState> | null;
}): SystemStatusView {
  const { collectorStatus, aiEngineStatus, analysisPaused, activeAnalyses } = input;
  const t = (key: string, opts?: Record<string, string | number>) =>
    String(i18n.t(`topBar.${key}`, opts));
  const collectorRunning = collectorStatus === "running";
  const analyses = activeAnalyses ?? new Map<string, ActiveAnalysisState>();
  const concurrentCount = analyses.size;
  const primaryAnalysis =
    concurrentCount > 0 ? analyses.values().next().value ?? null : null;

  if (primaryAnalysis) {
    const taskLabel = primaryAnalysis.taskName || t("unnamedTask");
    const batchLabel = formatBatchMessageCount(primaryAnalysis.messageCount);
    const concurrent = concurrentCount > 1;
    const analyzingTitle = concurrent
      ? t("analyzingTitleConcurrent", {
          task: taskLabel,
          batch: batchLabel,
          count: concurrentCount,
        })
      : t("analyzingTitle", { task: taskLabel, batch: batchLabel });
    return {
      color: "var(--info)",
      label: concurrent
        ? t("analyzingLabelConcurrent", { task: taskLabel, count: concurrentCount })
        : t("analyzingLabel", { task: taskLabel }),
      title: analysisPaused
        ? t("analyzingTitlePausedWrap", { title: analyzingTitle })
        : analyzingTitle,
      pulse: true,
    };
  }

  // Controls are disabled on collector error — surface it first.
  if (collectorStatus === "error") {
    return {
      color: statusColorsByCollectorState.error,
      label: statusShortLabelsByCollectorState().error,
      title: statusLabelsByCollectorState().error,
      pulse: false,
    };
  }

  if (aiEngineStatus === "unavailable") {
    return {
      color: "var(--error)",
      label: t("aiUnavailable"),
      title: collectorRunning ? t("aiUnavailableTitle") : t("aiUnavailableTitleCollectorDown"),
      pulse: false,
    };
  }

  // Analysis pause is what the pill click toggles — keep it primary even when
  // the collector is stopped (agent ticks do not need the collector).
  if (analysisPaused) {
    return {
      color: "var(--warning)",
      label: t("analysisPaused"),
      title: collectorRunning
        ? t("analysisPausedTitle")
        : t("analysisPausedTitleCollectorDown"),
      pulse: false,
    };
  }

  if (!collectorRunning) {
    return {
      color: statusColorsByCollectorState.stopped,
      label: t("collectorStoppedShort"),
      title: t("collectorStoppedAnalysisActive"),
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
