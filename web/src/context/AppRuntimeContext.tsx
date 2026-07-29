import { useMemo } from "react";
import type { ReactNode } from "react";

import { CollectorStatusProvider } from "./CollectorStatusContext";
import { AnalysisStatusProvider } from "./AnalysisStatusContext";
import { RuntimeLogsContext } from "./runtimeLogs/RuntimeLogsContext";
import type { RuntimeLogsContextValue } from "./runtimeLogs/RuntimeLogsContext";
import { useRuntimeLogState as useRuntimeLogsInternal } from "./runtimeLogs/runtimeLogState";
import { useRuntimeMonitoring } from "./runtimeMonitoring";
import { ErrorToastProvider } from "./ErrorToastContext";

interface AppRuntimeProviderProps {
  children: ReactNode;
}

export function AppRuntimeProvider({ children }: AppRuntimeProviderProps) {
  const {
    logs,
    totalLogCount,
    hasMoreLogs,
    logsLoading,
    logsLoadingMore,
    logLoadError,
    addLog,
    clearLogs,
    refreshStoredLogs,
    resetStoredLogs,
    loadMoreStoredLogs,
    warnNonFatal,
  } = useRuntimeLogsInternal();

  const {
    collectorStatus,
    aiEngineStatus,
    queueStatus,
    analysisPaused,
    activeAnalysis,
    activeAnalyses,
    lastAnalysisEvent,
    lastAccountStatusChange,
    lastMessagesUpdate,
    requestAiStatusRefresh,
    requestQueueStatusRefresh,
  } = useRuntimeMonitoring({
    addLog,
    refreshStoredLogs,
    warnNonFatal,
  });

  const runtimeLogsValue = useMemo<RuntimeLogsContextValue>(
    () => ({
      logs,
      totalLogCount,
      hasMoreLogs,
      logsLoading,
      logsLoadingMore,
      logLoadError,
      clearLogs,
      refreshLogs: resetStoredLogs,
      loadMoreLogs: loadMoreStoredLogs,
    }),
    [
      logs,
      totalLogCount,
      hasMoreLogs,
      logsLoading,
      logsLoadingMore,
      logLoadError,
      clearLogs,
      resetStoredLogs,
      loadMoreStoredLogs,
    ],
  );

  const analysisStatusValue = useMemo(
    () => ({
      queueStatus,
      analysisPaused,
      activeAnalysis,
      activeAnalyses,
      lastAnalysisEvent,
      lastAccountStatusChange,
      lastMessagesUpdate,
      requestQueueStatusRefresh,
    }),
    [
      queueStatus,
      analysisPaused,
      activeAnalysis,
      activeAnalyses,
      lastAnalysisEvent,
      lastAccountStatusChange,
      lastMessagesUpdate,
      requestQueueStatusRefresh,
    ],
  );

  return (
    <CollectorStatusProvider
      collectorStatus={collectorStatus}
      aiEngineStatus={aiEngineStatus}
      requestAiStatusRefresh={requestAiStatusRefresh}
    >
      <AnalysisStatusProvider value={analysisStatusValue}>
        <RuntimeLogsContext.Provider value={runtimeLogsValue}>
          <ErrorToastProvider>
            {children}
          </ErrorToastProvider>
        </RuntimeLogsContext.Provider>
      </AnalysisStatusProvider>
    </CollectorStatusProvider>
  );
}
