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
      'input[aria-label="開始時間"]',
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
    expect(arg.taskId).toBeUndefined();

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
      }),
    );
    expect(onSubmit.mock.calls[0][0].taskId).toBeUndefined();

    host.remove();
  });
});
