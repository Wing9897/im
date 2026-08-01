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

vi.mock("../../../hooks/useChannelsWithAccounts", () => ({
  useChannelsWithAccounts: () => ({ channels: [] }),
}));

vi.mock("../../../api/userEvents", () => ({
  listUserEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../api/taskSchedule", () => ({
  fetchTaskSchedule: vi.fn().mockResolvedValue({
    taskId: "child-1",
    rrule: "FREQ=DAILY",
    eventLocation: null,
  }),
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
  fetchProjectTickStatus: vi.fn().mockResolvedValue({
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
  taskCatalogState,
} from "../../../test/context-mocks";
import { ProjectDetailPage } from "./ProjectDetailPage";

describe("ProjectDetailPage", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    resetTaskCatalogState([
      makeAnalysisTask({
        id: "proj-1",
        name: "Launch",
        analysisMode: "project",
        description: "Ship the product",
        scheduleType: "hourly",
        scheduleValue: null,
      }),
      makeAnalysisTask({
        id: "child-1",
        name: "Daily standup",
        analysisMode: "recurring",
        parentTaskId: "proj-1",
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
    // Catalog includes parentTaskId children; project detail must still see them
    // (would break if shared catalog used top_level_only).
    expect(taskCatalogState.tasks.some((task) => task.parentTaskId === "proj-1")).toBe(true);

    await act(async () => {
      root = createRoot(container);
      root.render(
        <MemoryRouter initialEntries={["/tasks/proj-1/project"]}>
          <Routes>
            <Route path="/tasks/:taskId/project" element={<ProjectDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="project-detail-toolbar"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="project-detail-reload"]')).not.toBeNull();
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
    taskCatalogState.tasks = [
      makeAnalysisTask({ id: "event-1", name: "Watch", analysisMode: "event" }),
    ];

    await act(async () => {
      root = createRoot(container);
      root.render(
        <MemoryRouter initialEntries={["/tasks/event-1/project"]}>
          <Routes>
            <Route path="/tasks/:taskId/project" element={<ProjectDetailPage />} />
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
