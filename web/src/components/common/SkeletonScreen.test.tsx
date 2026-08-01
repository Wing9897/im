/**
 * Unit tests for SkeletonScreen component.
 *
 * Validates: Requirements 4.4, 4.6
 *
 * Verifies that SkeletonScreen renders correct number of placeholders per variant,
 * respects prefers-reduced-motion, and maintains accessibility attributes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SkeletonScreen } from "./SkeletonScreen";

/* ------------------------------------------------------------------ */
/*  matchMedia mock helper                                             */
/* ------------------------------------------------------------------ */

function mockMatchMedia(prefersReducedMotion: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];
  const mql = {
    matches: prefersReducedMotion,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: vi.fn((_event: string, handler: (e: MediaQueryListEvent) => void) => {
      listeners.push(handler);
    }),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  };
  window.matchMedia = vi.fn().mockReturnValue(mql);
  return { mql, listeners };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("SkeletonScreen", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    mockMatchMedia(false);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  describe("card-grid variant", () => {
    it("renders default 6 card placeholders", () => {
      act(() => {
        root = createRoot(container);
        root.render(createElement(SkeletonScreen, { variant: "card-grid" }));
      });
      const statusEl = container.querySelector("[role='status']") as HTMLElement;
      const gridContainer = statusEl.querySelector("div") as HTMLElement;
      // Skip the <style> tag — the grid container is the div inside role=status
      const placeholders = gridContainer.querySelectorAll("div");
      expect(placeholders.length).toBe(6);
    });

    it("renders custom count of card placeholders", () => {
      act(() => {
        root = createRoot(container);
        root.render(createElement(SkeletonScreen, { variant: "card-grid", count: 8 }));
      });
      const statusEl = container.querySelector("[role='status']") as HTMLElement;
      const gridContainer = statusEl.querySelector("div") as HTMLElement;
      const placeholders = gridContainer.querySelectorAll("div");
      expect(placeholders.length).toBe(8);
    });

    it("card placeholders have 120px height", () => {
      act(() => {
        root = createRoot(container);
        root.render(createElement(SkeletonScreen, { variant: "card-grid" }));
      });
      const statusEl = container.querySelector("[role='status']") as HTMLElement;
      const gridContainer = statusEl.querySelector("div") as HTMLElement;
      const placeholder = gridContainer.querySelector("div") as HTMLElement;
      expect(placeholder.className).toContain("h-[120px]");
    });

    it("card placeholders have rounded-lg border radius", () => {
      act(() => {
        root = createRoot(container);
        root.render(createElement(SkeletonScreen, { variant: "card-grid" }));
      });
      const statusEl = container.querySelector("[role='status']") as HTMLElement;
      const gridContainer = statusEl.querySelector("div") as HTMLElement;
      const placeholder = gridContainer.querySelector("div") as HTMLElement;
      expect(placeholder.className).toContain("rounded-lg");
    });

    it("uses CSS grid layout with default 4 columns", () => {
      act(() => {
        root = createRoot(container);
        root.render(createElement(SkeletonScreen, { variant: "card-grid" }));
      });
      const statusEl = container.querySelector("[role='status']") as HTMLElement;
      const gridContainer = statusEl.querySelector("div") as HTMLElement;
      expect(gridContainer.className).toContain("grid");
      expect(gridContainer.style.gridTemplateColumns).toBe("repeat(4, minmax(0, 1fr))");
    });
  });

  describe("table-rows variant", () => {
    it("renders default 5 row placeholders", () => {
      act(() => {
        root = createRoot(container);
        root.render(createElement(SkeletonScreen, { variant: "table-rows" }));
      });
      const statusEl = container.querySelector("[role='status']") as HTMLElement;
      const flexContainer = statusEl.querySelector("div") as HTMLElement;
      const placeholders = flexContainer.querySelectorAll("div");
      expect(placeholders.length).toBe(5);
    });

    it("row placeholders have 48px height", () => {
      act(() => {
        root = createRoot(container);
        root.render(createElement(SkeletonScreen, { variant: "table-rows" }));
      });
      const statusEl = container.querySelector("[role='status']") as HTMLElement;
      const flexContainer = statusEl.querySelector("div") as HTMLElement;
      const placeholder = flexContainer.querySelector("div") as HTMLElement;
      expect(placeholder.className).toContain("h-12");
    });

    it("row placeholders have rounded-md border radius", () => {
      act(() => {
        root = createRoot(container);
        root.render(createElement(SkeletonScreen, { variant: "table-rows" }));
      });
      const statusEl = container.querySelector("[role='status']") as HTMLElement;
      const flexContainer = statusEl.querySelector("div") as HTMLElement;
      const placeholder = flexContainer.querySelector("div") as HTMLElement;
      expect(placeholder.className).toContain("rounded-md");
    });

    it("uses flex column layout", () => {
      act(() => {
        root = createRoot(container);
        root.render(createElement(SkeletonScreen, { variant: "table-rows" }));
      });
      const statusEl = container.querySelector("[role='status']") as HTMLElement;
      const flexContainer = statusEl.querySelector("div") as HTMLElement;
      expect(flexContainer.className).toContain("flex");
      expect(flexContainer.className).toContain("flex-col");
    });
  });

  describe("list-rows variant", () => {
    it("renders default 5 row placeholders", () => {
      act(() => {
        root = createRoot(container);
        root.render(createElement(SkeletonScreen, { variant: "list-rows" }));
      });
      const statusEl = container.querySelector("[role='status']") as HTMLElement;
      const flexContainer = statusEl.querySelector("div") as HTMLElement;
      const placeholders = flexContainer.querySelectorAll("div");
      expect(placeholders.length).toBe(5);
    });

    it("respects custom count prop", () => {
      act(() => {
        root = createRoot(container);
        root.render(createElement(SkeletonScreen, { variant: "list-rows", count: 3 }));
      });
      const statusEl = container.querySelector("[role='status']") as HTMLElement;
      const flexContainer = statusEl.querySelector("div") as HTMLElement;
      const placeholders = flexContainer.querySelectorAll("div");
      expect(placeholders.length).toBe(3);
    });
  });

  describe("accessibility", () => {
    it("has role='status' attribute", () => {
      act(() => {
        root = createRoot(container);
        root.render(createElement(SkeletonScreen, { variant: "card-grid" }));
      });
      const statusEl = container.querySelector("[role='status']");
      expect(statusEl).not.toBeNull();
    });

    it("has aria-live='polite' attribute", () => {
      act(() => {
        root = createRoot(container);
        root.render(createElement(SkeletonScreen, { variant: "card-grid" }));
      });
      const statusEl = container.querySelector("[aria-live='polite']");
      expect(statusEl).not.toBeNull();
    });

    it("has aria-label for loading content", () => {
      act(() => {
        root = createRoot(container);
        root.render(createElement(SkeletonScreen, { variant: "card-grid" }));
      });
      const statusEl = container.querySelector("[aria-label='載入內容中']");
      expect(statusEl).not.toBeNull();
    });
  });

  describe("prefers-reduced-motion", () => {
    it("renders shimmer animation when motion is not reduced", () => {
      mockMatchMedia(false);
      act(() => {
        root = createRoot(container);
        root.render(createElement(SkeletonScreen, { variant: "card-grid" }));
      });
      const statusEl = container.querySelector("[role='status']") as HTMLElement;
      const gridContainer = statusEl.querySelector("div") as HTMLElement;
      const placeholder = gridContainer.querySelector("div") as HTMLElement;
      expect(placeholder.className).toContain("im-shimmer");
    });

    it("does not render shimmer animation when motion is reduced", () => {
      mockMatchMedia(true);
      act(() => {
        root = createRoot(container);
        root.render(createElement(SkeletonScreen, { variant: "card-grid" }));
      });
      const statusEl = container.querySelector("[role='status']") as HTMLElement;
      const gridContainer = statusEl.querySelector("div") as HTMLElement;
      const placeholder = gridContainer.querySelector("div") as HTMLElement;
      expect(placeholder.className).toContain("motion-reduce:animate-none");
    });

    it("uses static background when motion is reduced", () => {
      mockMatchMedia(true);
      act(() => {
        root = createRoot(container);
        root.render(createElement(SkeletonScreen, { variant: "card-grid" }));
      });
      const statusEl = container.querySelector("[role='status']") as HTMLElement;
      const gridContainer = statusEl.querySelector("div") as HTMLElement;
      const placeholder = gridContainer.querySelector("div") as HTMLElement;
      expect(placeholder.className).toContain(
        "motion-reduce:bg-[color-mix(in_srgb,var(--surface-border)_40%,transparent)]",
      );
    });

    it("uses animated background when motion is not reduced", () => {
      mockMatchMedia(false);
      act(() => {
        root = createRoot(container);
        root.render(createElement(SkeletonScreen, { variant: "card-grid" }));
      });
      const statusEl = container.querySelector("[role='status']") as HTMLElement;
      const gridContainer = statusEl.querySelector("div") as HTMLElement;
      const placeholder = gridContainer.querySelector("div") as HTMLElement;
      expect(placeholder.className).toContain("im-shimmer");
    });
  });
});
