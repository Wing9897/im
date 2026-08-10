import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../../../components/items/emoji/emojiPickerReactMock";
import "./itemFormTestMocks";

import { SYSTEM_WORKSET_ID } from "../../../types/worksets";
import {
  cleanupItemFormDialogs,
  commitItemTitle,
  createItemFormRenderer,
  createUserEvent,
  deleteUserEvent,
  listTasks,
  listUserEvents,
  makeItem,
  resetItemFormTestMocks,
  showToast,
  WORKSETS,
} from "./itemFormTestHarness";

async function openLinkedCalendarCreateViaMenu(
  kind: "expires" | "other" | "purchaseEffective",
) {
  const addCal = document.querySelector(
    '[data-testid="item-form-add-linked-calendar"]',
  ) as HTMLButtonElement | null;
  expect(addCal).toBeTruthy();

  await act(async () => {
    addCal!.click();
    await Promise.resolve();
  });

  const modeOption = document.querySelector(
    `[data-testid="item-form-linked-calendar-mode-${kind}"]`,
  ) as HTMLButtonElement | null;
  expect(modeOption).toBeTruthy();

  await act(async () => {
    modeOption!.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("ItemForm linked calendars", () => {
  let container: HTMLDivElement;
  let root: Root;
  let renderForm: ReturnType<typeof createItemFormRenderer>;

  beforeEach(() => {
    resetItemFormTestMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    renderForm = createItemFormRenderer(root);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    cleanupItemFormDialogs();
  });

  it("shows linked-calendars section and opens in-place create when editing", async () => {
    listUserEvents.mockResolvedValue([
      {
        id: "ue-1",
        title: "Passport renew",
        startTime: "2026-09-01T09:00:00Z",
        endTime: null,
        body: "",
        location: null,
        origin: "manual",
        isAllDay: false,
        taskId: "",
        worksetId: SYSTEM_WORKSET_ID,
        itemId: "item-42",
        source: "user",
        dismissed: false,
        important: false,
        createdAt: "",
        updatedAt: "",
      },
    ]);
    listTasks.mockResolvedValue([
      {
        id: "rs-1",
        name: "Weekly check",
        description: null,
        promptTemplate: "",
        analysisMode: "recurring",
        analysisTimeRange: "all",
        version: 1,
        isActive: true,
        channelIds: [],
        scheduleRrule: "FREQ=WEEKLY;BYDAY=MO",
        includeInTimeline: true,
        parentTaskId: null,
        worksetId: SYSTEM_WORKSET_ID,
        itemId: "item-42",
        createdAt: "2026-08-01T00:00:00Z",
        updatedAt: "2026-08-01T00:00:00Z",
      },
    ]);

    await renderForm({ item: makeItem({ id: "item-42" }) });

    expect(listUserEvents).toHaveBeenCalledWith({ itemId: "item-42" });
    expect(listTasks).toHaveBeenCalledWith({
      itemId: "item-42",
      analysisMode: "recurring",
    });
    expect(document.querySelector('[data-testid="item-form-linked-calendars"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="item-form-linked-calendar-grid"]')).toBeTruthy();
    expect(document.body.textContent).toContain("Passport renew");
    expect(document.body.textContent).toContain("Weekly check");

    await openLinkedCalendarCreateViaMenu("other");

    expect(document.querySelector('[data-testid="user-event-dialog"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="user-event-item-select"]')).toBeNull();
    expect(document.querySelector('[data-testid="user-event-parent-item-readonly"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="user-event-workset-select"]')).toBeNull();
  });

  it("opens edit dialog when clicking a one-off linked calendar row", async () => {
    listUserEvents.mockResolvedValue([
      {
        id: "ue-1",
        title: "Passport renew",
        startTime: "2026-09-01T09:00:00Z",
        endTime: null,
        body: "",
        location: null,
        origin: "manual",
        isAllDay: false,
        remindBeforeDays: 2,
        taskId: "",
        worksetId: SYSTEM_WORKSET_ID,
        itemId: "item-42",
        source: "user",
        dismissed: false,
        important: false,
        createdAt: "",
        updatedAt: "",
      },
    ]);

    await renderForm({ item: makeItem({ id: "item-42" }) });

    const row = document.querySelector(
      '[data-testid="item-linked-calendar-row-one-off"]',
    ) as HTMLElement | null;
    expect(row).toBeTruthy();

    await act(async () => {
      row!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const titleInput = document.querySelector(
      '[data-testid="user-event-dialog"] input[aria-label="userEvent.titleAria"]',
    ) as HTMLInputElement | null;
    expect(titleInput?.value).toBe("Passport renew");
  });

  it("shows linked-calendars section on create with title-required hint when empty", async () => {
    await renderForm({ item: null });
    expect(document.querySelector('[data-testid="item-form-linked-calendars"]')).toBeTruthy();
    expect(
      document.querySelector('[data-testid="item-form-linked-calendars-create-hint"]')?.textContent,
    ).toBe("linkedCalendarsTitleRequiredHint");
    const addCal = document.querySelector(
      '[data-testid="item-form-add-linked-calendar"]',
    ) as HTMLButtonElement | null;
    expect(addCal!.disabled).toBe(true);
    expect(listUserEvents).not.toHaveBeenCalled();
  });

  it("hides create hint after title is filled (auto-save needs no essay)", async () => {
    await renderForm({ item: null });
    expect(
      document.querySelector('[data-testid="item-form-linked-calendars-create-hint"]'),
    ).toBeTruthy();

    await commitItemTitle("New passport");

    expect(
      document.querySelector('[data-testid="item-form-linked-calendars-create-hint"]'),
    ).toBeNull();
    const addCal = document.querySelector(
      '[data-testid="item-form-add-linked-calendar"]',
    ) as HTMLButtonElement | null;
    expect(addCal!.disabled).not.toBe(true);
  });

  it("auto-saves item and opens linked calendar dialog on create", async () => {
    const saved = makeItem({ id: "item-new", title: "New passport" });
    const onSave = vi.fn(async (_draft: unknown, options?: { leaveAfterSave?: boolean }) => {
      if (options?.leaveAfterSave === false) return saved;
      return undefined;
    });

    await renderForm({ item: null, onSave });

    await commitItemTitle("New passport");

    const addCal = document.querySelector(
      '[data-testid="item-form-add-linked-calendar"]',
    ) as HTMLButtonElement | null;
    expect(addCal!.disabled).not.toBe(true);

    await openLinkedCalendarCreateViaMenu("other");

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: "New passport" }),
      { leaveAfterSave: false },
    );
    expect(document.querySelector('[data-testid="user-event-dialog"]')).toBeTruthy();
    expect(listUserEvents).toHaveBeenCalledWith({ itemId: "item-new" });
  });

  it("opens create dialog with title + all-day for quick Expires only", async () => {
    await renderForm({
      item: makeItem({ id: "item-42", categoryId: "seed_passport_docs" }),
    });

    await openLinkedCalendarCreateViaMenu("expires");

    const titleInput = document.querySelector(
      '[data-testid="user-event-dialog"] input[aria-label="userEvent.titleAria"]',
    ) as HTMLInputElement | null;
    expect(titleInput?.value).toBe("quickLinkedCalendar.expires");
    const allDay = document.querySelector(
      '[data-testid="user-event-all-day"]',
    ) as HTMLInputElement | null;
    expect(allDay?.checked).toBe(true);
    const remindInput = document.querySelector(
      '[data-testid="user-event-remind-before"]',
    ) as HTMLInputElement | null;
    expect(remindInput?.value).toBe("90");
  });

  it("prefills category default remind on add expiry calendar", async () => {
    await renderForm({
      item: makeItem({ id: "item-42", categoryId: "seed_food" }),
    });

    await openLinkedCalendarCreateViaMenu("expires");

    const remindInput = document.querySelector(
      '[data-testid="user-event-remind-before"]',
    ) as HTMLInputElement | null;
    expect(remindInput?.value).toBe("3");
  });

  it("creates linked calendar with item workset and no workset picker", async () => {
    await renderForm({
      item: makeItem({ id: "item-42", worksetId: "ws-custom" }),
      worksets: [
        ...WORKSETS,
        {
          id: "ws-custom",
          name: "Custom",
          isSystem: false,
          createdAt: "",
          updatedAt: "",
        },
      ],
    });

    await openLinkedCalendarCreateViaMenu("other");

    expect(document.querySelector('[data-testid="user-event-workset-select"]')).toBeNull();

    const titleInput = document.querySelector(
      '[data-testid="user-event-dialog"] input[aria-label="userEvent.titleAria"]',
    ) as HTMLInputElement | null;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(titleInput, "Renewal");
      titleInput!.dispatchEvent(new Event("input", { bubbles: true }));
      titleInput!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const submit = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent === "userEvent.create",
    );
    await act(async () => {
      submit!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createUserEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: "item-42",
        worksetId: "ws-custom",
        title: "Renewal",
      }),
    );
  });

  it("shows unified expiry chip with kind badge and no feature callout", async () => {
    listUserEvents.mockResolvedValueOnce([
      {
        id: "ue-exp",
        title: "到期",
        kind: "expires",
        startTime: "2026-08-01T00:00:00Z",
        endTime: null,
        body: "",
        location: null,
        origin: "manual",
        isAllDay: true,
        remindBeforeDays: null,
        taskId: "",
        worksetId: SYSTEM_WORKSET_ID,
        itemId: "item-42",
        source: "user",
        dismissed: false,
        important: false,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "",
      },
    ]);

    await renderForm({ item: makeItem({ id: "item-42", expiresAt: "2026-08-01" }) });

    expect(document.querySelector('[data-testid="item-form-linked-expiry-row"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="item-linked-calendar-badge-expires"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="item-linked-calendar-badge-primary"]')).toBeNull();
    expect(document.querySelector('[data-testid="item-form-linked-expiry-delete"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="item-form-linked-expiry-callout"]')).toBeNull();
    expect(document.querySelector('[data-testid="item-form-linked-expiry-panel"]')).toBeNull();
  });

  it("marks primary expiry when multiple expires exist", async () => {
    listUserEvents.mockResolvedValueOnce([
      {
        id: "ue-exp-1",
        title: "到期",
        kind: "expires",
        startTime: "2026-08-01T00:00:00Z",
        endTime: null,
        body: "",
        location: null,
        origin: "manual",
        isAllDay: true,
        remindBeforeDays: null,
        taskId: "",
        worksetId: SYSTEM_WORKSET_ID,
        itemId: "item-42",
        source: "user",
        dismissed: false,
        important: false,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "",
      },
      {
        id: "ue-exp-2",
        title: "Expires",
        kind: "expires",
        startTime: "2026-09-01T00:00:00Z",
        endTime: null,
        body: "",
        location: null,
        origin: "manual",
        isAllDay: true,
        remindBeforeDays: null,
        taskId: "",
        worksetId: SYSTEM_WORKSET_ID,
        itemId: "item-42",
        source: "user",
        dismissed: false,
        important: false,
        createdAt: "2026-02-01T00:00:00Z",
        updatedAt: "",
      },
    ]);

    await renderForm({ item: makeItem({ id: "item-42", expiresAt: "2026-08-01" }) });

    expect(document.querySelector('[data-testid="item-form-linked-expiry-row"]')).toBeTruthy();
    expect(document.querySelectorAll('[data-testid="item-linked-calendar-badge-expires"]').length).toBe(
      2,
    );
    expect(document.querySelector('[data-testid="item-linked-calendar-badge-primary"]')?.textContent).toBe(
      "linkedCalendarBadge.primary",
    );
    // Secondary expiry uses the shared one-off chip test id.
    expect(document.querySelector('[data-testid="item-linked-calendar-row-one-off"]')).toBeTruthy();
  });

  it("shows purchase direction badge on purchase_effective chips", async () => {
    listUserEvents.mockResolvedValueOnce([
      {
        id: "ue-buy",
        title: "購入",
        kind: "purchase_effective",
        amount: 42,
        direction: "income",
        startTime: "2026-08-01T10:00:00Z",
        endTime: null,
        body: "",
        location: null,
        origin: "manual",
        isAllDay: false,
        remindBeforeDays: null,
        taskId: "",
        worksetId: SYSTEM_WORKSET_ID,
        itemId: "item-42",
        source: "user",
        dismissed: false,
        important: false,
        createdAt: "",
        updatedAt: "",
      },
    ]);

    await renderForm({ item: makeItem({ id: "item-42" }) });

    expect(document.querySelector('[data-testid="item-linked-calendar-badge-income"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="item-form-linked-expiry-panel"]')).toBeNull();
  });

  it("soft-deletes a linked one-off calendar after confirm", async () => {
    listUserEvents.mockResolvedValue([
      {
        id: "ue-1",
        title: "Passport renew",
        startTime: "2026-09-01T09:00:00Z",
        endTime: null,
        body: "",
        location: null,
        origin: "manual",
        isAllDay: false,
        remindBeforeDays: null,
        taskId: "",
        worksetId: SYSTEM_WORKSET_ID,
        itemId: "item-42",
        source: "user",
        dismissed: false,
        important: false,
        createdAt: "",
        updatedAt: "",
      },
    ]);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    await renderForm({ item: makeItem({ id: "item-42" }) });

    const del = document.querySelector(
      '[data-testid="item-form-linked-calendar-delete-one-off"]',
    ) as HTMLButtonElement | null;
    await act(async () => {
      del!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteUserEvent).toHaveBeenCalledWith("ue-1");
    expect(showToast).toHaveBeenCalledWith("linkedCalendarDeleted", "success");
    confirmSpy.mockRestore();
  });

  it("shows one add control that opens a mode menu", async () => {
    await renderForm({ item: makeItem({ id: "item-42" }) });

    const addCal = document.querySelector(
      '[data-testid="item-form-add-linked-calendar"]',
    ) as HTMLButtonElement | null;
    expect(addCal).toBeTruthy();
    expect(document.querySelector('[data-testid="item-form-quick-linked-calendar-expires"]')).toBeNull();
    expect(document.querySelector('[data-testid="item-form-quick-linked-calendar-other"]')).toBeNull();
    expect(
      document.querySelector('[data-testid="item-form-quick-linked-calendar-purchaseEffective"]'),
    ).toBeNull();
    expect(document.querySelector('[data-testid="item-form-linked-expiry-row"]')).toBeNull();
    expect(document.querySelector('[data-testid="item-form-linked-expiry-callout"]')).toBeNull();
    expect(document.querySelector('[data-testid="item-form-linked-expiry-panel"]')).toBeNull();

    await act(async () => {
      addCal!.click();
      await Promise.resolve();
    });

    expect(document.querySelector('[data-testid="item-form-linked-calendar-mode-menu"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="item-form-linked-calendar-mode-expires"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="item-form-linked-calendar-mode-other"]')).toBeTruthy();
    expect(
      document.querySelector('[data-testid="item-form-linked-calendar-mode-purchaseEffective"]'),
    ).toBeTruthy();
  });

  it("allows creating another expiry calendar when one already exists", async () => {
    listUserEvents.mockResolvedValueOnce([
      {
        id: "ue-exp",
        title: "Expires",
        startTime: "2026-08-01T00:00:00Z",
        endTime: null,
        body: "",
        location: null,
        origin: "manual",
        isAllDay: true,
        remindBeforeDays: null,
        taskId: "",
        worksetId: SYSTEM_WORKSET_ID,
        itemId: "item-42",
        source: "user",
        dismissed: false,
        important: false,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "",
      },
    ]);

    await renderForm({ item: makeItem({ id: "item-42" }) });

    await openLinkedCalendarCreateViaMenu("expires");

    expect(document.querySelector('[data-testid="user-event-dialog"]')).toBeTruthy();

    const submit = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent === "userEvent.create",
    );
    await act(async () => {
      submit!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createUserEvent).toHaveBeenCalled();
  });
});
