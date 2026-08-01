import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

const {
  mockFetchTimelineEvents,
  mockFetchCalendarOccurrences,
  mockFetchTaskActivitySpans,
} = vi.hoisted(() => ({
  mockFetchTimelineEvents: vi.fn().mockResolvedValue([]),
  mockFetchCalendarOccurrences: vi.fn().mockResolvedValue([]),
  mockFetchTaskActivitySpans: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../api/results", () => ({
  fetchTimelineEvents: (...args: unknown[]) => mockFetchTimelineEvents(...args),
  fetchCalendarOccurrences: (...args: unknown[]) => mockFetchCalendarOccurrences(...args),
}));

vi.mock("../../api/tasks", () => ({
  fetchTaskActivitySpans: (...args: unknown[]) => mockFetchTaskActivitySpans(...args),
}));

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock());

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

vi.mock("../../hooks/useRefreshOnAnalysisEvent", () => ({
  useRefreshOnAnalysisEvent: vi.fn(),
}));

import {
  MONITOR_MODE_KEY,
  MonitorModeProvider,
} from "../../context/MonitorModeContext";
import {
  makeAnalysisTask,
  resetTaskCatalogState,
} from "../../test/context-mocks";
import { useTimelinePageContainer } from "./useTimelinePageContainer";

type HookResult = ReturnType<typeof useTimelinePageContainer>;

function HookHarness({ resultRef }: { resultRef: { current: HookResult | null } }) {
  const result = useTimelinePageContainer();
  resultRef.current = result;
  return null;
}

describe("useTimelinePageContainer URL view query", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let resultRef: { current: HookResult | null };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    window.localStorage.clear();
    window.localStorage.setItem(MONITOR_MODE_KEY, "pages");
    mockFetchTimelineEvents.mockReset().mockResolvedValue([]);
    mockFetchCalendarOccurrences.mockReset().mockResolvedValue([]);
    mockFetchTaskActivitySpans.mockReset().mockResolvedValue([]);
    resetTaskCatalogState([
      makeAnalysisTask({ id: "task-a", name: "任務 A", analysisMode: "event" }),
    ]);
    resultRef = { current: null };
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
    window.localStorage.clear();
  });

  async function renderAt(path: string) {
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: [path] },
          createElement(
            MonitorModeProvider,
            null,
            createElement(HookHarness, { resultRef }),
          ),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("selects gantt when ?view=gantt", async () => {
    window.localStorage.setItem("im:timeline:view-mode", JSON.stringify("calendar"));
    await renderAt("/timeline?view=gantt");
    expect(resultRef.current!.sources.viewMode).toBe("gantt");
  });

  it("selects calendar when ?view=calendar", async () => {
    window.localStorage.setItem("im:timeline:view-mode", JSON.stringify("gantt"));
    await renderAt("/timeline?view=calendar");
    expect(resultRef.current!.sources.viewMode).toBe("calendar");
  });

  it("clears sticky ?view= so UI calendar toggle is not forced back to gantt", async () => {
    window.localStorage.setItem("im:timeline:view-mode", JSON.stringify("calendar"));
    await renderAt("/timeline?view=gantt");
    expect(resultRef.current!.sources.viewMode).toBe("gantt");

    await act(async () => {
      resultRef.current!.sources.setViewMode("calendar");
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(resultRef.current!.sources.viewMode).toBe("calendar");
  });
});
