import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";

const mockPreview = vi.fn();
const mockCommit = vi.fn();
const mockShowToast = vi.fn();
const mockGetPending = vi.fn();
const mockEmitResourceModified = vi.fn();
let importListener: ((message: unknown) => void) | null = null;

vi.mock("../../api/calendarImports", () => ({
  previewCalendarImport: (...args: unknown[]) => mockPreview(...args),
  commitCalendarImport: (...args: unknown[]) => mockCommit(...args),
}));

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock("../../domain/sse/resourceModified", () => ({
  emitResourceModified: (...args: unknown[]) => mockEmitResourceModified(...args),
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
    mockPreview.mockReset().mockResolvedValue({
      sourceId: "ics",
      calendarName: "Team calendar",
      eventCount: 2,
      importableCount: 1,
      warnings: [{ code: "calendar-warning", message: "Calendar warning" }],
      items: [
        {
          uid: "series-1",
          title: "Weekly sync",
          targetType: "recurring",
          action: "update",
          supported: true,
          existingId: "task-1",
          fingerprint: "fp-1",
          startTime: "2026-07-29T10:00:00Z",
          endTime: "2026-07-29T11:00:00Z",
          isAllDay: false,
          timezone: "Asia/Taipei",
          rrule: "FREQ=WEEKLY",
          exdates: ["2026-08-05T10:00:00Z"],
          rdates: [],
          changes: [{ field: "title", before: "Old", after: "Weekly sync" }],
          warnings: [],
        },
        {
          uid: "override-1",
          title: "Unsupported override",
          targetType: "user_event",
          action: "unsupported",
          supported: false,
          existingId: null,
          fingerprint: "fp-2",
          startTime: "2026-07-30T10:00:00Z",
          endTime: null,
          isAllDay: false,
          timezone: "UTC",
          rrule: null,
          exdates: [],
          rdates: [],
          changes: [],
          warnings: [{ code: "unsupported_recurrence_id", message: "Not imported" }],
        },
      ],
    });
    mockCommit.mockReset().mockResolvedValue({
      sourceId: "ics",
      committedCount: 1,
      createdCount: 0,
      updatedCount: 1,
      unchangedCount: 0,
      results: [
        {
          uid: "series-1",
          targetType: "recurring",
          targetId: "task-1",
          action: "updated",
        },
      ],
    });
    mockShowToast.mockReset();
    mockEmitResourceModified.mockReset();
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

  it("previews all items, commits supported selections, and shows results", async () => {
    const content = "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n";
    mockGetPending.mockResolvedValue({
      ok: true,
      payload: {
        content,
        sourceId: "ics",
        source: "file",
        sourceLabel: "a.ics",
      },
    });

    await act(async () => {
      root!.render(createElement(CalendarImportHost));
    });
    await flush();

    const dialog = document.querySelector('[data-testid="calendar-import-dialog"]');
    expect(dialog).not.toBeNull();
    expect(mockPreview).toHaveBeenCalledWith({ content, sourceId: "ics" });
    expect(document.body.textContent).toContain("Weekly sync");
    expect(document.body.textContent).toContain("Unsupported override");
    expect(document.body.textContent).not.toContain("Asia/Taipei");
    expect(document.body.textContent).not.toContain("Old");
    expect(document.body.textContent).not.toMatch(/\bUID\b/);
    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
    expect((checkboxes[1] as HTMLInputElement).disabled).toBe(true);

    const primary = Array.from(document.querySelectorAll("button")).find((btn) =>
      /导入所选项|匯入所選項|Import selected/i.test(btn.textContent || ""),
    );
    expect(primary).toBeTruthy();
    await act(async () => {
      primary!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(mockCommit).toHaveBeenCalledWith({
      content,
      sourceId: "ics",
      selections: [{ uid: "series-1", fingerprint: "fp-1" }],
    });
    expect(document.querySelector('[data-testid="calendar-import-results"]')).not.toBeNull();
    expect(document.body.textContent).toMatch(/Weekly sync/);
    expect(mockEmitResourceModified).toHaveBeenCalledWith({
      resourceType: "recurring",
      resourceId: "task-1",
      action: "updated",
    });
  });

  it("selects all importable items and clears selection", async () => {
    mockPreview.mockResolvedValue({
      sourceId: "ics",
      calendarName: "Holidays",
      eventCount: 3,
      importableCount: 2,
      warnings: [],
      items: [
        {
          uid: "synth-a",
          title: "元旦",
          targetType: "user_event",
          action: "create",
          supported: true,
          existingId: null,
          fingerprint: "fp-a",
          startTime: "2026-01-01T00:00:00Z",
          endTime: "2026-01-02T00:00:00Z",
          isAllDay: true,
          timezone: null,
          rrule: null,
          exdates: [],
          rdates: [],
          changes: [],
          warnings: [],
        },
        {
          uid: "synth-b",
          title: "春節",
          targetType: "user_event",
          action: "create",
          supported: true,
          existingId: null,
          fingerprint: "fp-b",
          startTime: "2026-02-17T00:00:00Z",
          endTime: "2026-02-18T00:00:00Z",
          isAllDay: true,
          timezone: null,
          rrule: null,
          exdates: [],
          rdates: [],
          changes: [],
          warnings: [],
        },
        {
          uid: "override-x",
          title: "Exception",
          targetType: "user_event",
          action: "unsupported",
          supported: false,
          existingId: null,
          fingerprint: "fp-x",
          startTime: "2026-02-18T00:00:00Z",
          endTime: null,
          isAllDay: true,
          timezone: null,
          rrule: null,
          exdates: [],
          rdates: [],
          changes: [],
          warnings: [{ code: "unsupported_recurrence_id", message: "Not imported" }],
        },
      ],
    });
    mockGetPending.mockResolvedValue({
      ok: true,
      payload: {
        content: "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n",
        sourceId: "ics",
        source: "file",
        sourceLabel: "holidays.ics",
      },
    });

    await act(async () => {
      root!.render(createElement(CalendarImportHost));
    });
    await flush();

    const clearBtn = document.querySelector(
      '[data-testid="calendar-import-clear-selection"]',
    ) as HTMLButtonElement | null;
    const selectAllBtn = document.querySelector(
      '[data-testid="calendar-import-select-all"]',
    ) as HTMLButtonElement | null;
    expect(clearBtn).not.toBeNull();
    expect(selectAllBtn).not.toBeNull();

    const checkboxes = () =>
      Array.from(document.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];

    expect(checkboxes()[0].checked).toBe(true);
    expect(checkboxes()[1].checked).toBe(true);
    expect(checkboxes()[2].disabled).toBe(true);

    await act(async () => {
      clearBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();
    expect(checkboxes()[0].checked).toBe(false);
    expect(checkboxes()[1].checked).toBe(false);

    await act(async () => {
      selectAllBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();
    expect(checkboxes()[0].checked).toBe(true);
    expect(checkboxes()[1].checked).toBe(true);
    expect(checkboxes()[2].checked).toBe(false);
    expect(document.body.textContent).toContain("2026-01-01");
    expect(document.body.textContent).toMatch(/全[天日]|All day/);
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
