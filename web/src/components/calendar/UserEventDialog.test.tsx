/**
 * Smoke tests for the user-event create/edit dialog.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { USER_EVENTS_FILTER_ID } from "../../domain/timeline/userEvents";
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
          taskOptions: [
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
      '[data-testid="user-event-task-select"]',
    ) as HTMLSelectElement;
    expect(taskSelect).toBeTruthy();
    expect(taskSelect.value).toBe(USER_EVENTS_FILTER_ID);

    await act(async () => {
      setInputValue(titleInput, "  測試  ");
    });

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
    expect(arg.taskId).toBe(USER_EVENTS_FILTER_ID);

    host.remove();
  });

  it("prefills taskId on edit and submits the selected task", async () => {
    const onSubmit = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "edit",
          taskOptions: [{ id: "ct-1", name: "日曆任務" }],
          initial: {
            title: "既有",
            startTime: "2026-07-20T10:00:00.000Z",
            endTime: "",
            location: "",
            body: "",
            taskId: "ct-1",
          },
          onClose: vi.fn(),
          onSubmit,
        }),
      );
    });

    const taskSelect = document.body.querySelector(
      '[data-testid="user-event-task-select"]',
    ) as HTMLSelectElement;
    expect(taskSelect.value).toBe("ct-1");

    await act(async () => {
      setSelectValue(taskSelect, USER_EVENTS_FILTER_ID);
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
        taskId: USER_EVENTS_FILTER_ID,
      }),
    );

    host.remove();
  });
});
