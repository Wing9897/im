import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { useRevealScrollbarOnScroll } from "./useRevealScrollbarOnScroll";

function Harness({ containerRef }: { containerRef: HTMLDivElement }) {
  const ref = useRef<HTMLDivElement>(null);
  ref.current = containerRef;
  useRevealScrollbarOnScroll(ref);
  return null;
}

describe("useRevealScrollbarOnScroll", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  it("adds is-scrolling while scrolling and removes it after idle", () => {
    const scrollTarget = document.createElement("div");

    act(() => {
      root.render(createElement(Harness, { containerRef: scrollTarget }));
    });

    act(() => {
      scrollTarget.dispatchEvent(new Event("scroll"));
    });
    expect(scrollTarget.classList.contains("is-scrolling")).toBe(true);

    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(scrollTarget.classList.contains("is-scrolling")).toBe(false);
  });
});
