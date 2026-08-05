import { createContext, useMemo } from "react";
import type { ReactNode } from "react";
import type { ConnectionStatus, QueueStatus } from "../types";
import type { ActiveAnalysisState } from "./appRuntimeShared";
import { useContextWithFallback } from "./useContextWithFallback";
import type { RuntimeAnalysisEvent } from "./runtimeMonitoring";
import type { RuntimeMessagesUpdateEvent } from "./runtimeMonitoring/types";

export interface AnalysisStatusContextValue {
  queueStatus: QueueStatus | null;
  analysisPaused: boolean;
  activeAnalyses: Map<string, ActiveAnalysisState>;
  lastAnalysisEvent: RuntimeAnalysisEvent | null;
  lastSourceStatusChange: {
    sourceId: string;
    status: ConnectionStatus;
  } | null;
  lastMessagesUpdate: RuntimeMessagesUpdateEvent | null;
  requestQueueStatusRefresh: (logPauseChanges?: boolean) => void;
}

const AnalysisStatusContext = createContext<AnalysisStatusContextValue | null>(
  null,
);

interface AnalysisStatusProviderProps {
  children?: ReactNode;
  value: AnalysisStatusContextValue;
}

export function AnalysisStatusProvider({
  children,
  value,
}: AnalysisStatusProviderProps) {
  const {
    queueStatus,
    analysisPaused,
    activeAnalyses,
    lastAnalysisEvent,
    lastSourceStatusChange,
    lastMessagesUpdate,
    requestQueueStatusRefresh,
  } = value;
  const memoizedValue = useMemo<AnalysisStatusContextValue>(
    () => ({
      queueStatus,
      analysisPaused,
      activeAnalyses,
      lastAnalysisEvent,
      lastSourceStatusChange,
      lastMessagesUpdate,
      requestQueueStatusRefresh,
    }),
    [
      queueStatus,
      analysisPaused,
      activeAnalyses,
      lastAnalysisEvent,
      lastSourceStatusChange,
      lastMessagesUpdate,
      requestQueueStatusRefresh,
    ],
  );

  return (
    <AnalysisStatusContext.Provider value={memoizedValue}>
      {children}
    </AnalysisStatusContext.Provider>
  );
}

export function useAnalysisStatus(): AnalysisStatusContextValue {
  return useContextWithFallback(
    AnalysisStatusContext,
    "useAnalysisStatus",
    "AnalysisStatusProvider",
  );
}
