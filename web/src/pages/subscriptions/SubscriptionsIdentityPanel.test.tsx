import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/calendarShare", async () =>
  (await import("../../test/calendarShareApiMock")).calendarShareApiModuleMock());

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

vi.mock("../../domain/user/userProfile", () => ({
  useUserProfile: () => ({
    profile: { displayName: "Wing", avatarDataUrl: null, background: "" },
    setProfile: vi.fn(),
  }),
  resolveUserDisplayName: (profile: { displayName: string }, fallback: string) =>
    profile.displayName.trim() || fallback,
}));

import { SubscriptionsIdentityPanel } from "./SubscriptionsIdentityPanel";
import { ensureZhHantLocale, wrapWithI18n } from "../../test/i18nHarness";
import { calendarShareApiMocks, resetCalendarShareApiMocks } from "../../test/calendarShareApiMock";
import { resetCalendarShareCatalogForTests } from "../../domain/calendarShare/useCalendarShareCatalog";

const PUBLIC_URL = "https://subscribe.devents.tech";

const DISCONNECTED = {
  connected: false,
  baseUrl: PUBLIC_URL,
  handle: "",
  status: "disconnected" as const,
};

const CONNECTED = {
  connected: true,
  baseUrl: "http://127.0.0.1:8787",
  handle: "Wing",
  status: "connected" as const,
};

describe("SubscriptionsIdentityPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await ensureZhHantLocale();
    resetCalendarShareCatalogForTests();
    resetCalendarShareApiMocks();
    calendarShareApiMocks.fetchCalendarShareSession.mockResolvedValue(DISCONNECTED);
    calendarShareApiMocks.fetchCalendarShareSubscriptions.mockResolvedValue({
      items: [],
      ownHandle: "",
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
    resetCalendarShareCatalogForTests();
  });

  async function renderPanel() {
    act(() => {
      root.render(wrapWithI18n(createElement(SubscriptionsIdentityPanel)));
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("shows login form and initials avatar when logged out", async () => {
    calendarShareApiMocks.fetchCalendarShareTimezone.mockResolvedValue({
      timezone: "Asia/Taipei",
      suggestedTimezone: "Asia/Taipei",
      pendingPublicTimezone: false,
      lastPublicTimezone: "Asia/Taipei",
    });
    await renderPanel();
    expect(container.querySelector('[data-testid="subscriptions-identity-panel"]')?.getAttribute("data-connected")).toBe(
      "false",
    );
    expect(container.querySelector('[data-testid="calendar-share-login"]')).toBeTruthy();
    const urlInput = container.querySelector('[data-testid="calendar-share-url"]') as HTMLInputElement;
    expect(urlInput?.value).toBe(PUBLIC_URL);
    expect(urlInput?.placeholder).toBe(PUBLIC_URL);
    expect(container.querySelector('[data-testid="subscriptions-identity-avatar-initials"]')?.textContent).toBe("WI");
    expect(calendarShareApiMocks.fetchCalendarShareSession).toHaveBeenCalledTimes(1);
    expect(calendarShareApiMocks.fetchCalendarShareTimezone).toHaveBeenCalled();
  });

  it("fills the public origin when the session has no stored URL", async () => {
    calendarShareApiMocks.fetchCalendarShareSession.mockResolvedValue({
      ...DISCONNECTED,
      baseUrl: "",
    });
    calendarShareApiMocks.fetchCalendarShareTimezone.mockResolvedValue({
      timezone: "Asia/Taipei",
      suggestedTimezone: "Asia/Taipei",
      pendingPublicTimezone: false,
      lastPublicTimezone: "Asia/Taipei",
    });
    await renderPanel();
    const urlInput = container.querySelector('[data-testid="calendar-share-url"]') as HTMLInputElement;
    expect(urlInput?.value).toBe(PUBLIC_URL);
  });

  it("shows a reminder when the last public timezone update did not finish", async () => {
    calendarShareApiMocks.fetchCalendarShareTimezone.mockResolvedValue({
      timezone: "Asia/Hong_Kong",
      suggestedTimezone: "Asia/Hong_Kong",
      pendingPublicTimezone: true,
      lastPublicTimezone: "",
    });
    await renderPanel();
    expect(container.querySelector('[data-testid="calendar-share-timezone-pending"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="calendar-share-timezone"]')).toBeTruthy();
  });

  it("hides the reminder when the public replica is current", async () => {
    calendarShareApiMocks.fetchCalendarShareTimezone.mockResolvedValue({
      timezone: "Asia/Taipei",
      suggestedTimezone: "Asia/Hong_Kong",
      pendingPublicTimezone: false,
      lastPublicTimezone: "Asia/Taipei",
    });
    await renderPanel();
    expect(container.querySelector('[data-testid="calendar-share-timezone-pending"]')).toBeNull();
  });

  it("invalidates the shared catalog after login and logout", async () => {
    calendarShareApiMocks.fetchCalendarShareTimezone.mockResolvedValue({
      timezone: "Asia/Taipei",
      suggestedTimezone: "Asia/Taipei",
      pendingPublicTimezone: false,
      lastPublicTimezone: "Asia/Taipei",
    });
    calendarShareApiMocks.loginCalendarShare.mockImplementation(async () => {
      calendarShareApiMocks.fetchCalendarShareSession.mockResolvedValue(CONNECTED);
      return CONNECTED;
    });
    calendarShareApiMocks.logoutCalendarShare.mockImplementation(async () => {
      calendarShareApiMocks.fetchCalendarShareSession.mockResolvedValue(DISCONNECTED);
      return DISCONNECTED;
    });
    await renderPanel();

    const handle = container.querySelector('[data-testid="calendar-share-handle"]') as HTMLInputElement;
    const password = container.querySelector('[data-testid="calendar-share-password"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(handle, "Wing");
      handle.dispatchEvent(new Event("input", { bubbles: true }));
      setter.call(password, "secret");
      password.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      (container.querySelector('[data-testid="calendar-share-login"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(calendarShareApiMocks.loginCalendarShare).toHaveBeenCalled();
    expect(calendarShareApiMocks.putCalendarShareProfile).toHaveBeenCalledWith("");
    expect(calendarShareApiMocks.fetchCalendarShareSession.mock.calls.length).toBeGreaterThan(1);
    expect(container.querySelector('[data-testid="subscriptions-identity-handle"]')?.textContent).toContain("Wing");
    expect(container.querySelector('[data-testid="calendar-share-logout"]')).toBeTruthy();

    await act(async () => {
      (container.querySelector('[data-testid="calendar-share-logout"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(calendarShareApiMocks.logoutCalendarShare).toHaveBeenCalled();
    expect(container.querySelector('[data-testid="calendar-share-login"]')).toBeTruthy();
  });
});
