import { useRef, useState } from "react";

import type {
  SourceStatusChangedPayload,
  AiEngineStatus,
  QueueStatus,
  CollectorStatus,
} from "../../types";
import type { ActiveAnalysisState } from "../appRuntimeShared";
import type {
  RuntimeAnalysisEvent,
  RuntimeMessagesUpdateEvent,
  RuntimeMonitoringState,
} from "./types";

// ---------------------------------------------------------------------------
// State & refs bundle returned by the state management hook
// ---------------------------------------------------------------------------

export interface RuntimeStateBundle {
  // React state
  collectorStatus: CollectorStatus;
  setCollectorStatus: React.Dispatch<React.SetStateAction<CollectorStatus>>;
  aiEngineStatus: AiEngineStatus;
  setAiEngineStatus: React.Dispatch<React.SetStateAction<AiEngineStatus>>;
  queueStatus: QueueStatus | null;
  setQueueStatus: React.Dispatch<React.SetStateAction<QueueStatus | null>>;
  analysisPaused: boolean;
  setAnalysisPaused: React.Dispatch<React.SetStateAction<boolean>>;
  activeAnalyses: Map<string, ActiveAnalysisState>;
  setActiveAnalyses: React.Dispatch<
    React.SetStateAction<Map<string, ActiveAnalysisState>>
  >;
  lastAnalysisEvent: RuntimeAnalysisEvent | null;
  setLastAnalysisEvent: React.Dispatch<
    React.SetStateAction<RuntimeAnalysisEvent | null>
  >;
  lastSourceStatusChange: SourceStatusChangedPayload | null;
  setLastSourceStatusChange: React.Dispatch<
    React.SetStateAction<SourceStatusChangedPayload | null>
  >;
  lastMessagesUpdate: RuntimeMessagesUpdateEvent | null;
  setLastMessagesUpdate: React.Dispatch<
    React.SetStateAction<RuntimeMessagesUpdateEvent | null>
  >;

  // Refs
  collectorStatusRef: React.MutableRefObject<CollectorStatus>;
  collectorStatusVersionRef: React.MutableRefObject<number>;
  analysisPausedRef: React.MutableRefObject<boolean>;
  lastAiHealthSignatureRef: React.MutableRefObject<string>;
  lastAiErrorLoggedAtRef: React.MutableRefObject<number>;
  eventLogRefreshTimerRef: React.MutableRefObject<number | null>;
  refreshAiStatusRef: React.MutableRefObject<(logOnChange?: boolean) => void>;
  refreshQueueStatusRef: React.MutableRefObject<
    (logPauseChanges?: boolean) => void
  >;
}

/**
 * Encapsulates all React state and mutable refs used by the runtime monitoring hook.
 */
export function useRuntimeMonitoringState(): RuntimeStateBundle {
  const [collectorStatus, setCollectorStatus] = useState<CollectorStatus>("stopped");
  const [aiEngineStatus, setAiEngineStatus] =
    useState<AiEngineStatus>("unknown");
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [analysisPaused, setAnalysisPaused] = useState(false);
  const [activeAnalyses, setActiveAnalyses] = useState<
    Map<string, ActiveAnalysisState>
  >(new Map());

  const [lastAnalysisEvent, setLastAnalysisEvent] =
    useState<RuntimeAnalysisEvent | null>(null);
  const [lastSourceStatusChange, setLastSourceStatusChange] =
    useState<SourceStatusChangedPayload | null>(null);
  const [lastMessagesUpdate, setLastMessagesUpdate] =
    useState<RuntimeMessagesUpdateEvent | null>(null);

  // Mutable refs for cross-closure access
  const collectorStatusRef = useRef<CollectorStatus>("stopped");
  const collectorStatusVersionRef = useRef(0);
  const analysisPausedRef = useRef(false);
  const lastAiHealthSignatureRef = useRef<string>("");
  const lastAiErrorLoggedAtRef = useRef<number>(0);
  const eventLogRefreshTimerRef = useRef<number | null>(null);
  const refreshAiStatusRef = useRef<(logOnChange?: boolean) => void>(() => {});
  const refreshQueueStatusRef = useRef<(logPauseChanges?: boolean) => void>(
    () => {},
  );

  return {
    collectorStatus,
    setCollectorStatus,
    aiEngineStatus,
    setAiEngineStatus,
    queueStatus,
    setQueueStatus,
    analysisPaused,
    setAnalysisPaused,
    activeAnalyses,
    setActiveAnalyses,
    lastAnalysisEvent,
    setLastAnalysisEvent,
    lastSourceStatusChange,
    setLastSourceStatusChange,
    lastMessagesUpdate,
    setLastMessagesUpdate,
    collectorStatusRef,
    collectorStatusVersionRef,
    analysisPausedRef,
    lastAiHealthSignatureRef,
    lastAiErrorLoggedAtRef,
    eventLogRefreshTimerRef,
    refreshAiStatusRef,
    refreshQueueStatusRef,
  };
}

/**
 * Builds the public return value of the useRuntimeMonitoring hook.
 */
export function buildMonitoringReturnValue(
  state: RuntimeStateBundle,
  requestAiStatusRefresh: (logOnChange?: boolean) => void,
  requestQueueStatusRefresh: (logPauseChanges?: boolean) => void,
): RuntimeMonitoringState {
  return {
    collectorStatus: state.collectorStatus,
    aiEngineStatus: state.aiEngineStatus,
    queueStatus: state.queueStatus,
    analysisPaused: state.analysisPaused,
    activeAnalyses: state.activeAnalyses,
    lastAnalysisEvent: state.lastAnalysisEvent,
    lastSourceStatusChange: state.lastSourceStatusChange,
    lastMessagesUpdate: state.lastMessagesUpdate,
    requestAiStatusRefresh,
    requestQueueStatusRefresh,
  };
}
