import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveDeviceSession } from "../../domain/connection/connectionStore";
import { _resetConnectionStoreForTests } from "../../domain/connection/connectionStore.testing";
const handleAnalysisPausedChange = vi.fn(async () => {});
const handleEmergencyAbort = vi.fn(async () => {});

vi.mock("./useAnalysisControls", () => ({
  useAnalysisControls: () => ({
    analysisPaused: false,
    handleAnalysisPausedChange,
    handleEmergencyAbort,
    updatingAnalysisPaused: false,
    abortingAnalysis: false,
  }),
}));

vi.mock("../../context/CollectorStatusContext", () => ({
  useCollectorStatus: () => ({
    collectorStatus: "running" as const,
    aiEngineStatus: "available" as const,
    requestAiStatusRefresh: () => {},
  }),
}));

const { DesktopTrayAnalysisBridge } =
  await import("./DesktopTrayAnalysisBridge");

describe("DesktopTrayAnalysisBridge", () => {
  let container: HTMLDivElement;
  let root: Root;
  let emitCommand: ((command: string) => void) | undefined;
  const setAnalysisTrayState = vi.fn();

  beforeEach(() => {
    handleAnalysisPausedChange.mockClear();
    handleEmergencyAbort.mockClear();
    setAnalysisTrayState.mockClear();
    emitCommand = undefined;
    _resetConnectionStoreForTests();
    localStorage.clear();
    saveDeviceSession({
      accessToken: "tok",
      refreshToken: "ref",
      deviceId: "dev-1",
      deviceLabel: "Host",
    });
    window.electronConnection = {
      getConnection: vi.fn(),
      setConnection: vi.fn(),
      restartShell: vi.fn(),
      setAnalysisTrayState,
      onAnalysisTrayCommand: (callback) => {
        emitCommand = callback;
        return () => {
          emitCommand = undefined;
        };
      },
    };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
    delete window.electronConnection;
    _resetConnectionStoreForTests();
    localStorage.clear();
  });

  it("pushes enabled tray state and routes pause / abort to analysis controls", async () => {
    await act(async () => {
      root.render(createElement(DesktopTrayAnalysisBridge));
    });

    expect(setAnalysisTrayState).toHaveBeenCalledWith({
      paused: false,
      enabled: true,
    });

    await act(async () => {
      emitCommand?.("pause");
    });
    expect(handleAnalysisPausedChange).toHaveBeenCalledWith(true);

    await act(async () => {
      emitCommand?.("abort");
    });
    expect(handleEmergencyAbort).toHaveBeenCalled();
  });
});
