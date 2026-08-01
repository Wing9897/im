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

  it("renders create title and submits trimmed values with default __user__ task", async () => {
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
    expect(arg.title).toBe("測試");
    expect(arg.startTime).toBeTruthy();
    expect(arg.worksetId).toBe(SYSTEM_WORKSET_ID);
    expect(arg.isAllDay).toBe(false);
    expect(arg.taskId).toBeUndefined();

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
});
