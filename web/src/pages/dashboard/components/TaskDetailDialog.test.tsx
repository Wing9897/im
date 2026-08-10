import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskDetailDialog } from "./TaskDetailDialog";
import type { AnalysisTask } from "../../../types/tasks";
import { wrapWithI18n } from "../../../test/i18nHarness";

vi.mock("../../../hooks/useFocusTrap", () => ({
  useFocusTrap: () => ({ current: null }),
}));

vi.mock("../../../components/common/OverlayPortal", () => ({
  OverlayPortal: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="overlay">{children}</div>
  ),
}));

vi.mock("../../../api/userEvents", () => ({
  listUserEvents: vi.fn().mockResolvedValue([
    {
      id: "ue-1",
      title: "Kickoff",
      startTime: "2026-08-01T09:00:00Z",
      endTime: null,
      location: "HQ",
      body: "",
      origin: "manual",
      taskId: "cal-1",
    },
  ]),
}));

vi.mock("../../../api/results", () => ({
  fetchCalendarOccurrences: vi.fn().mockResolvedValue([
    {
      id: "occ-1",
      taskId: "rec-1",
      title: "Daily standup",
      startTime: "2026-07-29T01:00:00Z",
      endTime: "2026-07-29T01:30:00Z",
      location: null,
      description: null,
      isAllDay: false,
    },
  ]),
}));

vi.mock("../../../api/taskSchedule", () => ({
  fetchTaskSchedule: vi.fn().mockResolvedValue({
    taskId: "rec-1",
    rrule: "FREQ=DAILY",
    eventLocation: null,
  }),
}));

let container: HTMLDivElement;
let root: Root | null = null;

function makeTask(overrides: Partial<AnalysisTask> = {}): AnalysisTask {
  return {
    id: "task-1",
    name: "Test Task",
    description: "",
    analysisMode: "intel_event",
    analysisTimeRange: "7d",
    channelIds: [
      { id: "ch-1", platform: "telegram", platformId: "123" },
      { id: "ch-2", platform: "telegram", platformId: "456" },
    ],
    isActive: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderDialog(node: React.ReactElement) {
  act(() => {
    root = createRoot(container);
    root.render(
      createElement(
        MemoryRouter,
        null,
        wrapWithI18n(node),
      ),
    );
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
  }
  root = null;
  container.remove();
});

describe("TaskDetailDialog", () => {
  it("renders metrics row and collapsible channel summary", () => {
    renderDialog(
      createElement(TaskDetailDialog, {
        task: makeTask(),
        stats: {
          unanalyzedCount: 3,
          queuedMessageCount: 1,
          analyzedCount: 9,
          triggerThreshold: 50,
          isRunning: false,
        },
        onClose: vi.fn(),
        onEdit: vi.fn(),
      }),
    );

    expect(container.textContent).toContain("Test Task");
    expect(container.textContent).toContain("待分析");
    expect(container.textContent).toContain("3");
    expect(container.textContent).toContain("共 2 個頻道");
    expect(container.querySelector("[data-testid='task-detail-channels-toggle']")).toBeTruthy();
  });

  it("shows related timed events for recurring tasks instead of analysis metrics", async () => {
    await act(async () => {
      renderDialog(
        createElement(TaskDetailDialog, {
          task: makeTask({
            id: "rec-1",
            name: "Standup",
            analysisMode: "recurring",
            channelIds: [],
          }),
          stats: {
            unanalyzedCount: 9,
            queuedMessageCount: 0,
            analyzedCount: 0,
            triggerThreshold: 50,
            isRunning: false,
          },
          onClose: vi.fn(),
          onEdit: vi.fn(),
        }),
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("待分析");
    expect(container.textContent).not.toContain("FREQ=DAILY");
    expect(container.querySelector("[data-testid='task-detail-related-events']")).toBeTruthy();
    expect(container.querySelector("[data-testid='task-detail-related-list']")?.textContent).toContain(
      "Daily standup",
    );
    expect(container.querySelector("[data-testid='task-detail-related-list']")?.textContent).toContain(
      "Kickoff",
    );
    expect(container.querySelector("[data-testid='task-detail-open-timeline']")).toBeTruthy();
  });

});

describe("MessageDetailDialog", () => {
  it("renders chat bubble hero", async () => {
    const { MessageDetailDialog } = await import("../../monitor/components/MessageDetailDialog");

    act(() => {
      root = createRoot(container);
      root.render(
        wrapWithI18n(createElement(MessageDetailDialog, {
            message: {
              id: "m-1",
              platform: "telegram",
              platformId: "chan-1",
              platformMessageId: "pm-1",
              sourceId: "acc-1",
              channelName: "General",
              senderId: "user-1",
              senderName: "Alice",
              content: "Hello from chat",
              timestamp: "2025-01-01T12:00:00Z",
              createdAt: "2025-01-01T12:00:00Z",
              media: null,
              rawData: null,
            },
            onClose: vi.fn(),
          })),
      );
    });

    expect(container.querySelector("[data-testid='message-detail-bubble']")).toBeTruthy();
    expect(container.textContent).toContain("Hello from chat");
    expect(container.textContent).toContain("Alice");
  });
});
