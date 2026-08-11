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
