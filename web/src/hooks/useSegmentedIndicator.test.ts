import { act, createElement, useLayoutEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useSegmentedIndicator } from "./useSegmentedIndicator";

function mockRect(element: Partial<DOMRect>): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
    ...element,
  } as DOMRect;
}

function IndicatorHarness({ activeIndex }: { activeIndex: number }) {
  const { trackRef, setTabRef, indicatorStyle } = useSegmentedIndicator(activeIndex);
  const tab0Ref = useRef<HTMLButtonElement | null>(null);
  const tab1Ref = useRef<HTMLButtonElement | null>(null);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (track) {
      track.getBoundingClientRect = () => mockRect({ left: 100, width: 300 });
    }
    if (tab0Ref.current) {
      tab0Ref.current.getBoundingClientRect = () => mockRect({ left: 100, width: 120 });
    }
    if (tab1Ref.current) {
      tab1Ref.current.getBoundingClientRect = () => mockRect({ left: 220, width: 80 });
    }
  });

  return createElement(
    "div",
    null,
    createElement(
      "div",
      {
        ref: (el: HTMLDivElement | null) => {
          trackRef.current = el;
          if (el) {
            el.getBoundingClientRect = () => mockRect({ left: 100, width: 300 });
          }
        },
      },
      createElement("button", {
        ref: (el: HTMLButtonElement | null) => {
          tab0Ref.current = el;
          setTabRef(0)(el);
          if (el) {
            el.getBoundingClientRect = () => mockRect({ left: 100, width: 120 });
          }
        },
      }),
      createElement("button", {
        ref: (el: HTMLButtonElement | null) => {
          tab1Ref.current = el;
          setTabRef(1)(el);
          if (el) {
            el.getBoundingClientRect = () => mockRect({ left: 220, width: 80 });
          }
        },
      }),
    ),
    createElement("output", {
      "data-width": String(indicatorStyle.width ?? 0),
      "data-transform": String(indicatorStyle.transform ?? ""),
    }),
  );
}

describe("useSegmentedIndicator", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("computes indicator width and offset from active tab geometry", async () => {
    const container = document.createElement("div");
    let activeIndex = 0;

    function renderHarness() {
      act(() => {
        createRoot(container).render(createElement(IndicatorHarness, { activeIndex }));
      });
    }

    renderHarness();
    await act(async () => {
      await Promise.resolve();
    });

    let output = container.querySelector("output")!;
    expect(Number(output.getAttribute("data-width"))).toBe(120);
    expect(output.getAttribute("data-transform")).toBe("translateX(0px)");

    activeIndex = 1;
    renderHarness();
    await act(async () => {
      await Promise.resolve();
    });

    output = container.querySelector("output")!;
    expect(Number(output.getAttribute("data-width"))).toBe(80);
    expect(output.getAttribute("data-transform")).toBe("translateX(120px)");
  });
});
