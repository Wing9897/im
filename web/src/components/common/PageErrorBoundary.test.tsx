/**
 * PageErrorBoundary — unit tests
 *
 * Verifies:
 * - Renders children normally when no error occurs
 * - Catches rendering errors and displays recovery UI
 * - Shows error message in the fallback UI
 * - Reset button clears error and re-renders children
 * - Custom fallback prop is used when provided
 * - Accessibility: role="alert" on error UI
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { createElement, act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

import { PageErrorBoundary } from "./PageErrorBoundary";

// Suppress console.error from React's error boundary logging in test output
vi.mock("../../utils/logger", () => ({
  logError: vi.fn(),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  // Suppress React's own console.error about uncaught errors in error boundaries
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Test components
// ---------------------------------------------------------------------------

function GoodChild() {
  return createElement("div", { "data-testid": "child" }, "正常內容");
}

function ThrowingChild({ message }: { message: string }): React.ReactNode {
  throw new Error(message);
}

// A component that can toggle between working and throwing
function ToggleableChild({
  shouldThrow,
  throwMessage,
}: {
  shouldThrow: boolean;
  throwMessage: string;
}) {
  if (shouldThrow) {
    throw new Error(throwMessage);
  }
  return createElement("div", { "data-testid": "child" }, "已恢復");
}

describe("PageErrorBoundary", () => {
  describe("normal rendering", () => {
    it("renders children when no error occurs", () => {
      act(() => {
        root.render(
          createElement(PageErrorBoundary, null, createElement(GoodChild)),
        );
      });

      const child = container.querySelector("[data-testid='child']");
      expect(child).not.toBeNull();
      expect(child!.textContent).toBe("正常內容");
    });

    it("does not display error UI when no error occurs", () => {
      act(() => {
        root.render(
          createElement(PageErrorBoundary, null, createElement(GoodChild)),
        );
      });

      const alert = container.querySelector("[role='alert']");
      expect(alert).toBeNull();
    });
  });

  describe("error catching", () => {
    it("catches rendering errors and displays error UI", () => {
      act(() => {
        root.render(
          createElement(
            PageErrorBoundary,
            null,
            createElement(ThrowingChild, { message: "Test error" }),
          ),
        );
      });

      const alert = container.querySelector("[role='alert']");
      expect(alert).not.toBeNull();
    });

    it("displays the error message in the UI", () => {
      act(() => {
        root.render(
          createElement(
            PageErrorBoundary,
            null,
            createElement(ThrowingChild, { message: "Something went wrong" }),
          ),
        );
      });

      const pre = container.querySelector("pre");
      expect(pre).not.toBeNull();
      expect(pre!.textContent).toContain("Something went wrong");
    });

    it("shows the error title text", () => {
      act(() => {
        root.render(
          createElement(
            PageErrorBoundary,
            null,
            createElement(ThrowingChild, { message: "err" }),
          ),
        );
      });

      expect(container.textContent).toContain("此頁面發生錯誤");
    });

    it("shows recovery instructions", () => {
      act(() => {
        root.render(
          createElement(
            PageErrorBoundary,
            null,
            createElement(ThrowingChild, { message: "err" }),
          ),
        );
      });

      expect(container.textContent).toContain("頁面渲染時遇到問題");
    });
  });

  describe("recovery via reset button", () => {
    it("renders a retry button in the error UI", () => {
      act(() => {
        root.render(
          createElement(
            PageErrorBoundary,
            null,
            createElement(ThrowingChild, { message: "err" }),
          ),
        );
      });

      const button = container.querySelector("button");
      expect(button).not.toBeNull();
      expect(button!.textContent).toBe("重試");
    });

    it("clears error state when retry button is clicked", () => {
      // Use a wrapper that controls whether the child throws
      let setShouldThrow: (v: boolean) => void;

      function Wrapper() {
        const [shouldThrow, _setShouldThrow] = useState(true);
        setShouldThrow = _setShouldThrow;
        return createElement(
          PageErrorBoundary,
          null,
          createElement(ToggleableChild, {
            shouldThrow,
            throwMessage: "initial error",
          }),
        );
      }

      act(() => {
        root.render(createElement(Wrapper));
      });

      // Should be in error state
      expect(container.querySelector("[role='alert']")).not.toBeNull();

      // Fix the child so it won't throw
      act(() => {
        setShouldThrow!(false);
      });

      // Click retry
      const button = container.querySelector("button");
      act(() => {
        button!.click();
      });

      // Should now render the child again
      const child = container.querySelector("[data-testid='child']");
      expect(child).not.toBeNull();
      expect(child!.textContent).toBe("已恢復");
      expect(container.querySelector("[role='alert']")).toBeNull();
    });
  });

  describe("custom fallback", () => {
    it("renders custom fallback when provided", () => {
      const customFallback = createElement(
        "div",
        { "data-testid": "custom-fallback" },
        "自訂錯誤介面",
      );

      act(() => {
        root.render(
          createElement(
            PageErrorBoundary,
            { fallback: customFallback },
            createElement(ThrowingChild, { message: "err" }),
          ),
        );
      });

      const fallback = container.querySelector(
        "[data-testid='custom-fallback']",
      );
      expect(fallback).not.toBeNull();
      expect(fallback!.textContent).toBe("自訂錯誤介面");
    });

    it("does not show default error UI when custom fallback is used", () => {
      const customFallback = createElement("div", null, "Custom");

      act(() => {
        root.render(
          createElement(
            PageErrorBoundary,
            { fallback: customFallback },
            createElement(ThrowingChild, { message: "err" }),
          ),
        );
      });

      expect(container.querySelector("[role='alert']")).toBeNull();
    });
  });

  describe("accessibility", () => {
    it("uses role=alert on the error UI container", () => {
      act(() => {
        root.render(
          createElement(
            PageErrorBoundary,
            null,
            createElement(ThrowingChild, { message: "err" }),
          ),
        );
      });

      const alert = container.querySelector("[role='alert']");
      expect(alert).not.toBeNull();
    });
  });
});
