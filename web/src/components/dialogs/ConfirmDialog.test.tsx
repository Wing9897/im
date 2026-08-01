import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ConfirmDialog } from "./ConfirmDialog";

const baseProps = {
  title: "Confirm Reset",
  accentColor: "#f38ba8",
  body: "Are you sure you want to reset?",
  confirmLabel: "Reset",
  confirmBusyLabel: "Resetting…",
  onCancel: vi.fn(),
  onConfirm: vi.fn(async () => {}),
};

describe("ConfirmDialog", () => {
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
      root.render(createElement(ConfirmDialog, { ...baseProps, ...props }));
    });
  }

  function dialogRoot() {
    return document.body.querySelector('[role="alertdialog"]') as HTMLElement;
  }

  it("renders title and body text", () => {
    renderDialog();
    expect(dialogRoot().textContent).toContain("Confirm Reset");
    expect(dialogRoot().textContent).toContain("Are you sure you want to reset?");
  });

  it("renders cancel and confirm buttons", () => {
    renderDialog();
    const buttons = dialogRoot().querySelectorAll("button");
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toBe("取消");
    expect(buttons[1].textContent).toBe("Reset");
  });

  it("calls onCancel when cancel button is clicked", () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });
    act(() => {
      dialogRoot().querySelectorAll("button")[0].click();
    });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onConfirm when confirm button is clicked", () => {
    const onConfirm = vi.fn(async () => {});
    renderDialog({ onConfirm });
    act(() => {
      dialogRoot().querySelectorAll("button")[1].click();
    });
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("shows busy label and disables both buttons when busy", () => {
    renderDialog({ busy: true });
    const buttons = dialogRoot().querySelectorAll("button");
    expect(buttons[1].textContent).toBe("Resetting…");
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(true);
  });

  it("shows normal label and enabled buttons when not busy", () => {
    renderDialog({ busy: false });
    const buttons = dialogRoot().querySelectorAll("button");
    expect(buttons[1].textContent).toBe("Reset");
    expect(buttons[0].disabled).toBe(false);
    expect(buttons[1].disabled).toBe(false);
  });

  it("calls onCancel when overlay is clicked", () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });
    const overlay = dialogRoot().parentElement as HTMLElement;
    act(() => {
      overlay.click();
    });
    expect(onCancel).toHaveBeenCalled();
  });

  it("renders body as ReactNode", () => {
    renderDialog({
      body: createElement("strong", null, "Important warning"),
    });
    const strong = dialogRoot().querySelector("strong");
    expect(strong).not.toBeNull();
    expect(strong!.textContent).toBe("Important warning");
  });
});
