import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/calendarShare", async () =>
  (await import("../../test/calendarShareApiMock")).calendarShareApiModuleMock());

vi.mock("../../domain/user/userProfile", () => ({
  useUserProfile: () => ({
    profile: { displayName: "Wing", avatarDataUrl: null, background: "" },
    setProfile: vi.fn(),
  }),
  resolveUserDisplayName: (profile: { displayName: string }, fallback: string) =>
    profile.displayName.trim() || fallback,
}));

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

import { SubscriptionsShell } from "./SubscriptionsShell";
import { SubscriptionsMinePage } from "./SubscriptionsMinePage";
import { SubscriptionsAccountPage } from "./SubscriptionsAccountPage";
import { i18n, wrapWithI18n } from "../../test/i18nHarness";
import { setAppLocale } from "../../i18n/locale";
import { calendarShareApiMocks, resetCalendarShareApiMocks } from "../../test/calendarShareApiMock";
import { resetCalendarShareCatalogForTests } from "../../domain/calendarShare/useCalendarShareCatalog";

describe("SubscriptionsShell", () => {
  let mount: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");
    resetCalendarShareCatalogForTests();
    resetCalendarShareApiMocks();
    calendarShareApiMocks.fetchCalendarShareTimezone.mockResolvedValue({
      timezone: "Asia/Taipei",
      suggestedTimezone: "Asia/Taipei",
      pendingPublicTimezone: false,
      lastPublicTimezone: "Asia/Taipei",
    });
    mount = document.createElement("div");
    document.body.appendChild(mount);
    root = createRoot(mount);
  });

  afterEach(() => {
    act(() => root.unmount());
    mount.remove();
    resetCalendarShareCatalogForTests();
  });

  async function renderShell(path: string) {
    calendarShareApiMocks.fetchCalendarShareSession.mockResolvedValue({
      connected: false,
      baseUrl: "http://127.0.0.1:8787",
      handle: "",
      status: "disconnected",
    });
    calendarShareApiMocks.fetchCalendarShareSubscriptions.mockResolvedValue({
      items: [],
      ownHandle: "",
    });
    await act(async () => {
      root.render(
        wrapWithI18n(
          createElement(
            MemoryRouter,
            { initialEntries: [path] },
            createElement(
              Routes,
              null,
              createElement(
                Route,
                { path: "/subscriptions", element: createElement(SubscriptionsShell) },
                createElement(Route, { path: "mine", element: createElement(SubscriptionsMinePage) }),
                createElement(Route, { path: "account", element: createElement(SubscriptionsAccountPage) }),
              ),
            ),
          ),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("renders four tabs without identity chrome on mine", async () => {
    await renderShell("/subscriptions/mine");
    const hrefs = [...document.querySelectorAll("a")].map((el) => el.getAttribute("href"));
    expect(hrefs).toContain("/subscriptions/mine");
    expect(hrefs).toContain("/subscriptions/published");
    expect(hrefs).toContain("/subscriptions/account");
    expect(hrefs).toContain("/subscriptions/search");
    expect(hrefs.indexOf("/subscriptions/mine")).toBeLessThan(hrefs.indexOf("/subscriptions/published"));
    expect(hrefs.indexOf("/subscriptions/published")).toBeLessThan(hrefs.indexOf("/subscriptions/account"));
    expect(hrefs.indexOf("/subscriptions/account")).toBeLessThan(hrefs.indexOf("/subscriptions/search"));
    expect(document.querySelector('[data-testid="subscriptions-identity-panel"]')).toBeNull();
    const statusIcon = document.querySelector('[data-testid="calendar-share-connection-status"]');
    expect(statusIcon).toBeTruthy();
    expect(statusIcon?.getAttribute("data-availability")).toBe("loggedOut");
    expect(document.querySelector('[data-testid="subscriptions-mine-empty"]')).toBeTruthy();
  });

  it("renders the identity panel only on the account tab", async () => {
    await renderShell("/subscriptions/account");
    expect(document.querySelector('[data-testid="subscriptions-identity-panel"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="calendar-share-login"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="calendar-share-connection-status"]')).toBeNull();
  });
});
