import { useCallback, useEffect, useRef, useState } from "react";

import { useSSE } from "../../hooks/useSSE";
import type { SseEvent } from "../../api/client";
import {
  hasDeviceSession,
  subscribeConnection,
} from "../../domain/connection/connectionStore";
import { subscribeDesktopNotificationAuth } from "../../electron/electronConnection";
import { handleSseEvent, setupEventListeners } from "./eventListeners";
import { setupIntervalMonitor } from "./intervalMonitor";
import {
  buildMonitoringReturnValue,
  useRuntimeMonitoringState,
} from "./stateManagement";
import type {
  RuntimeMonitoringOptions,
  RuntimeMonitoringState,
} from "./types";

// Re-export public types, constants, and helpers
export type { RuntimeAnalysisEvent } from "./types";

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function useRuntimeMonitoring({
  addLog,
  refreshStoredLogs,
  warnNonFatal,
}: RuntimeMonitoringOptions): RuntimeMonitoringState {
  const state = useRuntimeMonitoringState();

  // Keep a stable ref to the monitor functions so the SSE onEvent callback
  // can reach them without triggering re-renders or re-subscriptions.
  const monitorRef = useRef<{
    refreshQueueStatus: (logPauseChanges: boolean) => void;
    refreshAiStatus: (logOnChange: boolean) => void;
    refreshLogsForBackendEvent: () => void;
  } | null>(null);

  useEffect(() => {
    state.collectorStatusRef.current = state.collectorStatus;
  }, [state.collectorStatus, state.collectorStatusRef]);

  useEffect(() => {
    state.analysisPausedRef.current = state.analysisPaused;
  }, [state.analysisPaused, state.analysisPausedRef]);

  useEffect(() => {
    const options: RuntimeMonitoringOptions = {
      addLog,
      refreshStoredLogs,
      warnNonFatal,
    };

    const monitor = setupIntervalMonitor({ state, options });
    monitorRef.current = {
      refreshQueueStatus: monitor.refreshQueueStatus,
      refreshAiStatus: monitor.refreshAiStatus,
      refreshLogsForBackendEvent: monitor.refreshLogsForBackendEvent,
    };

    // Register window error handlers (SSE events handled via useSSE below)
    const cleanupWindowHandlers = setupEventListeners({
      state,
      options,
      refreshQueueStatus: monitor.refreshQueueStatus,
      refreshAiStatus: monitor.refreshAiStatus,
      refreshLogsForBackendEvent: monitor.refreshLogsForBackendEvent,
    });

    void monitor.bootstrap();

    return () => {
      monitor.cleanup();
      cleanupWindowHandlers();
      monitorRef.current = null;
    };
    // The state bundle is rebuilt every render, but the monitor only touches
    // its stable members (setters and refs). Depending on `state` would tear
    // down and rebuild the interval monitor + window handlers on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog, refreshStoredLogs, warnNonFatal]);

  // SSE connection — routes all backend events to handleSseEvent
  const optionsRef = useRef<RuntimeMonitoringOptions>({ addLog, refreshStoredLogs, warnNonFatal });
  optionsRef.current = { addLog, refreshStoredLogs, warnNonFatal };

  // The state bundle is rebuilt every render, so read it through a ref instead
  // of closing over it — same ref-only pattern as `useSSE`'s `onEventRef`.
  const stateRef = useRef(state);
  stateRef.current = state;

  const handleEvent = useCallback((event: SseEvent) => {
    const monitor = monitorRef.current;
    if (!monitor) return;
    handleSseEvent(event, {
      state: stateRef.current,
      options: optionsRef.current,
      refreshQueueStatus: monitor.refreshQueueStatus,
      refreshAiStatus: monitor.refreshAiStatus,
      refreshLogsForBackendEvent: monitor.refreshLogsForBackendEvent,
    });
  }, []);

  // Do not open SSE until a device session exists (FirstRunWizard / cleared session).
  const [sseEnabled, setSseEnabled] = useState(() => hasDeviceSession());
  useEffect(() => {
    return subscribeConnection(() => {
      setSseEnabled(hasDeviceSession());
    });
  }, []);

  // Desktop main-process notification SSE needs the same access token (Bearer).
  useEffect(() => subscribeDesktopNotificationAuth(), []);

  useSSE({ onEvent: handleEvent, enabled: sseEnabled });

  const requestAiStatusRefresh = useCallback((logOnChange = true) => {
    state.refreshAiStatusRef.current(logOnChange);
  }, [state.refreshAiStatusRef]);

  const requestQueueStatusRefresh = useCallback((logPauseChanges = false) => {
    state.refreshQueueStatusRef.current(logPauseChanges);
  }, [state.refreshQueueStatusRef]);

  return buildMonitoringReturnValue(
    state,
    requestAiStatusRefresh,
    requestQueueStatusRefresh,
  );
}
