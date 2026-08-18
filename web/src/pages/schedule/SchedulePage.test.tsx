import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();
const {
  mockListUserEventsPage,
  mockListRecurringSeries,
  mockDeleteUserEvent,
  mockDeleteRecurringSeries,
} = vi.hoisted(() => ({
  mockListUserEventsPage: vi.fn(),
  mockListRecurringSeries: vi.fn(),
  mockDeleteUserEvent: vi.fn(),
  mockDeleteRecurringSeries: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({
    pathname: "/schedule",
    search: "",
    hash: "",
    key: "schedule-test",
    state: null,
  }),
  useParams: () => ({}),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock());

vi.mock("../../api/userEvents", () => ({
  listUserEventsPage: (...args: unknown[]) => mockListUserEventsPage(...args),
  createUserEvent: vi.fn(),
  updateUserEvent: vi.fn(),
  deleteUserEvent: (...args: unknown[]) => mockDeleteUserEvent(...args),
}));

vi.mock("../../api/recurringSeries", () => ({
  listRecurringSeries: (...args: unknown[]) => mockListRecurringSeries(...args),
  deleteRecurringSeries: (...args: unknown[]) => mockDeleteRecurringSeries(...args),
  patchRecurringSeries: vi.fn(),
}));

vi.mock("../../components/calendar/UserEventDialog", () => ({
  UserEventDialog: () => null,
}));

import { mockShowToast } from "../../test/context-mocks";
import { SchedulePage } from "./SchedulePage";

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: number[] = [0];
  readonly disconnect = vi.fn();
  readonly observe = vi.fn();
  readonly takeRecords = vi.fn(() => []);
  readonly unobserve = vi.fn();
  constructor(
    public readonly callback: IntersectionObserverCallback,
    _options?: IntersectionObserverInit,
  ) {}
}

describe("SchedulePage", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    mockNavigate.mockReset();
    mockShowToast.mockReset();
    mockDeleteUserEvent.mockReset();
    mockDeleteRecurringSeries.mockReset();
    mockDeleteUserEvent.mockResolvedValue(undefined);
    mockDeleteRecurringSeries.mockResolvedValue(undefined);
    mockListUserEventsPage.mockResolvedValue({
      items: [
        {
          id: "ue-1",
          title: "晨會",
          body: "",
          startTime: "2026-09-01T09:00:00Z",
          endTime: null,
          location: "台北",
          origin: "manual",
          isAllDay: false,
          worksetId: "__user__",
          taskId: "",
          source: "user",
          dismissed: false,
          kind: "normal",
          createdAt: "2026-09-01T08:00:00Z",
          updatedAt: "2026-09-01T08:00:00Z",
        },
      ],
      totalCount: 1,
      hasMore: false,
    });
    mockListRecurringSeries.mockResolvedValue({
      items: [{
        id: "rec-1",
        name: "每日站會",
        description: null,
        rrule: "FREQ=DAILY",
        eventStartTime: null,
        eventEndTime: null,
        eventIsAllDay: false,
        eventLocation: null,
        eventDescription: null,
        eventTimezone: null,
        eventExdates: [],
        eventRdates: [],
        icsUid: null,
        icsSource: null,
        isActive: true,
        worksetId: "__user__",
        parentTaskId: null,
        itemId: null,
        createdAt: "2026-09-02T08:00:00Z",
        updatedAt: "2026-09-02T08:00:00Z",
      }],
      totalCount: 1,
      hasMore: false,
    });
    window.sessionStorage.clear();
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container.remove();
    vi.unstubAllGlobals();
  });

  it("renders unified list without tab split", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(SchedulePage));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="schedule-page"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="schedule-toolbar"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="schedule-tab-one-off"]')).toBeNull();
    expect(container.querySelector('[data-testid="schedule-tab-recurring"]')).toBeNull();
    expect(container.querySelector('[data-testid="schedule-grid"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="schedule-one-off-card-ue-1"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="schedule-recurring-card-rec-1"]')).toBeTruthy();
    expect(container.textContent).toContain("晨會");
    expect(container.textContent).toContain("每日站會");
    const oneOff = container.querySelector('[data-testid="schedule-one-off-card-ue-1"]');
    expect(oneOff?.querySelector('[data-testid="schedule-card-fields"]')?.className).toContain(
      "flex-col",
    );
    expect(oneOff?.querySelector('[data-testid="schedule-card-location"]')?.textContent).toContain(
      "地點：台北",
    );
    expect(oneOff?.querySelector('[data-testid="schedule-card-notes"]')?.textContent).toContain(
      "說明：N/A",
    );
    const recurring = container.querySelector('[data-testid="schedule-recurring-card-rec-1"]');
    expect(recurring?.querySelector('[data-testid="schedule-card-location"]')?.textContent).toContain(
      "地點：N/A",
    );
    expect(recurring?.querySelector('[data-testid="schedule-card-notes"]')?.textContent).toContain(
      "說明：N/A",
    );
    expect(mockListUserEventsPage).toHaveBeenCalled();
    expect(mockListRecurringSeries).toHaveBeenCalledWith({
      topLevelOnly: true,
      search: undefined,
      limit: 24,
      offset: 0,
    });
  });

  it("navigates to series editor when recurring edit is clicked", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(SchedulePage));
      await Promise.resolve();
      await Promise.resolve();
    });

    const editBtn = container.querySelector(
      '[data-testid="schedule-recurring-edit-rec-1"]',
    ) as HTMLButtonElement;
    expect(editBtn).toBeTruthy();

    await act(async () => {
      editBtn.click();
    });

    expect(mockNavigate).toHaveBeenCalledWith("/schedule/recurring/rec-1/edit");
  });

  async function renderPage() {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(SchedulePage));
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  async function confirmDeleteDialog() {
    const dialog = document.body.querySelector('[role="alertdialog"]') as HTMLElement;
    expect(dialog).toBeTruthy();
    const confirmBtn = dialog.querySelectorAll("button")[1] as HTMLButtonElement;
    await act(async () => {
      confirmBtn.click();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("hard-deletes a one-off event and drops it from the list", async () => {
    mockDeleteUserEvent.mockImplementation(async () => {
      mockListUserEventsPage.mockResolvedValue({ items: [], totalCount: 0, hasMore: false });
    });
    await renderPage();

    const deleteBtn = container.querySelector(
      '[data-testid="schedule-one-off-delete-ue-1"]',
    ) as HTMLButtonElement;
    await act(async () => {
      deleteBtn.click();
    });
    await confirmDeleteDialog();

    expect(mockDeleteUserEvent).toHaveBeenCalledWith("ue-1");
    expect(mockShowToast).toHaveBeenCalledWith("已刪除一般事件", "success");
    expect(container.querySelector('[data-testid="schedule-one-off-card-ue-1"]')).toBeNull();
  });

  it("toasts when one-off delete fails and keeps the card", async () => {
    mockDeleteUserEvent.mockRejectedValue(new Error("刪除被拒"));
    await renderPage();

    const deleteBtn = container.querySelector(
      '[data-testid="schedule-one-off-delete-ue-1"]',
    ) as HTMLButtonElement;
    await act(async () => {
      deleteBtn.click();
    });
    await confirmDeleteDialog();

    expect(mockDeleteUserEvent).toHaveBeenCalledWith("ue-1");
    expect(mockShowToast).toHaveBeenCalledWith("刪除被拒", "error");
    expect(container.querySelector('[data-testid="schedule-one-off-card-ue-1"]')).toBeTruthy();
  });

  it("hard-deletes a recurring series and drops it from the list", async () => {
    mockDeleteRecurringSeries.mockImplementation(async () => {
      mockListRecurringSeries.mockResolvedValue({ items: [], totalCount: 0, hasMore: false });
    });
    await renderPage();

    const deleteBtn = container.querySelector(
      '[data-testid="schedule-recurring-delete-rec-1"]',
    ) as HTMLButtonElement;
    await act(async () => {
      deleteBtn.click();
    });
    await confirmDeleteDialog();

    expect(mockDeleteRecurringSeries).toHaveBeenCalledWith("rec-1");
    expect(mockShowToast).toHaveBeenCalledWith("已刪除循環事件", "success");
    expect(container.querySelector('[data-testid="schedule-recurring-card-rec-1"]')).toBeNull();
  });

  it("toasts when recurring delete fails and keeps the card", async () => {
    mockDeleteRecurringSeries.mockRejectedValue(new Error("系列刪除失敗"));
    await renderPage();

    const deleteBtn = container.querySelector(
      '[data-testid="schedule-recurring-delete-rec-1"]',
    ) as HTMLButtonElement;
    await act(async () => {
      deleteBtn.click();
    });
    await confirmDeleteDialog();

    expect(mockDeleteRecurringSeries).toHaveBeenCalledWith("rec-1");
    expect(mockShowToast).toHaveBeenCalledWith("系列刪除失敗", "error");
    expect(container.querySelector('[data-testid="schedule-recurring-card-rec-1"]')).toBeTruthy();
  });
});
