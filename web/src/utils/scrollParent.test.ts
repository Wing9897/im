import { describe, expect, it } from "vitest";

import {
  getScrollViewportRangeInContainer,
  getVerticalScrollParent,
} from "./scrollParent";

describe("scrollParent", () => {
  it("finds the nearest vertical scroll ancestor", () => {
    const scrollRoot = document.createElement("div");
    scrollRoot.style.overflowY = "auto";
    const child = document.createElement("div");
    const leaf = document.createElement("div");
    child.appendChild(leaf);
    scrollRoot.appendChild(child);
    document.body.appendChild(scrollRoot);

    expect(getVerticalScrollParent(leaf)).toBe(scrollRoot);

    scrollRoot.remove();
  });

  it("treats a scrollable node as its own scroll parent", () => {
    const scrollRoot = document.createElement("div");
    scrollRoot.style.overflowY = "auto";
    document.body.appendChild(scrollRoot);

    expect(getVerticalScrollParent(scrollRoot)).toBe(scrollRoot);

    scrollRoot.remove();
  });

  it("uses scrollTop when the container itself scrolls", () => {
    const scrollRoot = document.createElement("div");
    scrollRoot.style.overflowY = "auto";
    Object.defineProperty(scrollRoot, "scrollTop", { value: 120, configurable: true });
    Object.defineProperty(scrollRoot, "clientHeight", { value: 400, configurable: true });
    document.body.appendChild(scrollRoot);

    const range = getScrollViewportRangeInContainer(scrollRoot, 40);
    expect(range.visibleTop).toBe(80);
    expect(range.visibleBottom).toBe(560);

    scrollRoot.remove();
  });

  it("maps scroll viewport offsets inside a container", () => {
    const scrollRoot = document.createElement("div");
    scrollRoot.style.overflowY = "auto";
    const list = document.createElement("div");
    scrollRoot.appendChild(list);
    document.body.appendChild(scrollRoot);

    list.getBoundingClientRect = () =>
      ({
        top: 80,
        bottom: 800,
        left: 0,
        right: 600,
        width: 600,
        height: 720,
        x: 0,
        y: 80,
        toJSON: () => ({}),
      }) as DOMRect;
    scrollRoot.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 500,
        left: 0,
        right: 600,
        width: 600,
        height: 500,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    const range = getScrollViewportRangeInContainer(list, 40);
    expect(range.visibleTop).toBe(0);
    expect(range.visibleBottom).toBeGreaterThan(400);

    scrollRoot.remove();
  });
});
