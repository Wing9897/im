import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../api/calendarShare", async () =>
  (
    await import("../../../test/calendarShareApiMock")
  ).calendarShareApiModuleMock(),
);

vi.mock("../../../domain/user/userProfile", () => ({
  useUserProfile: () => ({
    profile: { displayName: "Wing", avatarDataUrl: null, background: "" },
    setProfile: vi.fn(),
  }),
  resolveUserDisplayName: (
    profile: { displayName: string },
    fallback: string,
  ) => profile.displayName.trim() || fallback,
}));

vi.mock("../../../context/ToastContext", async () =>
  (await import("../../../test/context-mocks")).toastContextModuleMock(),
);

import { SubscriptionsShell } from "./SubscriptionsShell";
import { i18n, wrapWithI18n } from "../../../test/i18nHarness";
import {
  mountSubscriptionsPage,
  unmountSubscriptionsPage,
} from "./subscriptionsPageTestHarness";
import { setAppLocale } from "../../../i18n/locale";
import {
  calendarShareApiMocks,
  resetCalendarShareApiMocks,
} from "../../../test/calendarShareApiMock";
import { resetCalendarShareCatalogForTests } from "../../../test/helpers/useCalendarShareCatalog.testing";
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
    ({ mount, root } = mountSubscriptionsPage());
  });

  afterEach(() => {
    unmountSubscriptionsPage(root, mount);
    resetCalendarShareCatalogForTests();
  });

  async function renderShell(tab: "mine" | "account" = "mine") {
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
            null,
            createElement(SubscriptionsShell, { tab }),
          ),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  function tabLabels(): string[] {
    return [...document.querySelectorAll('[role="tab"]')].map((el) => el.textContent ?? "");
  }

  it("renders four tabs without identity chrome on mine", async () => {
    await renderShell("mine");
    expect(tabLabels()).toEqual([
      "My subscriptions",
      "My published",
      "Calendar share",
      "Find calendars",
    ]);
    expect(
      document.querySelector('[data-testid="subscriptions-identity-panel"]'),
    ).toBeNull();
    const statusIcon = document.querySelector(
      '[data-testid="calendar-share-connection-status"]',
    );
    expect(statusIcon).toBeTruthy();
    expect(statusIcon?.getAttribute("data-availability")).toBe("loggedOut");
    expect(
      document.querySelector('[data-testid="subscriptions-mine-empty"]'),
    ).toBeTruthy();
  });

  it("renders the identity panel only on the account tab", async () => {
    await renderShell("account");
    expect(
      document.querySelector('[data-testid="subscriptions-identity-panel"]'),
    ).toBeTruthy();
    expect(
      document.querySelector('[data-testid="calendar-share-login"]'),
    ).toBeTruthy();
    expect(
      document.querySelector(
        '[data-testid="calendar-share-connection-status"]',
      ),
    ).toBeNull();
  });
});
