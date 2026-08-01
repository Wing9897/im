/**
 * Tests for ErrorToastContext — provider integration with the singleton
 * errorToastEmitter: display, auto-dismiss, max-toast cap, and manual dismiss.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "../i18n";
import { ErrorToastProvider } from "./ErrorToastContext";
import { errorToastEmitter, type ErrorToastEvent } from "../api/errorToastEmitter";

function makeEvent(overrides?: Partial<ErrorToastEvent>): ErrorToastEvent {
  return {
    errorCode: "VALIDATION_ERROR",
    message: "Something went wrong",
    correlationId: "00000000-0000-0000-0000-000000000001",
    ...overrides,
  };
}

describe("ErrorToastContext", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
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

  function renderProvider(onNavigate?: (path: string) => void) {
    act(() => {
      root = createRoot(container);
      root.render(
        <I18nextProvider i18n={i18n}>
          <ErrorToastProvider onNavigate={onNavigate}>
            <div data-testid="app-content" />
          </ErrorToastProvider>
        </I18nextProvider>,
      );
    });
  }

  it("renders children without any toast initially", () => {
    renderProvider();

    expect(container.querySelector('[data-testid="app-content"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="錯誤通知區域"]')).toBeNull();
  });

  it("shows a toast when the emitter fires", () => {
    renderProvider();

    act(() => {
      errorToastEmitter.emit(makeEvent({ message: "Collector adapter failed" }));
    });

    const region = container.querySelector('[aria-label="錯誤通知區域"]');
    expect(region).not.toBeNull();
    expect(region!.textContent).toContain("Collector adapter failed");
  });

  it("auto-dismisses a toast after 15 seconds", () => {
    renderProvider();

    act(() => {
      errorToastEmitter.emit(makeEvent());
    });
    expect(container.querySelector('[aria-label="錯誤通知區域"]')).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(container.querySelector('[aria-label="錯誤通知區域"]')).toBeNull();
  });

  it("caps concurrent toasts at 5, dropping the oldest", () => {
    renderProvider();

    act(() => {
      for (let i = 1; i <= 6; i++) {
        errorToastEmitter.emit(makeEvent({ message: `error-${i}` }));
      }
    });

    const region = container.querySelector('[aria-label="錯誤通知區域"]');
    expect(region).not.toBeNull();
    expect(region!.textContent).not.toContain("error-1");
    for (let i = 2; i <= 6; i++) {
      expect(region!.textContent).toContain(`error-${i}`);
    }
  });

  it("stops receiving emitter events after unmount", () => {
    renderProvider();

    act(() => {
      root!.unmount();
    });
    root = null;

    // Emitting after unmount must not throw (listener removed).
    expect(() => {
      errorToastEmitter.emit(makeEvent());
    }).not.toThrow();
  });

  it("dismisses a toast via its close button", () => {
    renderProvider();

    act(() => {
      errorToastEmitter.emit(makeEvent({ message: "dismiss me" }));
    });

    const dismissButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="關閉錯誤通知"]',
    );
    expect(dismissButton).not.toBeNull();

    act(() => {
      dismissButton!.click();
    });

    expect(container.querySelector('[aria-label="錯誤通知區域"]')).toBeNull();
  });
});
