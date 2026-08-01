import { describe, expect, it, vi, beforeEach } from "vitest";
import { handleCollectorStatusChanged } from "./collectorStatus";
import { errorToastEmitter } from "../../../api/errorToastEmitter";
import type { EventListenerDeps } from "./types";

function makeDeps(): EventListenerDeps {
  const collectorStatusRef = { current: "running" as const };
  return {
    state: {
      collectorStatusRef,
      collectorStatusVersionRef: { current: 0 },
      setCollectorStatus: vi.fn((status) => {
        collectorStatusRef.current = status;
      }),
      setQueueStatus: vi.fn(),
      setAiEngineStatus: vi.fn(),
      setActiveAnalyses: vi.fn(),
      lastAiHealthSignatureRef: { current: "" },
    },
    refreshQueueStatus: vi.fn(),
    refreshAiStatus: vi.fn(),
    refreshLogsForBackendEvent: vi.fn(),
  } as unknown as EventListenerDeps;
}

describe("handleCollectorStatusChanged", () => {
  beforeEach(() => {
    vi.spyOn(errorToastEmitter, "emit").mockImplementation(() => {});
  });

  it("does not toast adapter errors when aggregate status is running", () => {
    const deps = makeDeps();

    handleCollectorStatusChanged(
      {
        status: "running",
        adapter_name: "rss",
        error_summary: "Connection timeout to host https://hnrss.org/newest",
      },
      deps,
    );

    expect(errorToastEmitter.emit).not.toHaveBeenCalled();
  });

  it("toasts adapter errors when aggregate status is error", () => {
    const deps = makeDeps();

    handleCollectorStatusChanged(
      {
        status: "error",
        adapter_name: "rss",
        error_summary: "Connection refused",
      },
      deps,
    );

    expect(errorToastEmitter.emit).toHaveBeenCalledOnce();
  });

  it("suppresses transient timeout errors even when aggregate status is error", () => {
    const deps = makeDeps();

    handleCollectorStatusChanged(
      {
        status: "error",
        adapter_name: "rss",
        error_summary: "Connection timeout to host https://hnrss.org/newest",
      },
      deps,
    );

    expect(errorToastEmitter.emit).not.toHaveBeenCalled();
  });
});
