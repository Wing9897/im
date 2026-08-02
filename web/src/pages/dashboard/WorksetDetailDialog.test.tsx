import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisTask } from "../../types/tasks";
import type { TrackableItem } from "../../api/items";

const listItems = vi.fn();
const navigate = vi.fn();

vi.mock("../../api/items", () => ({
  listItems: (...args: unknown[]) => listItems(...args),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
}));

vi.mock("../../components/ModalDialog", () => ({
  ModalDialog: ({
    children,
    footer,
    title,
    testId,
  }: {
    children: React.ReactNode;
    footer: React.ReactNode;
    title?: string;
    testId?: string;
  }) => (
    <div data-testid={testId ?? "modal"}>
      <h2>{title}</h2>
      <div>{children}</div>
      <div>{footer}</div>
    </div>
  ),
}));

vi.mock("react-i18next", () => ({
  useTranslation: (ns?: string) => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (ns === "items") return key;
      if (key === "workset.detailTitle") return `Detail ${opts?.name ?? ""}`;
      if (key === "workset.detailSubtitle") return "subtitle";
      if (key === "workset.detailTasksHeading") return "Tasks";
      if (key === "workset.detailItemsHeading") return "Items";
      if (key === "workset.detailTasksEmpty") return "no tasks";
      if (key === "workset.detailItemsEmpty") return "no items";
      if (key === "workset.openItems") return "items";
      if (key === "workset.addItem") return "add item";
      if (key === "workset.addEvent") return "add event";
      if (key === "workset.itemNoExpiry") return "no expiry";
      if (key === "workset.itemOverdue") return `overdue ${opts?.count}`;
      if (key === "tasks.addTask") return "add task";
      if (key === "dialog.close") return "close";
      if (key === "workset.rename") return "rename";
      if (key === "workset.delete") return "delete";
      return key;
    },
  }),
}));

import { WorksetDetailDialog } from "./WorksetDetailDialog";

function task(partial: Partial<AnalysisTask> & { id: string; name: string }): AnalysisTask {
  return {
    description: null,
    promptTemplate: "",
    analysisMode: "event",
    analysisTimeRange: "7d",
    version: 1,
    isActive: true,
    channelIds: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    worksetId: "ws-1",
    ...partial,
  };
}

function item(partial: Partial<TrackableItem> & { id: string; title: string }): TrackableItem {
  return {
    worksetId: "ws-1",
    categoryId: null,
    purchasedAt: null,
    expiresAt: null,
    remindBeforeDays: 7,
    notes: "",
    status: "active",
    attributes: {},
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

describe("WorksetDetailDialog", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    listItems.mockReset();
    navigate.mockReset();
    listItems.mockResolvedValue([
      item({ id: "i1", title: "Passport" }),
      item({ id: "i2", title: "Old", status: "archived" }),
    ]);
    container = document.createElement("div");
    document.body.appendChild(container);
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

  it("lists member tasks and active items", async () => {
    const onOpenTask = vi.fn();
    const onClose = vi.fn();

    act(() => {
      root = createRoot(container);
      root.render(
        <WorksetDetailDialog
          workset={{
            id: "ws-1",
            title: "Ops",
            isSystem: false,
            tasks: [task({ id: "t1", name: "Scan" })],
          }}
          onClose={onClose}
          onOpenTask={onOpenTask}
        />,
      );
    });

    await act(async () => {
      await listItems.mock.results[0]?.value;
    });

    expect(listItems).toHaveBeenCalledWith({ worksetId: "ws-1" });
    expect(container.textContent).toContain("Scan");
    expect(container.textContent).toContain("Passport");
    expect(container.textContent).not.toContain("Old");

    const taskBtn = container.querySelector('[data-testid="workset-detail-task-t1"]');
    expect(taskBtn).toBeTruthy();
    act(() => {
      (taskBtn as HTMLElement).click();
    });
    expect(onOpenTask).toHaveBeenCalledTimes(1);
  });

  it("navigates to items/timeline create with workset prefill", async () => {
    const onClose = vi.fn();

    act(() => {
      root = createRoot(container);
      root.render(
        <WorksetDetailDialog
          workset={{
            id: "ws-1",
            title: "Ops",
            isSystem: false,
            tasks: [],
          }}
          onClose={onClose}
          onOpenTask={vi.fn()}
        />,
      );
    });

    await act(async () => {
      await listItems.mock.results[0]?.value;
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="workset-detail-add-item"]')!
        .click();
    });
    expect(onClose).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/items?new=1&worksetId=ws-1");

    onClose.mockClear();
    navigate.mockClear();

    act(() => {
      root!.render(
        <WorksetDetailDialog
          workset={{
            id: "ws-1",
            title: "Ops",
            isSystem: false,
            tasks: [],
          }}
          onClose={onClose}
          onOpenTask={vi.fn()}
        />,
      );
    });

    await act(async () => {
      await listItems.mock.results[1]?.value;
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="workset-detail-add-event"]')!
        .click();
    });
    expect(onClose).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/timeline?newEvent=1&worksetId=ws-1");
  });
});
