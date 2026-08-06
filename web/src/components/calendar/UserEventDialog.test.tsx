/**
 * Smoke tests for the user-event create/edit dialog.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { UserEventDialog } from "./UserEventDialog";

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function setSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
  setter.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("UserEventDialog", () => {
  let root: Root | null = null;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
  });

  it("renders create title and submits trimmed values with default __user__ workset", async () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "create",
          worksetOptions: [
            { id: "ct-1", name: "日曆任務" },
            { id: "evt-1", name: "事件任務" },
          ],
          onClose,
          onSubmit,
        }),
      );
    });

    // ModalDialog portals into document.body
    expect(document.body.textContent).toContain("新增事件");
    const titleInput = document.body.querySelector(
      'input[aria-label="標題"]',
    ) as HTMLInputElement;
    expect(titleInput).toBeTruthy();

    const taskSelect = document.body.querySelector(
      '[data-testid="user-event-workset-select"]',
    ) as HTMLSelectElement;
    expect(taskSelect).toBeTruthy();
    expect(taskSelect.value).toBe(SYSTEM_WORKSET_ID);

    await act(async () => {
      setInputValue(titleInput, "  測試  ");
    });

    const startInput = document.body.querySelector(
      '[data-testid="user-event-start"]',
    ) as HTMLInputElement | null;
    if (startInput) {
      await act(async () => {
        setInputValue(startInput, "2026-07-21T09:00");
      });
    }

    const buttons = Array.from(document.body.querySelectorAll("button"));
    const submit = buttons.find((b) => b.textContent === "新增");
    expect(submit).toBeTruthy();
    await act(async () => {
      submit!.click();
    });

    expect(onSubmit).toHaveBeenCalled();
    const arg = onSubmit.mock.calls[0][0];
    expect(arg.kind).toBe("one_off");
    expect(arg.title).toBe("測試");
    expect(arg.startTime).toBeTruthy();
    expect(arg.worksetId).toBe(SYSTEM_WORKSET_ID);
    expect(arg.isAllDay).toBe(false);
    expect(arg.taskId).toBeUndefined();

    host.remove();
  });

  it("preserves datetime across one_off ↔ recurring kind switches", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "create",
          onClose: vi.fn(),
          onSubmit: vi.fn(),
        }),
      );
    });

    const startInput = document.body.querySelector(
      '[data-testid="user-event-start"]',
    ) as HTMLInputElement;
    const endInput = document.body.querySelector(
      '[data-testid="user-event-end"]',
    ) as HTMLInputElement;
    await act(async () => {
      setInputValue(startInput, "2026-08-15T14:30");
      setInputValue(endInput, "2026-08-15T16:00");
    });

    const tabs = Array.from(
      document.body.querySelectorAll('[data-testid="user-event-kind-tabs"] [role="tab"]'),
    ) as HTMLButtonElement[];
    const recurringTab = tabs.find((tab) => tab.textContent?.includes("週期"));
    const oneOffTab = tabs.find((tab) => tab.textContent?.includes("一般"));
    expect(recurringTab).toBeTruthy();
    expect(oneOffTab).toBeTruthy();

    await act(async () => {
      recurringTab!.click();
    });

    const startClock = document.body.querySelector(
      '[data-testid="user-event-event-start"]',
    ) as HTMLInputElement;
    const endClock = document.body.querySelector(
      '[data-testid="user-event-event-end"]',
    ) as HTMLInputElement;
    expect(startClock.value).toBe("14:30");
    expect(endClock.value).toBe("16:00");

    await act(async () => {
      setInputValue(startClock, "15:00");
      setInputValue(endClock, "17:30");
    });

    await act(async () => {
      oneOffTab!.click();
    });

    const startAfter = document.body.querySelector(
      '[data-testid="user-event-start"]',
    ) as HTMLInputElement;
    const endAfter = document.body.querySelector(
      '[data-testid="user-event-end"]',
    ) as HTMLInputElement;
    expect(startAfter.value).toBe("2026-08-15T15:00");
    expect(endAfter.value).toBe("2026-08-15T17:30");

    host.remove();
  });

  it("shows overnight hint when recurring end is before start", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "create",
          onClose: vi.fn(),
          onSubmit: vi.fn(),
        }),
      );
    });

    const tabs = Array.from(
      document.body.querySelectorAll('[data-testid="user-event-kind-tabs"] [role="tab"]'),
    ) as HTMLButtonElement[];
    const recurringTab = tabs.find((tab) => tab.textContent?.includes("週期"));
    await act(async () => {
      recurringTab!.click();
    });

    expect(document.body.querySelector('[data-testid="user-event-overnight-hint"]')).toBeNull();

    const startClock = document.body.querySelector(
      '[data-testid="user-event-event-start"]',
    ) as HTMLInputElement;
    const endClock = document.body.querySelector(
      '[data-testid="user-event-event-end"]',
    ) as HTMLInputElement;
    await act(async () => {
      setInputValue(startClock, "22:00");
      setInputValue(endClock, "06:00");
    });

    const hint = document.body.querySelector(
      '[data-testid="user-event-overnight-hint"]',
    );
    expect(hint).toBeTruthy();
    expect(hint?.textContent).toContain("翌日");

    host.remove();
  });

  it("switches to recurring and submits RRULE + clock fields", async () => {
    const onSubmit = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "create",
          onClose: vi.fn(),
          onSubmit,
        }),
      );
    });

    expect(document.body.querySelector('[data-testid="user-event-kind-tabs"]')).toBeTruthy();
    const tabs = Array.from(
      document.body.querySelectorAll('[data-testid="user-event-kind-tabs"] [role="tab"]'),
    ) as HTMLButtonElement[];
    const recurringTab = tabs.find((tab) => tab.textContent?.includes("週期"));
    expect(recurringTab).toBeTruthy();
    await act(async () => {
      recurringTab!.click();
    });

    expect(document.body.querySelector('[data-testid="user-event-recurrence"]')).toBeTruthy();
    expect(document.body.querySelector('[data-testid="user-event-days-1"]')).toBeNull();

    const titleInput = document.body.querySelector(
      'input[aria-label="標題"]',
    ) as HTMLInputElement;
    await act(async () => {
      setInputValue(titleInput, "週會");
    });

    const startClock = document.body.querySelector(
      '[data-testid="user-event-event-start"]',
    ) as HTMLInputElement;
    expect(startClock).toBeTruthy();
    await act(async () => {
      setInputValue(startClock, "09:30");
    });

    const buttons = Array.from(document.body.querySelectorAll("button"));
    const submit = buttons.find((b) => b.textContent === "新增");
    await act(async () => {
      submit!.click();
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "recurring",
        title: "週會",
        isAllDay: false,
        eventStartTime: "09:30",
        rrule: expect.stringContaining("FREQ="),
      }),
    );

    host.remove();
  });

  it("hides kind switch in edit mode", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "edit",
          initial: {
            title: "既有",
            startTime: "2026-07-20T10:00:00.000Z",
            worksetId: SYSTEM_WORKSET_ID,
            isAllDay: false,
          },
          onClose: vi.fn(),
          onSubmit: vi.fn(),
        }),
      );
    });

    expect(document.body.querySelector('[data-testid="user-event-kind-tabs"]')).toBeNull();
    host.remove();
  });

  it("keeps typed start time when parent re-renders with a fresh initial object", async () => {
    const onSubmit = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "create",
          initial: { worksetId: SYSTEM_WORKSET_ID, isAllDay: false },
          onClose: vi.fn(),
          onSubmit,
        }),
      );
    });

    const startInput = document.body.querySelector(
      '[data-testid="user-event-start"]',
    ) as HTMLInputElement;
    expect(startInput).toBeTruthy();

    await act(async () => {
      setInputValue(startInput, "2026-08-01T14:30");
    });
    expect(startInput.value).toBe("2026-08-01T14:30");

    // Same field values, new object identity (TimelinePage pattern).
    await act(async () => {
      root!.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "create",
          initial: { worksetId: SYSTEM_WORKSET_ID, isAllDay: false },
          onClose: vi.fn(),
          onSubmit,
        }),
      );
    });

    const startAfter = document.body.querySelector(
      '[data-testid="user-event-start"]',
    ) as HTMLInputElement;
    expect(startAfter.value).toBe("2026-08-01T14:30");

    host.remove();
  });

  it("interpolates day-preset labels and applies 00:00–23:59 range", async () => {
    const onSubmit = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "create",
          initial: {
            title: "行程",
            startTime: "2026-08-01T10:00:00.000Z",
            endTime: "",
            worksetId: SYSTEM_WORKSET_ID,
            isAllDay: false,
          },
          onClose: vi.fn(),
          onSubmit,
        }),
      );
    });

    const threeDay = document.body.querySelector(
      '[data-testid="user-event-days-3"]',
    ) as HTMLButtonElement;
    expect(threeDay).toBeTruthy();
    expect(threeDay.textContent).toBe("3 天");
    expect(threeDay.textContent).not.toContain("{{count}}");
    expect(document.body.textContent).toContain("1 天");
    await act(async () => {
      threeDay.click();
    });

    const startInput = document.body.querySelector(
      '[data-testid="user-event-start"]',
    ) as HTMLInputElement;
    const endInput = document.body.querySelector(
      '[data-testid="user-event-end"]',
    ) as HTMLInputElement;
    expect(startInput.value.endsWith("T00:00")).toBe(true);
    expect(endInput.value.endsWith("T23:59")).toBe(true);

    await act(async () => {
      setInputValue(endInput, endInput.value.slice(0, 11) + "18:00");
    });

    const buttons = Array.from(document.body.querySelectorAll("button"));
    const submit = buttons.find((b) => b.textContent === "新增");
    await act(async () => {
      submit!.click();
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "行程",
        isAllDay: false,
      }),
    );
    expect(onSubmit.mock.calls[0][0].endTime).toBeTruthy();

    host.remove();
  });

  it("submits all-day ranges with exclusive wire end and isAllDay", async () => {
    const onSubmit = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "create",
          onClose: vi.fn(),
          onSubmit,
        }),
      );
    });

    const titleInput = document.body.querySelector(
      'input[aria-label="標題"]',
    ) as HTMLInputElement;
    await act(async () => {
      setInputValue(titleInput, "休假");
    });

    const allDay = document.body.querySelector(
      '[data-testid="user-event-all-day"]',
    ) as HTMLInputElement;
    await act(async () => {
      allDay.click();
    });

    const startInput = document.body.querySelector(
      '[data-testid="user-event-start"]',
    ) as HTMLInputElement;
    expect(startInput.type).toBe("date");
    await act(async () => {
      setInputValue(startInput, "2026-08-01");
    });

    const threeDay = document.body.querySelector(
      '[data-testid="user-event-days-3"]',
    ) as HTMLButtonElement;
    await act(async () => {
      threeDay.click();
    });

    const endInput = document.body.querySelector(
      '[data-testid="user-event-end"]',
    ) as HTMLInputElement;
    expect(endInput.value).toBe("2026-08-03");

    const buttons = Array.from(document.body.querySelectorAll("button"));
    const submit = buttons.find((b) => b.textContent === "新增");
    await act(async () => {
      submit!.click();
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "休假",
        isAllDay: true,
        startTime: "2026-08-01T00:00:00.000Z",
        endTime: "2026-08-04T00:00:00.000Z",
      }),
    );

    host.remove();
  });

  it("prefills worksetId on edit and submits the selected workset", async () => {
    const onSubmit = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "edit",
          worksetOptions: [{ id: "ws-1", name: "工作集" }],
          initial: {
            title: "既有",
            startTime: "2026-07-20T10:00:00.000Z",
            endTime: "",
            location: "",
            body: "",
            worksetId: "ws-1",
            isAllDay: false,
          },
          onClose: vi.fn(),
          onSubmit,
        }),
      );
    });

    const taskSelect = document.body.querySelector(
      '[data-testid="user-event-workset-select"]',
    ) as HTMLSelectElement;
    expect(taskSelect.value).toBe("ws-1");

    await act(async () => {
      setSelectValue(taskSelect, SYSTEM_WORKSET_ID);
    });

    const buttons = Array.from(document.body.querySelectorAll("button"));
    const submit = buttons.find((b) => b.textContent === "儲存");
    expect(submit).toBeTruthy();
    await act(async () => {
      submit!.click();
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "既有",
        worksetId: SYSTEM_WORKSET_ID,
        isAllDay: false,
      }),
    );
    expect(onSubmit.mock.calls[0][0].taskId).toBeUndefined();

    host.remove();
  });

  it("hides parent-item picker by default on generic create", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "create",
          onClose: vi.fn(),
          onSubmit: vi.fn(),
        }),
      );
    });

    expect(document.querySelector('[data-testid="user-event-item-select"]')).toBeNull();
    expect(document.querySelector('[data-testid="user-event-parent-item"]')).toBeNull();
    expect(document.querySelector('[data-testid="user-event-parent-item-readonly"]')).toBeNull();

    host.remove();
  });

  it("shows read-only parent item when mode is readonly with itemId", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "create",
          parentItemMode: "readonly",
          initial: { itemId: "item-9" },
          onClose: vi.fn(),
          onSubmit: vi.fn(),
        }),
      );
    });

    const readonly = document.querySelector(
      '[data-testid="user-event-parent-item-readonly"]',
    );
    expect(readonly).toBeTruthy();
    expect(readonly!.textContent).toContain("item-9");
    expect(document.querySelector('[data-testid="user-event-item-select"]')).toBeNull();

    host.remove();
  });
});
