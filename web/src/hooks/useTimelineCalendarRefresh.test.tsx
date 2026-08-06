import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emitResourceModified } from "../domain/sse/resourceModified";
import { ANALYSIS_EVENTS_MODES } from "../domain/tasks/analysisModeCapabilities";
import { useTimelineCalendarRefresh } from "./useTimelineCalendarRefresh";

const mockUseRefreshOnAnalysisEvent = vi.hoisted(() => vi.fn());

vi.mock("./useRefreshOnAnalysisEvent", () => ({
  useRefreshOnAnalysisEvent: (...args: unknown[]) => mockUseRefreshOnAnalysisEvent(...args),
}));

function Probe({
  enabled,
  refreshEvents,
  refreshTasks,
}: {
  enabled: boolean;
  refreshEvents: () => Promise<void>;
  refreshTasks?: () => Promise<unknown[]>;
}) {
  useTimelineCalendarRefresh({ enabled, refreshEvents, refreshTasks });
  return null;
}

describe("useTimelineCalendarRefresh", () => {
  let container: HTMLDivElement;
  let root: Root;
  const refreshEvents = vi.fn(async () => undefined);
  const refreshTasks = vi.fn(async () => [{ id: "rec-new" }]);

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("wires analysis refresh for intel_event + agent when enabled", () => {
    act(() =>
      root.render(
        createElement(Probe, {
          enabled: true,
          refreshEvents,
        }),
      ),
    );

    expect(mockUseRefreshOnAnalysisEvent).toHaveBeenCalledWith(
      refreshEvents,
      expect.objectContaining({
        analysisMode: ANALYSIS_EVENTS_MODES,
        taskIds: undefined,
      }),
    );
  });

  it("disables analysis refresh while the timeline page is inactive", () => {
    act(() =>
      root.render(
        createElement(Probe, {
          enabled: false,
          refreshEvents,
        }),
      ),
    );

    expect(mockUseRefreshOnAnalysisEvent).toHaveBeenCalledWith(
      refreshEvents,
      expect.objectContaining({ taskIds: [] }),
    );
  });

  it("refetches merged events after user_event SSE", async () => {
    act(() =>
      root.render(
        createElement(Probe, {
          enabled: true,
          refreshEvents,
        }),
      ),
    );

    refreshEvents.mockClear();
    await act(async () => {
      emitResourceModified({
        resourceType: "user_event",
        resourceId: "ue-1",
        action: "created",
      });
      await Promise.resolve();
    });

    expect(refreshEvents).toHaveBeenCalledTimes(1);
    expect(refreshTasks).not.toHaveBeenCalled();
  });

  it("refreshes the task catalog before events when a task row changes", async () => {
    act(() =>
      root.render(
        createElement(Probe, {
          enabled: true,
          refreshEvents,
          refreshTasks,
        }),
      ),
    );

    refreshEvents.mockClear();
    await act(async () => {
      emitResourceModified({
        resourceType: "task",
        resourceId: "rec-new",
        action: "created",
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(refreshTasks).toHaveBeenCalledTimes(1);
    expect(refreshEvents).toHaveBeenCalledWith([{ id: "rec-new" }]);
  });
});
