/**
 * Desktop tray ↔ renderer bridge for global AI analysis pause / abort.
 * Reuses {@link useAnalysisControls} so toasts, SSE, and the top bar stay in sync.
 */

import { useEffect, useState } from "react";

import { useCollectorStatus } from "../../context/CollectorStatusContext";
import {
  hasDeviceSession,
  subscribeConnection,
} from "../../domain/connection/connectionStore";
import {
  getElectronConnection,
  subscribeDesktopAnalysisTrayCommand,
  syncDesktopAnalysisTrayState,
} from "../../electron/electronConnection";
import { detectAccessContext } from "../../utils/accessContext";
import { logWarn } from "../../utils/logger";
import { useAnalysisControls } from "./useAnalysisControls";

function analysisWritesAllowed(): boolean {
  if (!hasDeviceSession()) return false;
  // Remote read-only (no session) is already excluded; a live device session can write.
  return detectAccessContext() === "local" || hasDeviceSession();
}

/** Always-mounted tray analysis IPC (survives hidden title-bar chrome). */
export function DesktopTrayAnalysisBridge() {
  const api = getElectronConnection();
  if (!api?.setAnalysisTrayState && !api?.onAnalysisTrayCommand) return null;
  return <DesktopTrayAnalysisBridgeInner />;
}

function DesktopTrayAnalysisBridgeInner() {
  const {
    analysisPaused,
    handleAnalysisPausedChange,
    handleEmergencyAbort,
    updatingAnalysisPaused,
    abortingAnalysis,
  } = useAnalysisControls();
  const { collectorStatus } = useCollectorStatus();
  const [authed, setAuthed] = useState(() => hasDeviceSession());

  useEffect(() => {
    return subscribeConnection(() => {
      setAuthed(hasDeviceSession());
    });
  }, []);

  const enabled =
    authed &&
    analysisWritesAllowed() &&
    collectorStatus !== "error" &&
    !updatingAnalysisPaused &&
    !abortingAnalysis;

  useEffect(() => {
    syncDesktopAnalysisTrayState({ paused: analysisPaused, enabled });
  }, [analysisPaused, enabled]);

  useEffect(() => {
    return subscribeDesktopAnalysisTrayCommand((command) => {
      if (!analysisWritesAllowed()) return;
      if (command === "abort") {
        void handleEmergencyAbort().catch((error) => {
          logWarn("[desktop-tray] emergency abort failed", error);
        });
        return;
      }
      void handleAnalysisPausedChange(command === "pause").catch((error) => {
        logWarn("[desktop-tray] analysis pause failed", error);
      });
    });
  }, [handleAnalysisPausedChange, handleEmergencyAbort]);

  useEffect(() => {
    return () => {
      syncDesktopAnalysisTrayState({ paused: false, enabled: false });
    };
  }, []);

  return null;
}
