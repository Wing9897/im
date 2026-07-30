/**
 * Smoke tests for Desktop calendar-import host (shared UserEventDialog).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";

const mockCreateUserEvent = vi.fn();
const mockShowToast = vi.fn();
const mockGetPending = vi.fn();
let importListener: ((message: unknown) => void) | null = null;

vi.mock("../../api/userEvents", () => ({
  createUserEvent: (...args: unknown[]) => mockCreateUserEvent(...args),
}));

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock("../../context/TaskCatalogContext", () => ({
  useTaskCatalog: () => ({
    tasks: [
      {
        id: "task-1",
        name: "Calendar task",
        analysisMode: "calendar_task",
        isActive: true,
      },
    ],
    tasksLoading: false,
    taskLoadError: null,
    refreshTasks: vi.fn(),
    worksets: [{ id: "__user__", name: "一般", isSystem: true }],
    worksetsLoading: false,
    refreshWorksets: vi.fn(),
  }),
}));

vi.mock("../../electron/electronWindow", () => ({
  isElectronDesktop: () => true,
}));

vi.mock("../../electron/calendarImport", () => ({
  getElectronCalendarImport: () => ({
    getPending: () => mockGetPending(),
    onImport: (cb: (message: unknown) => void) => {
      importListener = cb;
      return () => {
        importListener = null;
      };
    },
  }),
}));

import { CalendarImportHost } from "./CalendarImportHost";

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("CalendarImportHost", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    mockCreateUserEvent.mockReset().mockResolvedValue({});
    mockShowToast.mockReset();
    mockGetPending.mockReset().mockResolvedValue(null);
    importListener = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = null;
    container = null;
  });

  it("opens dialog from pending import and saves", async () => {
    mockGetPending.mockResolvedValue({
      ok: true,
      draft: {
        title: "Imported",
        startTime: "2026-07-29T10:00:00Z",
        endTime: "2026-07-29T11:00:00Z",
        location: "Room",
        body: "Notes",
        worksetId: "",
        source: "file",
        sourceLabel: "a.ics",
      },
    });

    await act(async () => {
      root!.render(createElement(CalendarImportHost));
    });
    await flush();

    const dialog = document.querySelector('[data-testid="user-event-dialog"]');
    expect(dialog).not.toBeNull();
    const titleInput = Array.from(document.querySelectorAll("input")).find(
      (el) => (el as HTMLInputElement).value === "Imported",
    ) as HTMLInputElement | undefined;
    expect(titleInput).toBeTruthy();

    const primary = Array.from(document.querySelectorAll("button")).find((btn) =>
      /新增|Add/i.test(btn.textContent || ""),
    );
    expect(primary).toBeTruthy();
    await act(async () => {
      primary!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(mockCreateUserEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Imported",
        location: "Room",
      }),
    );
  });

  it("toasts on import error push", async () => {
    await act(async () => {
      root!.render(createElement(CalendarImportHost));
    });
    await flush();
    expect(importListener).not.toBeNull();
    act(() => {
      importListener?.({ ok: false, error: "boom" });
    });
    expect(mockShowToast).toHaveBeenCalledWith("boom", "error");
  });
});
