import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureZhHantLocale, wrapWithI18n } from "../../test/i18nHarness";

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

vi.mock("../../api/setup", () => ({
  changePassword: vi.fn(),
  fetchSetupDevices: vi.fn(async () => []),
  logoutDeviceSession: vi.fn(),
  revokeSetupDevice: vi.fn(),
}));

vi.mock("../../api/accessKeys", () => ({
  fetchAccessKeys: vi.fn(async () => ({ keys: [] })),
  createAccessKey: vi.fn(),
  revokeAccessKey: vi.fn(),
}));

vi.mock("../../domain/user/userProfile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../domain/user/userProfile")>();
  return {
    ...actual,
    useUserProfile: () => ({
      profile: { displayName: "Wing", avatarDataUrl: null, background: "" },
      setProfile: vi.fn(),
    }),
  };
});

vi.mock("../../domain/connection/connectionStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../domain/connection/connectionStore")>();
  return {
    ...actual,
    hasDeviceSession: () => false,
  };
});

import { AccountIdentityPage } from "./AccountIdentityPage";
import { AccountDevicesPage } from "./AccountDevicesPage";
import { AccountKeysPage } from "./AccountKeysPage";

describe("Account pages smoke", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await ensureZhHantLocale();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderPage(page: ReturnType<typeof createElement>) {
    act(() => {
      root.render(
        wrapWithI18n(createElement(MemoryRouter, { initialEntries: ["/account"] }, page)),
      );
    });
  }

  it("renders identity", async () => {
    await act(async () => {
      renderPage(createElement(AccountIdentityPage));
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="account-identity-page"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="user-display-name"]')).toBeTruthy();
  });

  it("renders devices", async () => {
    await act(async () => {
      renderPage(createElement(AccountDevicesPage));
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="account-devices-page"]')).toBeTruthy();
  });

  it("renders keys", async () => {
    await act(async () => {
      renderPage(createElement(AccountKeysPage));
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="account-keys-page"]')).toBeTruthy();
  });
});
