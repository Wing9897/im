import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisTask } from "../../types/tasks";
import type { TrackableItem } from "../../api/items";
import type { UserEvent } from "../../api/userEvents";

const listItems = vi.fn();
const listItemCategories = vi.fn();
const listUserEventsPage = vi.fn();
const navigate = vi.fn();

vi.mock("../../api/items", () => ({
  listItems: (...args: unknown[]) => listItems(...args),
  listItemCategories: (...args: unknown[]) => listItemCategories(...args),
}));

vi.mock("../../api/userEvents", () => ({
  listUserEventsPage: (...args: unknown[]) => listUserEventsPage(...args),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
}));

vi.mock("react-i18next", () => ({
  useTranslation: (ns?: string) => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (ns === "items") return key;
      if (ns === "workset") {
        return key;
      }
      if (key === "workset:detailSubtitle") return "subtitle";
      if (key === "workset:detailSummaryExpiringHeading") return "Expiring";
      if (key === "workset:detailSummaryEventsHeading") return "Events";
      if (key === "workset:detailSummaryExpiringEmpty") return "no expiring";
      if (key === "workset:detailSummaryEventsEmpty") return "no events";
      if (key === "workset:detailSummaryLoading") return "loading";
      if (key === "workset:detailSummaryEventsError") return "events error";
      if (key === "workset:detailTasksHeading") return "Tasks";
      if (key === "workset:detailItemsHeading") return "Items";
      if (key === "workset:detailTasksEmpty") return "no tasks";
      if (key === "workset:detailItemsEmpty") return "no items";
      if (key === "workset:openItems") return "items";
      if (key === "workset:addItem") return "add item";
      if (key === "workset:addEvent") return "add event";
      if (key === "workset:openTaskAria") return `Open task ${opts?.name ?? ""}`;
      if (key === "workset:openEventAria") return `Open event ${opts?.name ?? ""}`;
      if (key === "workset:eventAllDay") return "All day";
      if (key === "tasks:addTask") return "add task";
      return key;
    },
  }),
}));

import { WorksetContentsPanel } from "./WorksetContentsPanel";

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function task(partial: Partial<AnalysisTask> & { id: string; name: string }): AnalysisTask {
  return {
    description: null,
    promptTemplate: "",
    analysisMode: "intel_event",
    analysisTimeRange: "7d",
    version: 1,
    isActive: true,
    channelIds: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    worksetId: "ws-1",
    llmProfileId: "profile-default",
    ...partial,
  };
}

function item(partial: Partial<TrackableItem> & { id: string; title: string }): TrackableItem {
  return {
    worksetId: "ws-1",
    categoryId: null,
    expiresAt: null,
    remindBeforeDays: 7,
    notes: "",
    status: "active",
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

function userEvent(
  partial: Partial<UserEvent> & { id: string; title: string; startTime: string },
): UserEvent {
  return {
    body: "",
    endTime: null,
    location: null,
    origin: "manual",
    isAllDay: false,
    taskId: "",
    worksetId: "ws-1",
    kind: "normal",
    source: "user",
    dismissed: false,
    important: false,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...partial,
  };
}

async function flushLoads() {
  await act(async () => {
    await Promise.all([
      listItems.mock.results.at(-1)?.value,
      listItemCategories.mock.results.at(-1)?.value,
      listUserEventsPage.mock.results.at(-1)?.value,
    ]);
  });
}

describe("WorksetContentsPanel", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    listItems.mockReset();
    listItemCategories.mockReset();
    listUserEventsPage.mockReset();
    navigate.mockReset();
    listItemCategories.mockResolvedValue([]);
    listItems.mockResolvedValue([
      item({ id: "i1", title: "Passport", expiresAt: isoDaysFromNow(2) }),
      item({ id: "i2", title: "Old", status: "archived" }),
      item({ id: "i3", title: "Far", expiresAt: isoDaysFromNow(60) }),
    ]);
    const soon = new Date();
    soon.setDate(soon.getDate() + 3);
    listUserEventsPage.mockResolvedValue({
      items: [userEvent({ id: "e1", title: "Standup", startTime: soon.toISOString() })],
      totalCount: 0,
      hasMore: false,
    });
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

  it("renders member tasks, active items, and summary cards", async () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <WorksetContentsPanel
          workset={{
            id: "ws-1",
            title: "Ops",
            isSystem: false,
            tasks: [task({ id: "t1", name: "Scan" })],
          }}
        />,
      );
    });

    await flushLoads();

    expect(listItems).toHaveBeenCalledWith({ worksetId: "ws-1" });
    expect(listUserEventsPage).toHaveBeenCalledWith(
      expect.objectContaining({ worksetId: "ws-1", start: expect.any(String), end: expect.any(String) }),
    );
    expect(container.textContent).toContain("Scan");
    const taskCardText =
      container.querySelector('[data-testid="workset-detail-task-t1"]')?.textContent ?? "";
    expect(taskCardText).toContain("情報任務");
    expect(taskCardText).not.toMatch(/(^|[^a-zA-Z])intel_event([^a-zA-Z]|$)/);
    expect(container.textContent).toContain("Passport");
    expect(container.textContent).not.toContain("Old");
    expect(container.querySelector('[data-testid="workset-summary-item-i1"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="workset-summary-item-i3"]')).toBeNull();
    expect(container.querySelector('[data-testid="workset-summary-event-e1"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="workset-detail-dialog"]')).toBeNull();

    const taskBtn = container.querySelector('[data-testid="workset-detail-task-t1"]');
    expect(taskBtn).toBeTruthy();
    act(() => {
      (taskBtn as HTMLElement).click();
    });
    expect(navigate).toHaveBeenCalledWith("/tasks/t1/edit");
  });

  it("navigates into item / event from summary", async () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <WorksetContentsPanel
          workset={{
            id: "ws-1",
            title: "Ops",
            isSystem: false,
            tasks: [],
          }}
        />,
      );
    });

    await flushLoads();

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="workset-summary-item-i1"]')!
        .click();
    });
    expect(navigate).toHaveBeenCalledWith("/items/i1/edit");

    navigate.mockClear();

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="workset-summary-event-e1"]')!
        .click();
    });
    expect(navigate).toHaveBeenCalledWith(
      expect.stringMatching(/^\/timeline\?eventId=e1&at=/),
    );
  });

  it("navigates to items/timeline create with workset prefill", async () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <WorksetContentsPanel
          workset={{
            id: "ws-1",
            title: "Ops",
            isSystem: false,
            tasks: [],
          }}
        />,
      );
    });

    await flushLoads();

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="workset-detail-add-item"]')!
        .click();
    });
    expect(navigate).toHaveBeenCalledWith("/items/new?worksetId=ws-1");

    navigate.mockClear();

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="workset-detail-add-event"]')!
        .click();
    });
    expect(navigate).toHaveBeenCalledWith("/timeline?newEvent=1&worksetId=ws-1");

    navigate.mockClear();

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="workset-detail-add-task"]')!
        .click();
    });
    expect(navigate).toHaveBeenCalledWith("/tasks/new?worksetId=ws-1");
  });

  it("shows empty summary copy when nothing is due", async () => {
    listItems.mockResolvedValue([item({ id: "ok", title: "Ok", expiresAt: isoDaysFromNow(40) })]);
    listUserEventsPage.mockResolvedValue({ items: [], totalCount: 0, hasMore: false });

    act(() => {
      root = createRoot(container);
      root.render(
        <WorksetContentsPanel
          workset={{ id: "ws-1", title: "Ops", isSystem: false, tasks: [] }}
        />,
      );
    });

    await flushLoads();
    expect(container.textContent).toContain("no expiring");
    expect(container.textContent).toContain("no events");
  });
});
