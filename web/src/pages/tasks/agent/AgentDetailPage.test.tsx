import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../context/ToastContext", async () =>
  (await import("../../../test/context-mocks")).toastContextModuleMock(),
);

vi.mock("../../../context/TaskCatalogContext", async () =>
  (await import("../../../test/context-mocks")).taskCatalogModuleMock(),
);

vi.mock("../../../context/AnalysisStatusContext", () => ({
  useAnalysisStatus: () => ({
    activeAnalyses: new Map(),
    queueStatus: null,
  }),
}));

vi.mock("../../../hooks/useChannelsWithSources", () => ({
  useChannelsWithSources: () => ({ channels: [] }),
}));

vi.mock("../../../api/userEvents", () => ({
  listUserEventsPage: vi.fn().mockResolvedValue({ items: [], totalCount: 0, hasMore: false }),
}));

vi.mock("../../../api/recurringSeries", () => ({
  listRecurringSeries: vi.fn().mockResolvedValue({
    items: [
      {
        id: "child-1",
        name: "Daily standup",
        rrule: "FREQ=DAILY",
        isActive: true,
        parentTaskId: "proj-1",
      },
    ],
    totalCount: 1,
    hasMore: false,
  }),
}));

vi.mock("../../../api/calendarWindow", () => ({
  fetchCalendarWindow: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../api/timelineDismissals", () => ({
  dismissTimelineEvent: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../../api/tasks", () => ({
  fetchTaskActivitySpans: vi.fn().mockResolvedValue([
    {
      taskId: "proj-1",
      taskName: "Launch",
      description: null,
      analysisTimeRange: "7d",
      isActive: true,
      earliestBatchStart: "2026-07-01T00:00:00Z",
      latestBatchEnd: "2026-07-27T08:00:00Z",
      completedBatchCount: 2,
      lastAgentMessage: "Reconciled demos",
      lastToolCalls: [
        { name: "calendar.upcoming", arguments: { limit: 5 }, resultSummary: "2 items" },
      ],
      lastErrorMessage: null,
      lastMessageCount: 12,
    },
  ]),
  fetchAgentTickStatus: vi.fn().mockResolvedValue({
    taskId: "proj-1",
    cursorAt: "2026-07-27T07:00:00Z",
    pendingSinceCursor: 40,
    ticks: [
      {
        batchId: "b-ok",
        status: "completed",
        outcome: "success",
        messageCount: 12,
        agentMessage: "Reconciled demos",
        errorMessage: null,
        toolCalls: [
          { name: "calendar.upcoming", arguments: { limit: 5 }, resultSummary: "2 items" },
        ],
        createdAt: "2026-07-27T07:50:00Z",
        completedAt: "2026-07-27T08:00:00Z",
      },
      {
        batchId: "b-err",
        status: "completed",
        outcome: "error",
        messageCount: 0,
        agentMessage: null,
        errorMessage: "upstream timeout",
        toolCalls: [],
        createdAt: "2026-07-26T08:00:00Z",
        completedAt: "2026-07-26T08:01:00Z",
      },
    ],
  }),
}));

import {
  makeAnalysisTask,
  resetTaskCatalogState,
} from "../../../test/context-mocks";
import { AgentDetailPage } from "./AgentDetailPage";

describe("AgentDetailPage", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    resetTaskCatalogState([
      makeAnalysisTask({
        id: "proj-1",
        name: "Launch",
        analysisMode: "agent",
        outputCalendar: true,
        description: "Ship the product",
        scheduleRrule: "FREQ=HOURLY",
      }),
    ]);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
  });

  it("renders project overview and child recurring list", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <MemoryRouter initialEntries={["/tasks/proj-1/agent"]}>
          <Routes>
            <Route path="/tasks/:taskId/agent" element={<AgentDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="project-detail-toolbar"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="project-detail-retract"]')?.textContent).toContain(
      "收回最近一次調和",
    );
    expect(container.textContent).toContain("Launch");
    expect(container.textContent).toContain("Ship the product");
    expect(container.querySelector('[data-testid="project-detail-children"]')?.textContent).toContain(
      "Daily standup",
    );
    expect(container.querySelector('[data-testid="project-detail-pending-cursor"]')?.textContent).toContain(
      "40",
    );

    const extrasToggle = container.querySelector(
      '[data-testid="project-detail-tick-extras-toggle"]',
    ) as HTMLButtonElement | null;
    expect(extrasToggle).not.toBeNull();
    await act(async () => {
      extrasToggle!.click();
    });

    expect(container.querySelector('[data-testid="project-detail-tick-message"]')?.textContent).toContain(
      "Reconciled demos",
    );
    expect(container.querySelector('[data-testid="project-detail-tool-summary"]')?.textContent).toContain(
      "calendar.upcoming",
    );

    // Tick log is collapsible and defaults open when an error exists.
    expect(container.querySelector('[data-testid="project-detail-tick-log"]')?.textContent).toContain(
      "upstream timeout",
    );
  });

  it("redirects when task is not a project", async () => {
    resetTaskCatalogState([
      makeAnalysisTask({ id: "event-1", name: "Watch", analysisMode: "intel_event" }),
    ]);

    await act(async () => {
      root = createRoot(container);
      root.render(
        <MemoryRouter initialEntries={["/tasks/event-1/agent"]}>
          <Routes>
            <Route path="/tasks/:taskId/agent" element={<AgentDetailPage />} />
            <Route path="/tasks" element={<div data-testid="tasks-home">tasks</div>} />
          </Routes>
        </MemoryRouter>,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="tasks-home"]')).not.toBeNull();
  });
});
