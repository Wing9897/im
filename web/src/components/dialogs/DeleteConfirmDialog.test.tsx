import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

const baseProps = {
  open: true,
  targetName: "Test Task",
  onConfirm: vi.fn(async () => {}),
  onCancel: vi.fn(),
  deleting: false,
};

describe("DeleteConfirmDialog", () => {
  let mount: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mount = document.createElement("div");
    document.body.appendChild(mount);
    root = createRoot(mount);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    mount.remove();
  });

  function renderDialog(props: Partial<typeof baseProps> = {}) {
    act(() => {
      root.render(createElement(DeleteConfirmDialog, { ...baseProps, ...props }));
    });
  }

  function dialogRoot() {
    return document.body.querySelector('[role="alertdialog"]') as HTMLElement | null;
  }

  it("returns null when not open", () => {
    renderDialog({ open: false });
    expect(dialogRoot()).toBeNull();
  });

  it("renders dialog with target name when open", () => {
    renderDialog();
    expect(dialogRoot()?.textContent).toContain("Test Task");
    expect(dialogRoot()?.textContent).toContain("確認刪除任務");
  });

  it("renders cancel and confirm buttons", () => {
    renderDialog();
    const buttons = dialogRoot()!.querySelectorAll("button");
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toBe("取消");
    expect(buttons[1].textContent).toBe("確認刪除");
  });

  it("calls onCancel when cancel button is clicked", () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });
    act(() => {
      dialogRoot()!.querySelectorAll("button")[0].click();
    });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onConfirm when confirm button is clicked", () => {
    const onConfirm = vi.fn(async () => {});
    renderDialog({ onConfirm });
    act(() => {
      dialogRoot()!.querySelectorAll("button")[1].click();
    });
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("shows deleting state text and disables confirm button", () => {
    renderDialog({ deleting: true });
    const confirmBtn = dialogRoot()!.querySelectorAll("button")[1];
    expect(confirmBtn.textContent).toBe("刪除中…");
    expect(confirmBtn.disabled).toBe(true);
  });

  it("calls onCancel when overlay is clicked", () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });
    const overlay = dialogRoot()!.parentElement as HTMLElement;
    act(() => {
      overlay.click();
    });
    expect(onCancel).toHaveBeenCalled();
  });
});
