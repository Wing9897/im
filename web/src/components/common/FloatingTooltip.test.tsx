import { act, createElement, createRef } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, afterEach } from "vitest";
import { zIndex } from "../../styles/tokens";
import { FloatingTooltip } from "./FloatingTooltip";

describe("FloatingTooltip", () => {
  let container: HTMLDivElement;

  afterEach(() => {
    container?.remove();
    document.querySelectorAll('[data-testid="ft-test"]').forEach((n) => n.remove());
    document.querySelectorAll('[data-testid="ft-closed"]').forEach((n) => n.remove());
  });

  it("portals into document.body when open", async () => {
    const anchor = document.createElement("button");
    document.body.appendChild(anchor);
    const ref = createRef<HTMLButtonElement>();
    Object.assign(ref, { current: anchor });

    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(
          "div",
          { "data-testid": "clip-parent", className: "overflow-hidden" },
          createElement(
            FloatingTooltip,
            { open: true, anchorRef: ref, testId: "ft-test" },
            "Hello tip",
          ),
        ),
      );
    });

    const tip = document.querySelector('[data-testid="ft-test"]') as HTMLElement;
    expect(tip).not.toBeNull();
    expect(tip.textContent).toContain("Hello tip");
    expect(tip.parentElement).toBe(document.body);
    expect(tip.style.position).toBe("fixed");
    expect(tip.style.zIndex).toBe(String(zIndex.tooltip));

    await act(async () => {
      root.unmount();
    });
    anchor.remove();
  });

  it("renders nothing when closed", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(
          FloatingTooltip,
          { open: false, anchorEl: null, testId: "ft-closed" },
          "Hidden",
        ),
      );
    });

    expect(document.querySelector('[data-testid="ft-closed"]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });
});
