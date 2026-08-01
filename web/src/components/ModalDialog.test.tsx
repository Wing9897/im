import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ModalDialog } from "./ModalDialog";

describe("ModalDialog", () => {
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

  it("portals the overlay to document.body when open", () => {
    act(() => {
      root.render(
        createElement(
          ModalDialog,
          {
            open: true,
            title: "Test Dialog",
            onClose: vi.fn(),
            testId: "test-modal-dialog",
            footer: createElement("button", { type: "button" }, "OK"),
          },
          createElement("p", null, "Dialog body"),
        ),
      );
    });

    expect(mount.querySelector('[data-testid="test-modal-dialog"]')).toBeNull();
    expect(document.body.querySelector('[data-testid="test-modal-dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Test Dialog");
    expect(document.body.textContent).toContain("Dialog body");
  });

  it("renders nothing when closed", () => {
    act(() => {
      root.render(
        createElement(
          ModalDialog,
          {
            open: false,
            title: "Hidden Dialog",
            onClose: vi.fn(),
            testId: "hidden-modal-dialog",
            footer: null,
          },
          createElement("p", null, "Should not appear"),
        ),
      );
    });

    expect(document.body.querySelector('[data-testid="hidden-modal-dialog"]')).toBeNull();
  });

  it("omits body padding when bodyPadding is none", () => {
    act(() => {
      root.render(
        createElement(
          ModalDialog,
          {
            open: true,
            title: "No Pad",
            onClose: vi.fn(),
            testId: "no-pad-modal",
            bodyPadding: "none",
            footer: createElement("button", { type: "button" }, "OK"),
          },
          createElement("p", null, "Bleed"),
        ),
      );
    });

    const dialog = document.body.querySelector('[data-testid="no-pad-modal"]')!;
    const body = dialog.querySelector('[role="dialog"]')?.children[1] as HTMLElement;
    expect(body.className).not.toContain("px-lg");
    expect(body.className).not.toContain("py-md");
  });
});
