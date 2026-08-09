import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { SessionReauthWizard } from "./SessionReauthWizard";
import { _resetConnectionStoreForTests } from "../domain/connection/connectionStore";
import { wrapWithI18n } from "../test/i18nHarness";

const loginWithPassword = vi.fn();
const resetPassword = vi.fn();
const ensureDesktopHostMode = vi.fn().mockResolvedValue(false);
const ensureDesktopClientMode = vi.fn().mockResolvedValue(false);
const isElectronDesktop = vi.fn(() => false);

vi.mock("../api/setup", () => ({
  loginWithPassword: (...args: unknown[]) => loginWithPassword(...args),
  resetPassword: (...args: unknown[]) => resetPassword(...args),
}));

vi.mock("../electron/electronWindow", () => ({
  isElectronDesktop: () => isElectronDesktop(),
}));

vi.mock("../electron/electronConnection", async () => {
  const actual = await vi.importActual<typeof import("../electron/electronConnection")>(
    "../electron/electronConnection",
  );
  return {
    ...actual,
    ensureDesktopHostMode: (...args: unknown[]) => ensureDesktopHostMode(...args),
    ensureDesktopClientMode: (...args: unknown[]) => ensureDesktopClientMode(...args),
  };
});

function setNativeValue(el: HTMLInputElement, value: string) {
  const proto = window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("SessionReauthWizard smoke", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    _resetConnectionStoreForTests();
    loginWithPassword.mockReset();
    resetPassword.mockReset();
    ensureDesktopHostMode.mockReset().mockResolvedValue(false);
    ensureDesktopClientMode.mockReset().mockResolvedValue(false);
    isElectronDesktop.mockReset().mockReturnValue(false);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
  });

  it("pure Web logs in against origin without other-server or serverUrl", async () => {
    const onComplete = vi.fn();
    loginWithPassword.mockResolvedValue({
      accessToken: "a",
      refreshToken: "r",
      accessExpiresAt: "",
      refreshExpiresAt: "",
      device: { id: "1", label: "Host", createdAt: "", lastSeenAt: "", expiresAt: "" },
    });

    act(() => {
      root.render(
        wrapWithI18n(createElement(SessionReauthWizard, { onComplete })),
      );
    });

    expect(container.querySelector('[data-testid="session-reauth-wizard"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="language-switcher"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="setup-step-indicator"]')).toBeNull();
    expect(container.querySelector('[data-testid="reauth-toggle-remote"]')).toBeNull();
    expect(container.querySelector('[data-testid="reauth-server-url"]')).toBeNull();
    expect(container.querySelector('[data-testid="reauth-login"]')).toBeTruthy();
    // Forgot-password stays hidden until connection.json arms resetPasswordForLocal.
    expect(container.querySelector('[data-testid="reauth-forgot-password"]')).toBeNull();
    expect(container.querySelector('[data-testid="reauth-forgot-arm-hint"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="reauth-pairing-code"]')).toBeNull();
    expect(container.querySelector('[data-testid="reauth-show-api-key"]')).toBeNull();
    expect(container.querySelector('[data-testid="reauth-login-api-key"]')).toBeNull();

    await act(async () => {
      setNativeValue(
        container.querySelector('[data-testid="reauth-username"]') as HTMLInputElement,
        "admin",
      );
      setNativeValue(
        container.querySelector('[data-testid="reauth-password"]') as HTMLInputElement,
        "password1",
      );
    });

    await act(async () => {
      (container.querySelector('[data-testid="reauth-login"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(loginWithPassword).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();
  });

  it("Desktop host loopback can forgot-password and toggle other server", async () => {
    isElectronDesktop.mockReturnValue(true);
    resetPassword.mockResolvedValue({ ok: true });

    act(() => {
      root.render(
        wrapWithI18n(createElement(SessionReauthWizard, {
            onComplete: () => {},
            allowLocalPasswordReset: true,
          })),
      );
    });

    expect(container.querySelector('[data-testid="reauth-toggle-remote"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="reauth-forgot-password"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="reauth-forgot-arm-hint"]')).toBeNull();
    expect(container.querySelector('[data-testid="reauth-server-url"]')).toBeNull();

    await act(async () => {
      (
        container.querySelector('[data-testid="reauth-forgot-password"]') as HTMLButtonElement
      ).click();
    });

    expect(container.querySelector('[data-testid="reauth-reset-password"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="reauth-confirm-password"]')).toBeTruthy();

    await act(async () => {
      (
        container.querySelector('[data-testid="reauth-toggle-remote"]') as HTMLButtonElement
      )?.click();
    });

    // Still on forgot form until user goes back; toggle is only on login form.
    // Switch back to login, then toggle remote.
    await act(async () => {
      const buttons = Array.from(container.querySelectorAll("button"));
      const back = buttons.find((b) => /back|返回/i.test(b.textContent || ""));
      back?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      (
        container.querySelector('[data-testid="reauth-toggle-remote"]') as HTMLButtonElement
      ).click();
    });

    expect(container.querySelector('[data-testid="reauth-server-url"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="reauth-forgot-password"]')).toBeNull();
  });

  it("tone=login with no active devices shows revoked help", () => {
    act(() => {
      root.render(
        wrapWithI18n(createElement(SessionReauthWizard, {
            onComplete: () => {},
            tone: "login",
            hasActiveDevice: false,
          })),
      );
    });

    expect(container.querySelector('[data-testid="reauth-login"]')).toBeTruthy();
    expect(container.textContent).toMatch(/revoked|撤销|撤銷/i);
  });
});
