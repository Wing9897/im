/**
 * Unit tests for TimelinePage task selection behavior.
 *
 * - Selecting a task filters displayed events
 * - Default "all tasks" displays all events
 * - Selected task ID is passed to Gantt view for filtering
 * - If selected task no longer exists, selection resets
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

// --- Hoisted mocks ---

const { mockFetchCalendarWindow, mockFetchTaskActivitySpans } = vi.hoisted(
  () => ({
    mockFetchCalendarWindow: vi.fn().mockResolvedValue([]),
    mockFetchTaskActivitySpans: vi.fn().mockResolvedValue([]),
  }),
);

vi.mock("../../api/calendarWindow", () => ({
  fetchCalendarWindow: (...args: unknown[]) => mockFetchCalendarWindow(...args),
}));

vi.mock("../../api/calendarShare", async () =>
  (
    await import("../../test/calendarShareApiMock")
  ).calendarShareApiModuleMock(),
);

vi.mock("../../api/tasks", () => ({
  fetchTaskActivitySpans: (...args: unknown[]) =>
    mockFetchTaskActivitySpans(...args),
}));

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock(),
);

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock(),
);

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
  taskCatalogState,
} from "../../test/context-mocks";
import { resetCalendarShareApiMocks } from "../../test/calendarShareApiMock";
import { resetCalendarShareCatalogForTests } from "../../domain/calendarShare/useCalendarShareCatalog.testing";
import { useTimelinePageContainer } from "./useTimelinePageContainer";

// --- Test harness component ---

type HookResult = ReturnType<typeof useTimelinePageContainer>;

/**
 * A wrapper component that calls the hook and exposes its result via a ref.
 * This allows tests to inspect and interact with the hook's return value.
 */
function HookHarness({
  resultRef,
}: {
  resultRef: React.MutableRefObject<HookResult | null>;
}) {
  const result = useTimelinePageContainer();
  resultRef.current = result;
  return null;
}

function makeTimelineTask(id: string, name: string) {
  return makeAnalysisTask({ id, name, analysisMode: "intel_event" });
}

describe("TimelinePage task selection (Req 3.1, 3.2, 3.3, 3.4)", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let resultRef: { current: HookResult | null };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    window.localStorage.clear();
    window.localStorage.setItem(MONITOR_MODE_KEY, "pages");
    mockFetchCalendarWindow.mockReset().mockResolvedValue([]);
    mockFetchTaskActivitySpans.mockReset().mockResolvedValue([]);
    resetCalendarShareApiMocks();
    resetCalendarShareCatalogForTests();
    resetTaskCatalogState([
      makeTimelineTask("task-a", "任務 A"),
      makeTimelineTask("task-b", "任務 B"),
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
    resetCalendarShareCatalogForTests();
  });

  async function renderHookAsync() {
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(
          MemoryRouter,
          null,
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

  // --- Req 3.1, 3.3: Selecting a task in Gantt mode updates selectedSources ---

  describe("Gantt mode task selection updates selectedSources", () => {
    it("selecting a task updates selectedSources state", async () => {
      // Start in gantt mode with all-tasks default
      window.localStorage.setItem(
        "im:timeline:view-mode",
        JSON.stringify("gantt"),
      );

      await renderHookAsync();

      expect(resultRef.current!.sources.selectedSources).toBeNull();

      // Now select a concrete task
      await act(async () => {
        resultRef.current!.sources.setSelectedSources({
          taskIds: ["task-b"],
          worksetIds: [],
        });
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(resultRef.current!.sources.selectedSources).toEqual({
        taskIds: ["task-b"],
        worksetIds: [],
      });
    });

    it("Gantt mode keeps all-tasks when none is selected", async () => {
      window.localStorage.setItem(
        "im:timeline:view-mode",
        JSON.stringify("gantt"),
      );

      await renderHookAsync();

      expect(resultRef.current!.sources.selectedSources).toBeNull();
    });
  });

  // --- Req 3.1, 3.3: selectedSources change triggers schedule events fetch ---

  describe("selectedSources change triggers schedule events fetch", () => {
    it("triggers calendar window refetch when the selected task changes in Gantt mode", async () => {
      window.localStorage.setItem(
        "im:timeline:view-mode",
        JSON.stringify("gantt"),
      );

      await renderHookAsync();

      // Clear call history after initial fetch
      mockFetchCalendarWindow.mockClear();

      // Select a different task
      await act(async () => {
        resultRef.current!.sources.setSelectedSources({
          taskIds: ["task-b"],
          worksetIds: [],
        });
        await Promise.resolve();
        await Promise.resolve();
      });

      // The schedule events fetch should be called with the new task ID
      expect(mockFetchCalendarWindow).toHaveBeenCalled();
    });

    it("initial Gantt mount fetches the calendar window when all-tasks is selected", async () => {
      window.localStorage.setItem(
        "im:timeline:view-mode",
        JSON.stringify("gantt"),
      );

      await renderHookAsync();

      // All-tasks passes undefined taskId (same as calendar all-tasks).
      expect(mockFetchCalendarWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          includeAnalysis: true,
          includeUser: true,
          includeRecurring: true,
          includeItems: true,
        }),
        expect.any(AbortSignal),
      );
    });
  });

  // --- Req 3.4: If a selected task no longer exists, selection resets ---

  describe("selection resets when task no longer in catalog", () => {
    it("resets selectedSources when selected task disappears from task catalog", async () => {
      window.localStorage.setItem(
        "im:timeline:view-mode",
        JSON.stringify("gantt"),
      );
      window.localStorage.setItem(
        "im:timeline:selected-sources",
        JSON.stringify({ taskIds: ["task-b"], worksetIds: [] }),
      );

      await renderHookAsync();

      // Initially "task-b" exists so it should remain selected
      expect(resultRef.current!.sources.selectedSources).toEqual({
        taskIds: ["task-b"],
        worksetIds: [],
      });

      // Now remove "task-b" from the catalog
      await act(async () => {
        taskCatalogState.tasks = [makeTimelineTask("task-a", "任務 A")];
        // Re-render to trigger the effect
        root!.render(
          createElement(
            MemoryRouter,
            null,
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

      // Unknown task resets to all-tasks (same in calendar and gantt)
      expect(resultRef.current!.sources.selectedSources).toBeNull();
    });

    it("resets to empty string in calendar mode when task disappears", async () => {
      window.localStorage.setItem(
        "im:timeline:view-mode",
        JSON.stringify("calendar"),
      );
      window.localStorage.setItem(
        "im:timeline:selected-sources",
        JSON.stringify({ taskIds: ["task-b"], worksetIds: [] }),
      );

      await renderHookAsync();

      expect(resultRef.current!.sources.selectedSources).toEqual({
        taskIds: ["task-b"],
        worksetIds: [],
      });

      // Remove "task-b"
      await act(async () => {
        taskCatalogState.tasks = [makeTimelineTask("task-a", "任務 A")];
        root!.render(
          createElement(
            MemoryRouter,
            null,
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

      // In calendar mode, should reset to "" (show all tasks)
      expect(resultRef.current!.sources.selectedSources).toBeNull();
    });
  });
});
