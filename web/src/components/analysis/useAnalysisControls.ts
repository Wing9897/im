import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildSystemStatus } from "../AppTopBar/buildSystemStatus";
import { setAnalysisPaused, emergencyAbortAnalysis } from "../../api/system";
import { useAnalysisStatus } from "../../context/AnalysisStatusContext";
import { useCollectorStatus } from "../../context/CollectorStatusContext";
import { useToast } from "../../context/ToastContext";
import i18n from "../../i18n";
import { handleCommandError } from "../../utils/errors";
import { logWarn } from "../../utils/logger";

/** Global analysis pause/resume + emergency abort (formerly floating orb controls). */
export function useAnalysisControls() {
  const {
    analysisPaused: analysisPausedFromContext,
    requestQueueStatusRefresh,
    queueStatus,
    activeAnalyses,
  } = useAnalysisStatus();

  const { collectorStatus, aiEngineStatus, requestAiStatusRefresh } = useCollectorStatus();
  const { showToast } = useToast();

  const [abortingAnalysis, setAbortingAnalysis] = useState(false);
  const [updatingAnalysisPaused, setUpdatingAnalysisPaused] = useState(false);
  const [optimisticPaused, setOptimisticPaused] = useState<boolean | null>(null);
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current !== null) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, []);

  const handleAnalysisPausedChange = useCallback(
    async (paused: boolean) => {
      if (updatingAnalysisPaused || abortingAnalysis) return;

      const previousState = analysisPausedFromContext;
      setOptimisticPaused(paused);
      setUpdatingAnalysisPaused(true);

      if (pauseTimeoutRef.current !== null) {
        clearTimeout(pauseTimeoutRef.current);
      }
      pauseTimeoutRef.current = setTimeout(() => {
        pauseTimeoutRef.current = null;
        setOptimisticPaused(previousState);
        setUpdatingAnalysisPaused(false);
        showToast(String(i18n.t("common:analysisControls.pauseTimeout")), "error");
      }, 30_000);

      try {
        await setAnalysisPaused(paused);
        if (pauseTimeoutRef.current !== null) {
          clearTimeout(pauseTimeoutRef.current);
          pauseTimeoutRef.current = null;
        }
        setOptimisticPaused(null);
        requestQueueStatusRefresh(true);
      } catch (e) {
        if (pauseTimeoutRef.current !== null) {
          clearTimeout(pauseTimeoutRef.current);
          pauseTimeoutRef.current = null;
        }
        setOptimisticPaused(previousState);
        const errMsg = handleCommandError(e);
        logWarn("[analysis-controls] failed to update analysis paused", errMsg);
        showToast(
          String(i18n.t("common:analysisControls.pauseFailed", { error: errMsg })),
          "error",
        );
      } finally {
        setUpdatingAnalysisPaused(false);
      }
    },
    [updatingAnalysisPaused, abortingAnalysis, analysisPausedFromContext, requestQueueStatusRefresh, showToast],
  );

  const handleEmergencyAbort = useCallback(async () => {
    if (abortingAnalysis || updatingAnalysisPaused) return;
    setAbortingAnalysis(true);
    try {
      await emergencyAbortAnalysis();
      setOptimisticPaused(true);
      requestQueueStatusRefresh(true);
      requestAiStatusRefresh(true);
    } catch (e) {
      const errMsg = handleCommandError(e);
      logWarn("[analysis-controls] emergency abort failed", errMsg);
      showToast(
        String(i18n.t("common:analysisControls.abortFailed", { error: errMsg })),
        "error",
      );
    } finally {
      setAbortingAnalysis(false);
    }
  }, [abortingAnalysis, updatingAnalysisPaused, requestQueueStatusRefresh, requestAiStatusRefresh, showToast]);

  const analysisPaused = optimisticPaused ?? (queueStatus?.analysisPaused ?? false);
  const systemStatus = useMemo(
    () =>
      buildSystemStatus({
        collectorStatus,
        aiEngineStatus,
        analysisPaused,
        activeAnalyses: activeAnalyses ?? new Map(),
      }),
    [collectorStatus, aiEngineStatus, analysisPaused, activeAnalyses],
  );

  return {
    collectorStatus,
    abortingAnalysis,
    updatingAnalysisPaused,
    analysisPaused,
    handleAnalysisPausedChange,
    handleEmergencyAbort,
    statusLabel: systemStatus.label,
    statusColor: systemStatus.color,
  };
}
