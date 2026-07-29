import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { OverlayPortal } from "./OverlayPortal";

describe("OverlayPortal", () => {
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

  it("renders overlay into document.body", () => {
    act(() => {
      root.render(
        createElement(
          "div",
          { style: { position: "sticky", overflow: "hidden" } },
          createElement(
            OverlayPortal,
            { testId: "test-overlay", onOverlayClick: () => {} },
            createElement("div", null, "Dialog content"),
          ),
        ),
      );
    });

    const overlay = document.body.querySelector('[data-testid="test-overlay"]');
    expect(overlay).not.toBeNull();
    expect(mount.querySelector('[data-testid="test-overlay"]')).toBeNull();
    expect(overlay?.textContent).toContain("Dialog content");
  });

  it("locks body scroll when requested", () => {
    const previousOverflow = document.body.style.overflow;

    act(() => {
      root.render(
        createElement(
          OverlayPortal,
          { lockBodyScroll: true },
          createElement("div", null, "Modal"),
        ),
      );
    });

    expect(document.body.style.overflow).toBe("hidden");

    act(() => {
      root.unmount();
    });

    expect(document.body.style.overflow).toBe(previousOverflow);
  });
});
