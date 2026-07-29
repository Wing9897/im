import { act } from "react";
import type React from "react";
import { createRoot, type Root } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "../i18n";
import {
  PROFILE_ACCESS_KEYS_PATH,
  ErrorToast,
  formatCorrelationRef,
  getActionsForErrorCode,
} from "./ErrorToast";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
});

function renderToast(node: React.ReactNode) {
  act(() => {
    root = createRoot(container);
    root.render(<I18nextProvider i18n={i18n}>{node}</I18nextProvider>);
  });
}

describe("ErrorToast", () => {
  it("renders the error message", () => {
    renderToast(<ErrorToast
          message="Something went wrong"
          errorCode="VALIDATION_ERROR"
          correlationId="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
          onDismiss={vi.fn()}
        />);

    expect(container.textContent).toContain("Something went wrong");
  });

  it("displays first 8 characters of correlationId as reference", () => {
    renderToast(<ErrorToast
          message="Error occurred"
          errorCode="NOT_FOUND"
          correlationId="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
          onDismiss={vi.fn()}
        />);

    const refElement = container.querySelector("[data-testid='error-toast-ref']");
    expect(refElement).not.toBeNull();
    expect(refElement!.textContent).toBe("Ref: a1b2c3d4");
  });

  it("does not show action buttons for COLLECTOR_UNAVAILABLE", () => {
    renderToast(<ErrorToast
          message="Collector is down"
          errorCode="COLLECTOR_UNAVAILABLE"
          correlationId="abcdef12-0000-0000-0000-000000000000"
          onDismiss={vi.fn()}
        />);

    const actionButtons = container.querySelectorAll("[data-testid^='error-toast-action-']");
    expect(actionButtons.length).toBe(0);
  });

  it("does not show action buttons for FORBIDDEN / SCHEMA_UPGRADE_REQUIRED / SSE_CAPACITY", () => {
    for (const errorCode of ["FORBIDDEN", "SCHEMA_UPGRADE_REQUIRED", "SSE_CAPACITY"]) {
      renderToast(<ErrorToast
            message="blocked"
            errorCode={errorCode}
            correlationId="abcdef12-0000-0000-0000-000000000000"
            onDismiss={vi.fn()}
          />);
      expect(container.querySelectorAll("[data-testid^='error-toast-action-']").length).toBe(0);
      act(() => root?.unmount());
    }
  });

  it("shows Profile API keys button for AUTH_REQUIRED error", () => {
    renderToast(<ErrorToast
          message="Authentication required"
          errorCode="AUTH_REQUIRED"
          correlationId="00001111-2222-3333-4444-555566667777"
          onDismiss={vi.fn()}
        />);

    const actionButton = container.querySelector(
      "[data-testid='error-toast-action-AUTH_REQUIRED']",
    );
    expect(actionButton).not.toBeNull();
    expect(actionButton!.textContent).toBe("前往帳戶 → 存取金鑰");
  });

  it("shows Profile API keys button for AUTH_SETUP_REQUIRED error", () => {
    renderToast(<ErrorToast
          message="API key not configured"
          errorCode="AUTH_SETUP_REQUIRED"
          correlationId="00001111-2222-3333-4444-555566667777"
          onDismiss={vi.fn()}
        />);

    const actionButton = container.querySelector(
      "[data-testid='error-toast-action-AUTH_SETUP_REQUIRED']",
    );
    expect(actionButton).not.toBeNull();
    expect(actionButton!.textContent).toBe("前往帳戶 → 存取金鑰");
  });

  it("navigates to Profile access-keys when auth action is clicked", () => {
    const onDismiss = vi.fn();
    const onNavigate = vi.fn();

    renderToast(<ErrorToast
          message="Authentication required"
          errorCode="AUTH_REQUIRED"
          correlationId="00001111-2222-3333-4444-555566667777"
          onDismiss={onDismiss}
          onNavigate={onNavigate}
        />);

    const actionButton = container.querySelector(
      "[data-testid='error-toast-action-AUTH_REQUIRED']",
    ) as HTMLButtonElement;

    act(() => {
      actionButton.click();
    });

    expect(onNavigate).toHaveBeenCalledWith(PROFILE_ACCESS_KEYS_PATH);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not show action buttons for generic error codes", () => {
    renderToast(<ErrorToast
          message="Validation failed"
          errorCode="VALIDATION_ERROR"
          correlationId="abcdef12-0000-0000-0000-000000000000"
          onDismiss={vi.fn()}
        />);

    const actionButtons = container.querySelectorAll("[data-testid^='error-toast-action-']");
    expect(actionButtons.length).toBe(0);
  });

  it("calls onDismiss when close button is clicked", () => {
    const onDismiss = vi.fn();

    renderToast(<ErrorToast
          message="Error occurred"
          errorCode="NOT_FOUND"
          correlationId="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
          onDismiss={onDismiss}
        />);

    const closeButton = container.querySelector(
      "[data-testid='error-toast-close']",
    ) as HTMLButtonElement;

    act(() => {
      closeButton.click();
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("has role='alert' for accessibility", () => {
    renderToast(<ErrorToast
          message="Error occurred"
          errorCode="NOT_FOUND"
          correlationId="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
          onDismiss={vi.fn()}
        />);

    const alertElement = container.querySelector("[role='alert']");
    expect(alertElement).not.toBeNull();
  });
});

describe("formatCorrelationRef", () => {
  it("returns first 8 characters of a UUID", () => {
    expect(formatCorrelationRef("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe("a1b2c3d4");
  });

  it("handles short strings (less than 8 chars)", () => {
    expect(formatCorrelationRef("abc")).toBe("abc");
  });

  it("handles empty strings", () => {
    expect(formatCorrelationRef("")).toBe("");
  });
});

describe("getActionsForErrorCode", () => {
  const mockHandlers = {
    navigateToProfileAccessKeys: vi.fn(),
  };

  it("returns empty array for COLLECTOR_UNAVAILABLE", () => {
    expect(getActionsForErrorCode("COLLECTOR_UNAVAILABLE", mockHandlers)).toHaveLength(0);
  });

  it("returns empty array for FORBIDDEN / SCHEMA_UPGRADE_REQUIRED / SSE_CAPACITY", () => {
    expect(getActionsForErrorCode("FORBIDDEN", mockHandlers)).toHaveLength(0);
    expect(getActionsForErrorCode("SCHEMA_UPGRADE_REQUIRED", mockHandlers)).toHaveLength(0);
    expect(getActionsForErrorCode("SSE_CAPACITY", mockHandlers)).toHaveLength(0);
  });

  it("returns navigate action for AUTH_REQUIRED", () => {
    const actions = getActionsForErrorCode("AUTH_REQUIRED", mockHandlers);
    expect(actions).toHaveLength(1);
    expect(actions[0].label).toBe("前往帳戶 → 存取金鑰");
  });

  it("returns navigate action for AUTH_SETUP_REQUIRED", () => {
    const actions = getActionsForErrorCode("AUTH_SETUP_REQUIRED", mockHandlers);
    expect(actions).toHaveLength(1);
    expect(actions[0].label).toBe("前往帳戶 → 存取金鑰");
  });

  it("returns empty array for unknown error codes", () => {
    expect(getActionsForErrorCode("DB_ERROR", mockHandlers)).toHaveLength(0);
    expect(getActionsForErrorCode("RATE_LIMITED", mockHandlers)).toHaveLength(0);
    expect(getActionsForErrorCode("NOT_FOUND", mockHandlers)).toHaveLength(0);
  });
});
