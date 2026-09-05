import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { ensureZhHantLocale, wrapWithI18n } from "../../test/i18nHarness";
import { ErrorBoundary } from "./ErrorBoundary";
import { flushMicrotasks } from "../../test/async-helpers";

vi.mock("../../api/appLogClient", async () => {
  const actual = await vi.importActual<typeof import("../../api/appLogClient")>(
    "../../api/appLogClient",
  );
  return {
    ...actual,
    recordAppLog: vi.fn(() => Promise.resolve({ id: "mock-id" })),
  };
});

import { APP_LOG_KIND, recordAppLog } from "../../api/appLogClient";

const mockedRecordAppLog = vi.mocked(recordAppLog);

// A component that throws an error on render
function ThrowingChild({ message }: { message: string }): React.ReactNode {
  throw new Error(message);
}

// A normal child component
function GoodChild() {
  return createElement("div", null, "Child rendered OK");
}

function renderBoundary(child: React.ReactNode) {
  const container = document.createElement("div");
  act(() => {
    createRoot(container).render(wrapWithI18n(createElement(ErrorBoundary, null, child)));
  });
  return container;
}

describe("ErrorBoundary", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await ensureZhHantLocale();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedRecordAppLog.mockClear();
  });

  it("renders children normally when no error occurs", () => {
    const container = renderBoundary(createElement(GoodChild));
    expect(container.textContent).toContain("Child rendered OK");
  });

  it("displays error message when child throws", () => {
    const container = renderBoundary(
      createElement(ThrowingChild, { message: "Boom!" }),
    );
    expect(container.textContent).toContain("發生未預期的錯誤");
    expect(container.textContent).toContain("Boom!");
    expect(container.textContent).toContain("重新載入介面");
  });

  it("shows collapsible componentStack toggle button", () => {
    const container = renderBoundary(
      createElement(ThrowingChild, { message: "Stack test" }),
    );
    // The toggle button should be present
    const toggleBtn = container.querySelector('[data-testid="toggle-stack"]');
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn!.textContent).toContain("顯示元件堆疊");

    // Stack should NOT be visible initially
    const stackPre = container.querySelector('[data-testid="component-stack"]');
    expect(stackPre).toBeNull();
  });

  it("reveals componentStack when toggle is clicked", () => {
    const container = renderBoundary(
      createElement(ThrowingChild, { message: "Toggle test" }),
    );

    const toggleBtn = container.querySelector('[data-testid="toggle-stack"]') as HTMLButtonElement;
    expect(toggleBtn).not.toBeNull();

    // Click to expand
    act(() => {
      toggleBtn.click();
    });

    expect(toggleBtn.textContent).toContain("隱藏元件堆疊");
    const stackPre = container.querySelector('[data-testid="component-stack"]');
    expect(stackPre).not.toBeNull();
    // componentStack should contain some stack trace content
    expect(stackPre!.textContent!.length).toBeGreaterThan(0);
  });

  it("calls recordAppLog with frontend.react kind when error is caught", () => {
    renderBoundary(createElement(ThrowingChild, { message: "Log this error" }));

    expect(mockedRecordAppLog).toHaveBeenCalledTimes(1);
    expect(mockedRecordAppLog).toHaveBeenCalledWith({
      level: "error",
      category: "frontend",
      kind: APP_LOG_KIND.FRONTEND_REACT,
      message: "未捕獲的元件錯誤: Log this error",
      messageKey: "logs:templates.frontendReact",
      source: "frontend.ErrorBoundary",
      payload: {
        message: "Log this error",
        componentStack: expect.any(String),
      },
    });
  });

  it("calls console.error with correct format", () => {
    renderBoundary(createElement(ThrowingChild, { message: "Console test" }));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[ErrorBoundary]",
      expect.any(Error),
      expect.anything(),
    );
  });

  it("calls console.warn when recordAppLog rejects", async () => {
    const logError = new Error("log write failed");
    mockedRecordAppLog.mockRejectedValueOnce(logError);
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    renderBoundary(createElement(ThrowingChild, { message: "Warn test" }));

    // Flush the rejected promise's .catch handler
    await act(async () => {
      await flushMicrotasks();
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[ErrorBoundary] recordAppLog failed:",
      logError,
    );
    consoleWarnSpy.mockRestore();
  });

  it("sets aria-expanded=false on stack toggle button initially", () => {
    const container = renderBoundary(
      createElement(ThrowingChild, { message: "ARIA test" }),
    );

    const toggleBtn = container.querySelector('[data-testid="toggle-stack"]') as HTMLButtonElement;
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn.getAttribute("aria-expanded")).toBe("false");
  });

  it("sets aria-expanded=true after clicking stack toggle button", () => {
    const container = renderBoundary(
      createElement(ThrowingChild, { message: "ARIA toggle test" }),
    );

    const toggleBtn = container.querySelector('[data-testid="toggle-stack"]') as HTMLButtonElement;
    expect(toggleBtn).not.toBeNull();

    act(() => {
      toggleBtn.click();
    });

    expect(toggleBtn.getAttribute("aria-expanded")).toBe("true");
  });
});
