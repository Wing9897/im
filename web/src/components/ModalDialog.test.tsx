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

  it("keeps the dialog mounted briefly while exiting", () => {
    const matchMediaSpy = vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as MediaQueryList,
    );
    const onClose = vi.fn();
    try {
      act(() => {
        root.render(
          createElement(
            ModalDialog,
            {
              open: true,
              title: "Exit Dialog",
              onClose,
              testId: "exit-modal-dialog",
              footer: createElement("button", { type: "button" }, "OK"),
            },
            createElement("p", null, "Body"),
          ),
        );
      });

      expect(document.body.querySelector('[data-testid="exit-modal-dialog"]')).not.toBeNull();

      act(() => {
        root.render(
          createElement(
            ModalDialog,
            {
              open: false,
              title: "Exit Dialog",
              onClose,
              testId: "exit-modal-dialog",
              footer: createElement("button", { type: "button" }, "OK"),
            },
            createElement("p", null, "Body"),
          ),
        );
      });

      const overlay = document.body.querySelector(
        '[data-testid="exit-modal-dialog"]',
      ) as HTMLElement | null;
      expect(overlay).not.toBeNull();
      expect(overlay?.className).toContain("im-animate-out");
    } finally {
      matchMediaSpy.mockRestore();
    }
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

  it("keepMounted parks the tree without re-applying enter animation", () => {
    const matchMediaSpy = vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: true,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as MediaQueryList,
    );
    const onClose = vi.fn();
    const onExited = vi.fn();
    try {
      act(() => {
        root.render(
          createElement(
            ModalDialog,
            {
              open: true,
              title: "Keep",
              onClose,
              onExited,
              testId: "keep-mounted-modal",
              keepMounted: true,
              footer: createElement("button", { type: "button" }, "OK"),
            },
            createElement("p", { "data-testid": "keep-body" }, "Warm child"),
          ),
        );
      });

      expect(document.body.querySelector('[data-testid="keep-mounted-modal"]')).not.toBeNull();

      act(() => {
        root.render(
          createElement(
            ModalDialog,
            {
              open: false,
              title: "Keep",
              onClose,
              onExited,
              testId: "keep-mounted-modal",
              keepMounted: true,
              footer: createElement("button", { type: "button" }, "OK"),
            },
            createElement("p", { "data-testid": "keep-body" }, "Warm child"),
          ),
        );
      });

      const overlay = document.body.querySelector(
        '[data-testid="keep-mounted-modal"]',
      ) as HTMLElement | null;
      expect(overlay).not.toBeNull();
      expect(overlay?.hidden).toBe(true);
      expect(overlay?.getAttribute("data-overlay-parked")).toBe("true");
      expect(overlay?.style.display).toBe("none");
      expect(overlay?.className).not.toContain("im-animate-in");
      expect(overlay?.className).not.toContain("im-animate-out");
      expect(document.body.querySelector('[data-testid="keep-body"]')).not.toBeNull();
      expect(onExited).toHaveBeenCalledTimes(1);
    } finally {
      matchMediaSpy.mockRestore();
    }
  });

  it("calls onExited once after unmount when keepMounted is false", () => {
    const matchMediaSpy = vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: true,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as MediaQueryList,
    );
    const onExited = vi.fn();
    try {
      act(() => {
        root.render(
          createElement(
            ModalDialog,
            {
              open: true,
              title: "Exit",
              onClose: vi.fn(),
              onExited,
              testId: "exit-once-modal",
              footer: createElement("button", { type: "button" }, "OK"),
            },
            createElement("p", null, "Body"),
          ),
        );
      });

      act(() => {
        root.render(
          createElement(
            ModalDialog,
            {
              open: false,
              title: "Exit",
              onClose: vi.fn(),
              onExited,
              testId: "exit-once-modal",
              footer: createElement("button", { type: "button" }, "OK"),
            },
            createElement("p", null, "Body"),
          ),
        );
      });

      expect(document.body.querySelector('[data-testid="exit-once-modal"]')).toBeNull();
      expect(onExited).toHaveBeenCalledTimes(1);
    } finally {
      matchMediaSpy.mockRestore();
    }
  });
});
