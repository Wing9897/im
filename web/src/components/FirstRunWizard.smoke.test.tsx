import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { FirstRunWizard } from "./FirstRunWizard";
import { getConnectionSnapshot } from "../domain/connection/connectionStore";
import { _resetConnectionStoreForTests } from "../domain/connection/connectionStore.testing";
import { wrapWithI18n } from "../test/i18nHarness";

const registerAdmin = vi.fn();
const loginWithPassword = vi.fn();
const resetPassword = vi.fn();
const ensureDesktopHostMode = vi.fn().mockResolvedValue(false);
const ensureDesktopClientMode = vi.fn().mockResolvedValue(false);
const isElectronDesktop = vi.fn(() => false);

vi.mock("../api/setup", () => ({
  registerAdmin: (...args: unknown[]) => registerAdmin(...args),
  loginWithPassword: (...args: unknown[]) => loginWithPassword(...args),
  resetPassword: (...args: unknown[]) => resetPassword(...args),
}));

vi.mock("../electron/electronWindow", () => ({
  isElectronDesktop: () => isElectronDesktop(),
}));

vi.mock("../electron/electronConnection", async () => {
  const actual = await vi.importActual<
    typeof import("../electron/electronConnection")
  >("../electron/electronConnection");
  return {
    ...actual,
    ensureDesktopHostMode: (...args: unknown[]) =>
      ensureDesktopHostMode(...args),
    ensureDesktopClientMode: (...args: unknown[]) =>
      ensureDesktopClientMode(...args),
  };
});

const sessionBody = {
  accessToken: "a",
  refreshToken: "r",
  accessExpiresAt: "",
  refreshExpiresAt: "",
  device: {
    id: "1",
    label: "Host",
    createdAt: "",
    lastSeenAt: "",
    expiresAt: "",
  },
};

const freshStatus = {
  bootstrapped: false,
  hasAdmin: false,
  hasActiveDevice: false,
  credentialsConfigured: false,
  localhostAuthExempt: true,
  resetPasswordForLocal: false,
};

function setNativeValue(el: HTMLInputElement, value: string) {
  const proto = window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function fillRegisterFields(container: HTMLElement) {
  setNativeValue(
    container.querySelector(
      '[data-testid="setup-username"]',
    ) as HTMLInputElement,
    "admin",
  );
  setNativeValue(
    container.querySelector(
      '[data-testid="setup-password"]',
    ) as HTMLInputElement,
    "password1",
  );
  setNativeValue(
    container.querySelector(
      '[data-testid="setup-confirm-password"]',
    ) as HTMLInputElement,
    "password1",
  );
}

function fillLoginFields(container: HTMLElement) {
  setNativeValue(
    container.querySelector(
      '[data-testid="setup-username"]',
    ) as HTMLInputElement,
    "admin",
  );
  setNativeValue(
    container.querySelector(
      '[data-testid="setup-password"]',
    ) as HTMLInputElement,
    "password1",
  );
}

describe("FirstRunWizard smoke (create-system)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    _resetConnectionStoreForTests();
    registerAdmin.mockReset();
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

  it("pure Web skips mode choice and registers against origin", async () => {
    const onComplete = vi.fn();
    act(() => {
      root.render(
        wrapWithI18n(
          createElement(FirstRunWizard, {
            status: freshStatus,
            onComplete,
          }),
        ),
      );
    });

    expect(
      container.querySelector('[data-testid="first-run-wizard"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-testid="language-switcher"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-testid="setup-step-indicator"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="setup-mode-local"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="setup-register"]'),
    ).toBeTruthy();

    registerAdmin.mockResolvedValue(sessionBody);

    await act(async () => {
      fillRegisterFields(container);
    });

    await act(async () => {
      (
        container.querySelector(
          '[data-testid="setup-register"]',
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
    });

    expect(registerAdmin).toHaveBeenCalledWith(
      "admin",
      "password1",
      expect.any(String),
    );
    expect(ensureDesktopHostMode).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();
  });

  it("Desktop keeps host/client choose and local register path", async () => {
    isElectronDesktop.mockReturnValue(true);
    const onComplete = vi.fn();
    act(() => {
      root.render(
        wrapWithI18n(
          createElement(FirstRunWizard, {
            status: freshStatus,
            onComplete,
          }),
        ),
      );
    });

    expect(
      container.querySelector('[data-testid="setup-mode-local"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-testid="setup-step-indicator"]'),
    ).toBeTruthy();

    await act(async () => {
      container
        .querySelector('[data-testid="setup-mode-local"] button')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(
      container.querySelector('[data-testid="setup-register"]'),
    ).toBeTruthy();

    registerAdmin.mockResolvedValue(sessionBody);

    await act(async () => {
      fillRegisterFields(container);
    });

    await act(async () => {
      (
        container.querySelector(
          '[data-testid="setup-register"]',
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
    });

    expect(registerAdmin).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();
  });

  it("Desktop shows step indicator, switches choose→local|remote, and click-back", async () => {
    isElectronDesktop.mockReturnValue(true);
    const indicator = () =>
      container.querySelector('[data-testid="setup-step-indicator"]');

    act(() => {
      root.render(
        wrapWithI18n(
          createElement(FirstRunWizard, {
            status: freshStatus,
            onComplete: () => {},
          }),
        ),
      );
    });

    expect(indicator()).toBeTruthy();

    await act(async () => {
      container
        .querySelector('[data-testid="setup-mode-local"] button')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(
      container.querySelector('[data-testid="setup-register"]'),
    ).toBeTruthy();
    expect(indicator()?.querySelectorAll("button")).toHaveLength(1);

    await act(async () => {
      indicator()
        ?.querySelector("button")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(
      container.querySelector('[data-testid="setup-mode-local"]'),
    ).toBeTruthy();

    await act(async () => {
      container
        .querySelector('[data-testid="setup-mode-remote"] button')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(
      container.querySelector('[data-testid="setup-server-url"]'),
    ).toBeTruthy();
    expect(container.querySelector('[data-testid="setup-login"]')).toBeTruthy();
  });

  it("shows restarting and blocks register when local Desktop host switch restarts", async () => {
    isElectronDesktop.mockReturnValue(true);
    ensureDesktopHostMode.mockResolvedValue(true);
    const onComplete = vi.fn();
    act(() => {
      root.render(
        wrapWithI18n(
          createElement(FirstRunWizard, {
            status: freshStatus,
            onComplete,
          }),
        ),
      );
    });

    await act(async () => {
      container
        .querySelector('[data-testid="setup-mode-local"] button')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      container.querySelector('[data-testid="setup-restarting"]'),
    ).toBeTruthy();
    expect(
      (
        container.querySelector(
          '[data-testid="setup-register"]',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("Desktop remote login syncs client mode when available", async () => {
    isElectronDesktop.mockReturnValue(true);
    const onComplete = vi.fn();
    loginWithPassword.mockResolvedValue({
      ...sessionBody,
      device: { ...sessionBody.device, id: "2", label: "Phone" },
    });

    act(() => {
      root.render(
        wrapWithI18n(
          createElement(FirstRunWizard, {
            status: freshStatus,
            onComplete,
          }),
        ),
      );
    });

    await act(async () => {
      container
        .querySelector('[data-testid="setup-mode-remote"] button')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      setNativeValue(
        container.querySelector(
          '[data-testid="setup-server-url"]',
        ) as HTMLInputElement,
        "http://192.168.1.10:18820",
      );
      fillLoginFields(container);
    });

    await act(async () => {
      (
        container.querySelector(
          '[data-testid="setup-login"]',
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
    });

    expect(ensureDesktopClientMode).toHaveBeenCalledWith(
      "http://192.168.1.10:18820",
    );
    expect(loginWithPassword).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();
  });

  it("remote Desktop restart does not pollute host im:connection before reload", async () => {
    isElectronDesktop.mockReturnValue(true);
    ensureDesktopClientMode.mockResolvedValue(true);
    const onComplete = vi.fn();

    act(() => {
      root.render(
        wrapWithI18n(
          createElement(FirstRunWizard, {
            status: freshStatus,
            onComplete,
          }),
        ),
      );
    });

    await act(async () => {
      container
        .querySelector('[data-testid="setup-mode-remote"] button')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      setNativeValue(
        container.querySelector(
          '[data-testid="setup-server-url"]',
        ) as HTMLInputElement,
        "http://192.168.1.10:18820",
      );
      fillLoginFields(container);
    });

    await act(async () => {
      (
        container.querySelector(
          '[data-testid="setup-login"]',
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
    });

    expect(ensureDesktopClientMode).toHaveBeenCalled();
    expect(loginWithPassword).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    expect(getConnectionSnapshot().connectionMode).toBeNull();
    expect(
      container.querySelector('[data-testid="setup-restarting"]'),
    ).toBeTruthy();
  });
});
