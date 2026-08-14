/**
 * UserEventDialog edit mode, workset, parent item, all-day ranges.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { UserEventDialog } from "./UserEventDialog";
import { pickMenuSelectOption, setInputValue } from "./UserEventDialog.testHarness";

describe("UserEventDialog edit", () => {
  let root: Root | null = null;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
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

    const worksetTrigger = document.body.querySelector(
      '[data-testid="user-event-workset-select-value"]',
    ) as HTMLButtonElement;
    expect(worksetTrigger).toBeTruthy();
    expect(worksetTrigger.textContent).toContain("工作集");

    await pickMenuSelectOption("user-event-workset-select", SYSTEM_WORKSET_ID);

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

  it("hides workset picker when worksetMode is hidden", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "create",
          worksetMode: "hidden",
          worksetOptions: [{ id: "ws-1", name: "工作集" }],
          onClose: vi.fn(),
          onSubmit: vi.fn(),
        }),
      );
    });

    expect(document.querySelector('[data-testid="user-event-workset-select"]')).toBeNull();

    host.remove();
  });
});
