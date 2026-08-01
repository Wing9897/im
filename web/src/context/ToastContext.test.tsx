import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider, useToast } from "./ToastContext";

let latestValue: ReturnType<typeof useToast> | null = null;

function ToastHarness() {
  latestValue = useToast();
  return null;
}

describe("ToastContext", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    latestValue = null;
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("throws when useToast is used outside ToastProvider", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => {
      act(() => {
        root = createRoot(container);
        root.render(<ToastHarness />);
      });
    }).toThrow("useToast must be used within ToastProvider");

    consoleError.mockRestore();
  });

  it("renders children correctly when provider is present", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <ToastProvider>
          <div data-testid="child">Hello</div>
        </ToastProvider>,
      );
    });

    expect(container.querySelector("[data-testid='child']")).not.toBeNull();
    expect(container.querySelector("[data-testid='child']")!.textContent).toBe(
      "Hello",
    );
  });

  it("provides a showToast function", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <ToastProvider>
          <ToastHarness />
        </ToastProvider>,
      );
    });

    expect(latestValue).not.toBeNull();
    expect(typeof latestValue!.showToast).toBe("function");
  });

  it("displays a toast with default tone 'info' when no tone is specified", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <ToastProvider>
          <ToastHarness />
        </ToastProvider>,
      );
    });

    act(() => {
      latestValue!.showToast("Test message");
    });

    const alertContainer = container.querySelector("[role='alert']");
    expect(alertContainer).not.toBeNull();
    expect(alertContainer!.textContent).toContain("Test message");
    // "ℹ" is the info icon
    expect(alertContainer!.textContent).toContain("ℹ");
  });

  it("displays a toast with the specified tone", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <ToastProvider>
          <ToastHarness />
        </ToastProvider>,
      );
    });

    act(() => {
      latestValue!.showToast("Success!", "success");
    });

    const alertContainer = container.querySelector("[role='alert']");
    expect(alertContainer).not.toBeNull();
    expect(alertContainer!.textContent).toContain("Success!");
    // "✓" is the success icon
    expect(alertContainer!.textContent).toContain("✓");
  });

  it("displays multiple toasts simultaneously", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <ToastProvider>
          <ToastHarness />
        </ToastProvider>,
      );
    });

    act(() => {
      latestValue!.showToast("First", "info");
      latestValue!.showToast("Second", "error");
      latestValue!.showToast("Third", "warning");
    });

    const alertContainer = container.querySelector("[role='alert']");
    expect(alertContainer).not.toBeNull();
    expect(alertContainer!.textContent).toContain("First");
    expect(alertContainer!.textContent).toContain("Second");
    expect(alertContainer!.textContent).toContain("Third");
  });

  it("automatically removes a toast after 4000ms", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <ToastProvider>
          <ToastHarness />
        </ToastProvider>,
      );
    });

    act(() => {
      latestValue!.showToast("Disappearing toast");
    });

    expect(container.querySelector("[role='alert']")).not.toBeNull();
    expect(container.textContent).toContain("Disappearing toast");

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    // After timeout, the toast container should be gone (no toasts)
    expect(container.querySelector("[role='alert']")).toBeNull();
  });

  it("removes a toast when clicked", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <ToastProvider>
          <ToastHarness />
        </ToastProvider>,
      );
    });

    act(() => {
      latestValue!.showToast("Click me");
    });

    const alertContainer = container.querySelector("[role='alert']");
    expect(alertContainer).not.toBeNull();

    // Click the toast item (dismissible via cursor-pointer class)
    const toastItem = alertContainer!.querySelector(".cursor-pointer") as HTMLElement;
    expect(toastItem).not.toBeNull();

    act(() => {
      toastItem.click();
    });

    // Toast should be removed
    expect(container.querySelector("[role='alert']")).toBeNull();
  });

  it("does not render the toast container when there are no toasts", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <ToastProvider>
          <ToastHarness />
        </ToastProvider>,
      );
    });

    // No toasts initially — container should not render
    expect(container.querySelector("[role='alert']")).toBeNull();
  });

  it("removes toasts independently at their own timeout", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <ToastProvider>
          <ToastHarness />
        </ToastProvider>,
      );
    });

    act(() => {
      latestValue!.showToast("First toast");
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    act(() => {
      latestValue!.showToast("Second toast");
    });

    // Both should be visible
    expect(container.textContent).toContain("First toast");
    expect(container.textContent).toContain("Second toast");

    // Advance to first toast's timeout (4000ms from creation = 2000ms more)
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // First toast should be gone, second should remain
    expect(container.textContent).not.toContain("First toast");
    expect(container.textContent).toContain("Second toast");

    // Advance to second toast's timeout (2000ms more)
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Both should be gone
    expect(container.querySelector("[role='alert']")).toBeNull();
  });
});
