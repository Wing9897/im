import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { Suspense, createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

vi.mock("../../utils/logger", () => ({
  logError: vi.fn(),
}));

const { LazyLoadErrorBoundary } = await import(
  "./LazyLoadErrorBoundary"
);

// --- Helpers ---

/** A component that always throws on render */
function ThrowingChild({ error }: { error: Error }): React.ReactNode {
  throw error;
}

/** A normal child component */
function GoodChild() {
  return createElement("div", { "data-testid": "good-child" }, "loaded ok");
}

/**
 * Creates a lazy component that can be resolved/rejected externally.
 * Useful for testing Suspense fallback rendering.
 */
function createControllableLazy() {
  let resolve!: (mod: { default: React.ComponentType }) => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<{ default: React.ComponentType }>(
    (res, rej) => {
      resolve = res;
      reject = rej;
    },
  );
  const LazyComponent = React.lazy(() => promise);
  return { LazyComponent, resolve, reject };
}

describe("LazyLoadErrorBoundary", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe("error fallback rendering", () => {
    it("renders error fallback with correct message when child throws", () => {
      // Suppress React error boundary console noise
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      act(() => {
        createRoot(container).render(
          createElement(
            LazyLoadErrorBoundary,
            null,
            createElement(ThrowingChild, { error: new Error("chunk failed") }),
          ),
        );
      });

      spy.mockRestore();

      // Should show the error message
      expect(container.textContent).toContain("元件載入失敗");
      // Should show the retry button
      expect(container.textContent).toContain("重試");
      // Should have the error boundary test id
      expect(
        container.querySelector("[data-testid='lazy-load-error-boundary']"),
      ).not.toBeNull();
      // Should have the retry button test id
      expect(
        container.querySelector("[data-testid='lazy-load-retry-button']"),
      ).not.toBeNull();
    });

    it("does not render error fallback when children render successfully", () => {
      act(() => {
        createRoot(container).render(
          createElement(
            LazyLoadErrorBoundary,
            null,
            createElement(GoodChild),
          ),
        );
      });

      expect(container.textContent).toContain("loaded ok");
      expect(container.textContent).not.toContain("元件載入失敗");
      expect(
        container.querySelector("[data-testid='lazy-load-error-boundary']"),
      ).toBeNull();
    });
  });

  describe("retry resets error state", () => {
    it("clicking retry button resets error state and re-renders children", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      let shouldThrow = true;

      function ConditionalChild() {
        if (shouldThrow) {
          throw new Error("load failure");
        }
        return createElement(
          "div",
          { "data-testid": "recovered-child" },
          "recovered",
        );
      }

      act(() => {
        createRoot(container).render(
          createElement(
            LazyLoadErrorBoundary,
            null,
            createElement(ConditionalChild),
          ),
        );
      });

      // Should be in error state
      expect(container.textContent).toContain("元件載入失敗");

      // Fix the child so it won't throw on next render
      shouldThrow = false;

      // Click retry
      const retryButton = container.querySelector(
        "[data-testid='lazy-load-retry-button']",
      ) as HTMLButtonElement;
      expect(retryButton).not.toBeNull();

      act(() => {
        retryButton.click();
      });

      spy.mockRestore();

      // Should now render the recovered child
      expect(container.textContent).toContain("recovered");
      expect(container.textContent).not.toContain("元件載入失敗");
      expect(
        container.querySelector("[data-testid='recovered-child']"),
      ).not.toBeNull();
    });
  });

  describe("fallbackHeight prop", () => {
    it("applies numeric fallbackHeight to the error fallback container", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      act(() => {
        createRoot(container).render(
          createElement(
            LazyLoadErrorBoundary,
            { fallbackHeight: 300 },
            createElement(ThrowingChild, {
              error: new Error("chunk failed"),
            }),
          ),
        );
      });

      spy.mockRestore();

      const fallbackDiv = container.querySelector(
        "[data-testid='lazy-load-error-boundary']",
      ) as HTMLDivElement;
      expect(fallbackDiv).not.toBeNull();
      expect(fallbackDiv.style.height).toBe("300px");
    });

    it("applies string fallbackHeight to the error fallback container", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      act(() => {
        createRoot(container).render(
          createElement(
            LazyLoadErrorBoundary,
            { fallbackHeight: "100%" },
            createElement(ThrowingChild, {
              error: new Error("chunk failed"),
            }),
          ),
        );
      });

      spy.mockRestore();

      const fallbackDiv = container.querySelector(
        "[data-testid='lazy-load-error-boundary']",
      ) as HTMLDivElement;
      expect(fallbackDiv).not.toBeNull();
      expect(fallbackDiv.style.height).toBe("100%");
    });

    it("uses minHeight when fallbackHeight is not provided", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      act(() => {
        createRoot(container).render(
          createElement(
            LazyLoadErrorBoundary,
            null,
            createElement(ThrowingChild, {
              error: new Error("chunk failed"),
            }),
          ),
        );
      });

      spy.mockRestore();

      const fallbackDiv = container.querySelector(
        "[data-testid='lazy-load-error-boundary']",
      ) as HTMLDivElement;
      expect(fallbackDiv).not.toBeNull();
      expect(fallbackDiv.className).toContain("min-h-[120px]");
    });
  });

  describe("Suspense fallback rendering", () => {
    it("renders Suspense fallback while lazy component is loading", async () => {
      const { LazyComponent, resolve } = createControllableLazy();

      act(() => {
        createRoot(container).render(
          createElement(
            LazyLoadErrorBoundary,
            null,
            createElement(
              Suspense,
              {
                fallback: createElement(
                  "div",
                  { "data-testid": "suspense-fallback" },
                  "載入中...",
                ),
              },
              createElement(LazyComponent),
            ),
          ),
        );
      });

      // While the lazy component hasn't resolved, the Suspense fallback should show
      expect(container.textContent).toContain("載入中...");
      expect(
        container.querySelector("[data-testid='suspense-fallback']"),
      ).not.toBeNull();

      // Resolve the lazy component
      await act(async () => {
        resolve({
          default: () =>
            createElement(
              "div",
              { "data-testid": "lazy-resolved" },
              "lazy content",
            ),
        });
      });

      // After resolution, the lazy content should render
      expect(container.textContent).toContain("lazy content");
      expect(
        container.querySelector("[data-testid='lazy-resolved']"),
      ).not.toBeNull();
      expect(
        container.querySelector("[data-testid='suspense-fallback']"),
      ).toBeNull();
    });

    it("shows error boundary fallback when lazy component rejects", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { LazyComponent, reject } = createControllableLazy();

      act(() => {
        createRoot(container).render(
          createElement(
            LazyLoadErrorBoundary,
            null,
            createElement(
              Suspense,
              {
                fallback: createElement(
                  "div",
                  { "data-testid": "suspense-fallback" },
                  "載入中...",
                ),
              },
              createElement(LazyComponent),
            ),
          ),
        );
      });

      // Initially shows suspense fallback
      expect(container.textContent).toContain("載入中...");

      // Reject the lazy import
      await act(async () => {
        reject(new Error("Network error: chunk load failed"));
      });

      spy.mockRestore();

      // Should now show the error boundary fallback
      expect(container.textContent).toContain("元件載入失敗");
      expect(container.textContent).toContain("重試");
      expect(
        container.querySelector("[data-testid='lazy-load-error-boundary']"),
      ).not.toBeNull();
    });
  });

  describe("navigation compatibility", () => {
    it("renders children normally without interfering with component tree", () => {
      // Simulate a component tree similar to what pages use
      act(() => {
        createRoot(container).render(
          createElement(
            "div",
            { "data-testid": "page-container" },
            createElement(
              LazyLoadErrorBoundary,
              { fallbackHeight: 320 },
              createElement(
                Suspense,
                {
                  fallback: createElement("div", null, "loading..."),
                },
                createElement(
                  "div",
                  { "data-testid": "heavy-component" },
                  "Heavy component content",
                ),
              ),
            ),
            createElement(
              "nav",
              { "data-testid": "navigation" },
              "Navigation links",
            ),
          ),
        );
      });

      // Both the wrapped component and sibling navigation should render
      expect(
        container.querySelector("[data-testid='heavy-component']"),
      ).not.toBeNull();
      expect(
        container.querySelector("[data-testid='navigation']"),
      ).not.toBeNull();
      expect(container.textContent).toContain("Heavy component content");
      expect(container.textContent).toContain("Navigation links");
    });

    it("error in one boundary does not affect sibling components", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      act(() => {
        createRoot(container).render(
          createElement(
            "div",
            { "data-testid": "page-container" },
            createElement(
              LazyLoadErrorBoundary,
              null,
              createElement(ThrowingChild, {
                error: new Error("chunk failed"),
              }),
            ),
            createElement(
              "div",
              { "data-testid": "sibling-component" },
              "I still work",
            ),
          ),
        );
      });

      spy.mockRestore();

      // Error boundary catches the error
      expect(container.textContent).toContain("元件載入失敗");
      // Sibling component is unaffected
      expect(
        container.querySelector("[data-testid='sibling-component']"),
      ).not.toBeNull();
      expect(container.textContent).toContain("I still work");
    });
  });
});
