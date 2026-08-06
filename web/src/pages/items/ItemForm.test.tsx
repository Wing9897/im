import { act, createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "./emojiPickerReactMock";

import type { ItemCategory, TrackableItem } from "../../api/items";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { ItemForm, type ItemFormHandle } from "./ItemForm";

const showToast = vi.fn();
const listUserEvents = vi.fn(async () => [] as unknown[]);
const listTasks = vi.fn(async () => [] as unknown[]);
const updateUserEvent = vi.fn(async () => ({}));
const createUserEvent = vi.fn(async () => ({}));
const listItems = vi.fn(async () => [] as unknown[]);

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../api/userEvents", () => ({
  listUserEvents: (...args: unknown[]) => listUserEvents(...args),
  createUserEvent: (...args: unknown[]) => createUserEvent(...args),
  updateUserEvent: (...args: unknown[]) => updateUserEvent(...args),
}));

vi.mock("../../api/items", async () => {
  const actual = await vi.importActual<typeof import("../../api/items")>("../../api/items");
  return {
    ...actual,
    listItems: (...args: unknown[]) => listItems(...args),
  };
});

vi.mock("../../api/tasks", () => ({
  listTasks: (...args: unknown[]) => listTasks(...args),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const CATEGORIES: ItemCategory[] = [
  {
    id: "seed_passport_docs",
    name: "證件",
    slug: "passport_docs",
    sortOrder: 10,
    color: "#3B82F6",
    emoji: "🪪",
    fieldSchema: [
      { key: "id_number", label: "證件號碼" },
      { key: "issuer", label: "簽發機關" },
    ],
    defaultRemindBeforeDays: 90,
    createdAt: null,
    updatedAt: null,
  },
  {
    id: "seed_food",
    name: "食物",
    slug: "food",
    sortOrder: 20,
    color: "#22C55E",
    emoji: "🍎",
    fieldSchema: [
      { key: "brand", label: "品牌" },
      { key: "storage", label: "保存方式" },
    ],
    defaultRemindBeforeDays: 3,
    createdAt: null,
    updatedAt: null,
  },
];

const WORKSETS = [
  {
    id: SYSTEM_WORKSET_ID,
    name: "General",
    isSystem: true,
    createdAt: "",
    updatedAt: "",
  },
];

function makeItem(partial: Partial<TrackableItem> = {}): TrackableItem {
  return {
    id: "item-1",
    title: "Passport",
    worksetId: SYSTEM_WORKSET_ID,
    categoryId: "seed_passport_docs",
    purchasedAt: null,
    expiresAt: "2030-01-01",
    remindBeforeDays: 14,
    notes: "",
    status: "active",
    emoji: null,
    attributes: { id_number: "A123456", custom_tag: "keep-me" },
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

describe("ItemForm", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    showToast.mockReset();
    listUserEvents.mockReset();
    listUserEvents.mockResolvedValue([]);
    listTasks.mockReset();
    listTasks.mockResolvedValue([]);
    updateUserEvent.mockReset();
    updateUserEvent.mockResolvedValue({});
    createUserEvent.mockReset();
    createUserEvent.mockResolvedValue({});
    listItems.mockReset();
    listItems.mockResolvedValue([
      {
        id: "item-42",
        title: "Passport",
        worksetId: SYSTEM_WORKSET_ID,
        categoryId: null,
        purchasedAt: null,
        expiresAt: null,
        remindBeforeDays: null,
        notes: "",
        status: "active",
        emoji: null,
        attributes: {},
        createdAt: null,
        updatedAt: null,
      },
    ]);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.querySelectorAll('[role="dialog"]').forEach((node) => node.remove());
  });

  async function renderForm(opts?: {
    item?: TrackableItem | null;
    initialCategoryId?: string | null;
    onSave?: (draft: unknown) => Promise<void>;
  }) {
    const onSave = opts?.onSave ?? vi.fn(async () => undefined);
    const formRef = createRef<ItemFormHandle>();
    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(ItemForm, {
            ref: formRef,
            item: opts?.item === undefined ? makeItem() : opts.item,
            categories: CATEGORIES,
            worksets: WORKSETS,
            categoryLabel: (category) => category?.name ?? "none",
            initialCategoryId: opts?.initialCategoryId ?? null,
            onSave,
          }),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    return { onSave, formRef };
  }

  function categorySelect(): HTMLSelectElement {
    const el = document.getElementById("item-category") as HTMLSelectElement | null;
    expect(el).toBeTruthy();
    return el!;
  }

  it("does not render item-level purchase/expiry/remind date fields", async () => {
    await renderForm();
    expect(document.getElementById("item-purchased")).toBeNull();
    expect(document.getElementById("item-expires")).toBeNull();
    expect(document.getElementById("item-remind")).toBeNull();
    expect(document.querySelector('[aria-label="sectionDates"]')).toBeNull();
  });

  it("uses compact emoji trigger (not free-text) and submits selection", async () => {
    const onSave = vi.fn(async () => undefined);
    const { formRef } = await renderForm({
      item: makeItem({ emoji: null }),
      onSave,
    });

    expect(document.querySelector("input#item-emoji")).toBeNull();
    expect(document.querySelector('[data-testid="emoji-picker-field"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="emoji-picker-grid"]')).toBeNull();

    const trigger = document.querySelector(
      '[data-testid="emoji-picker-trigger"]',
    ) as HTMLButtonElement;
    expect(trigger).toBeTruthy();

    await act(async () => {
      trigger.click();
    });

    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    });

    const apple = document.querySelector(
      '[data-testid="emoji-option-🍎"]',
    ) as HTMLButtonElement;
    expect(apple).toBeTruthy();

    await act(async () => {
      apple.click();
    });

    await act(async () => {
      await formRef.current?.submit();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        emoji: "🍎",
      }),
    );
  });

  it("clears emoji via picker clear control", async () => {
    const onSave = vi.fn(async () => undefined);
    const { formRef } = await renderForm({
      item: makeItem({ emoji: "🍎" }),
      onSave,
    });

    const clear = document.querySelector(
      '[data-testid="emoji-picker-clear"]',
    ) as HTMLButtonElement;
    expect(clear).toBeTruthy();

    await act(async () => {
      clear.click();
    });

    await act(async () => {
      await formRef.current?.submit();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        emoji: null,
      }),
    );
  });

  it("keeps attributes when switching category (extras move to other)", async () => {
    await renderForm();

    expect(
      (document.getElementById("item-attr-id_number") as HTMLInputElement).value,
    ).toBe("A123456");
    expect(
      (document.getElementById("item-other-custom_tag") as HTMLInputElement).value,
    ).toBe("keep-me");

    act(() => {
      const select = categorySelect();
      select.value = "seed_food";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(document.getElementById("item-attr-id_number")).toBeNull();
    expect(
      (document.getElementById("item-other-id_number") as HTMLInputElement).value,
    ).toBe("A123456");
    expect(
      (document.getElementById("item-other-custom_tag") as HTMLInputElement).value,
    ).toBe("keep-me");
    expect(document.getElementById("item-attr-brand")).toBeTruthy();
    expect(document.getElementById("item-attr-storage")).toBeTruthy();
  });

  it("submits core fields without purchasedAt/expiresAt/remindBeforeDays", async () => {
    const onSave = vi.fn(async () => undefined);
    const { formRef } = await renderForm({ onSave });

    act(() => {
      const select = categorySelect();
      select.value = "seed_food";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      await formRef.current?.submit();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: "seed_food",
        attributes: { id_number: "A123456", custom_tag: "keep-me" },
      }),
    );
    const draft = onSave.mock.calls[0][0] as Record<string, unknown>;
    expect(draft).not.toHaveProperty("purchasedAt");
    expect(draft).not.toHaveProperty("expiresAt");
    expect(draft).not.toHaveProperty("remindBeforeDays");
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
        webSearchQuery: "",
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
    expect(document.body.textContent).toContain("Passport renew");
    expect(document.body.textContent).toContain("Weekly check");
    expect(
      document.querySelector('[data-testid="item-linked-calendar-badge-one-off"]'),
    ).toBeTruthy();
    expect(
      document.querySelector('[data-testid="item-linked-calendar-badge-recurring"]'),
    ).toBeTruthy();

    const addCal = document.querySelector(
      '[data-testid="item-form-add-linked-calendar"]',
    ) as HTMLButtonElement | null;
    expect(addCal).toBeTruthy();
    expect(addCal!.textContent).toBe("addLinkedCalendar");

    await act(async () => {
      addCal!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const eventDialog = document.querySelector('[data-testid="user-event-dialog"]');
    expect(eventDialog).toBeTruthy();
    expect(document.querySelector('[data-testid="user-event-item-select"]')).toBeNull();
    expect(document.querySelector('[data-testid="user-event-parent-item-readonly"]')).toBeTruthy();
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

    expect(document.querySelector('[data-testid="user-event-dialog"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="user-event-parent-item-readonly"]')).toBeTruthy();
    const titleInput = document.querySelector(
      '[data-testid="user-event-dialog"] input[aria-label="userEvent.titleAria"]',
    ) as HTMLInputElement | null;
    expect(titleInput?.value).toBe("Passport renew");
  });

  it("hides linked-calendars section when creating a new item", async () => {
    await renderForm({ item: null });
    expect(document.querySelector('[data-testid="item-form-linked-calendars"]')).toBeNull();
    expect(document.querySelector('[data-testid="item-form-add-linked-calendar"]')).toBeNull();
  });

  it("opens create dialog with title + timed defaults for quick Start / Purchased", async () => {
    await renderForm({ item: makeItem({ id: "item-42" }) });

    const startChip = document.querySelector(
      '[data-testid="item-form-quick-linked-calendar-start"]',
    ) as HTMLButtonElement | null;
    expect(startChip).toBeTruthy();

    await act(async () => {
      startChip!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const dialog = document.querySelector('[data-testid="user-event-dialog"]');
    expect(dialog).toBeTruthy();
    const titleInput = document.querySelector(
      '[data-testid="user-event-dialog"] input[aria-label="userEvent.titleAria"]',
    ) as HTMLInputElement | null;
    expect(titleInput?.value).toBe("quickLinkedCalendar.start");
    const allDay = document.querySelector(
      '[data-testid="user-event-all-day"]',
    ) as HTMLInputElement | null;
    expect(allDay?.checked).toBe(false);
    const startInput = document.querySelector(
      '[data-testid="user-event-start"]',
    ) as HTMLInputElement | null;
    expect(startInput?.type).toBe("datetime-local");
  });

  it("opens create dialog with title + all-day for quick Expires", async () => {
    await renderForm({ item: makeItem({ id: "item-42" }) });

    const expiresChip = document.querySelector(
      '[data-testid="item-form-quick-linked-calendar-expires"]',
    ) as HTMLButtonElement | null;
    expect(expiresChip).toBeTruthy();

    await act(async () => {
      expiresChip!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const titleInput = document.querySelector(
      '[data-testid="user-event-dialog"] input[aria-label="userEvent.titleAria"]',
    ) as HTMLInputElement | null;
    expect(titleInput?.value).toBe("quickLinkedCalendar.expires");
    const allDay = document.querySelector(
      '[data-testid="user-event-all-day"]',
    ) as HTMLInputElement | null;
    expect(allDay?.checked).toBe(true);
    const startInput = document.querySelector(
      '[data-testid="user-event-start"]',
    ) as HTMLInputElement | null;
    expect(startInput?.type).toBe("date");
    expect(startInput?.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
