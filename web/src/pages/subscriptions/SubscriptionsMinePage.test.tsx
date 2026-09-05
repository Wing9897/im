import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/calendarShare", async () =>
  (
    await import("../../test/calendarShareApiMock")
  ).calendarShareApiModuleMock(),
);

import { SubscriptionsMinePage } from "./SubscriptionsMinePage";
import { i18n, wrapWithI18n } from "../../test/i18nHarness";
import { setAppLocale } from "../../i18n/locale";
import {
  calendarShareApiMocks,
  resetCalendarShareApiMocks,
} from "../../test/calendarShareApiMock";
import { invalidateCalendarShareCatalog } from "../../domain/calendarShare/useCalendarShareCatalog";
import { resetCalendarShareCatalogForTests } from "../../domain/calendarShare/useCalendarShareCatalog.testing";
describe("SubscriptionsMinePage", () => {
  let mount: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");
    resetCalendarShareCatalogForTests();
    resetCalendarShareApiMocks();
    calendarShareApiMocks.fetchCalendarShareSession.mockResolvedValue({
      connected: true,
      baseUrl: "http://127.0.0.1:8787",
      handle: "Wing",
      status: "connected",
    });
    calendarShareApiMocks.fetchCalendarShareSubscriptions.mockResolvedValue({
      items: [
        {
          handle: "DemoPub",
          slug: "Open",
          cover: "data:image/jpeg;base64,cover",
          description: "Open to everyone",
        },
      ],
      ownHandle: "Wing",
    });
    calendarShareApiMocks.removeCalendarShareSubscription.mockResolvedValue({
      items: [],
      ownHandle: "Wing",
    });
    mount = document.createElement("div");
    document.body.appendChild(mount);
    root = createRoot(mount);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    mount.remove();
    resetCalendarShareCatalogForTests();
  });

  it("shows removing wait state while unsubscribe is in flight", async () => {
    let resolveRemove: (value: unknown) => void = () => {};
    calendarShareApiMocks.removeCalendarShareSubscription.mockReturnValue(
      new Promise((resolve) => {
        resolveRemove = resolve;
      }),
    );
    await act(async () => {
      root.render(
        wrapWithI18n(
          createElement(
            MemoryRouter,
            null,
            createElement(SubscriptionsMinePage),
          ),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    const remove = document.querySelector(
      '[data-testid="subscriptions-remove-DemoPub/Open"]',
    ) as HTMLButtonElement;
    expect(remove.textContent).toContain("Remove");
    await act(async () => {
      remove.click();
      await Promise.resolve();
    });
    expect(remove.disabled).toBe(true);
    expect(remove.getAttribute("aria-busy")).toBe("true");
    expect(remove.textContent).toContain("Removing…");
    await act(async () => {
      resolveRemove({ items: [], ownHandle: "Wing" });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it("lists subscriptions and removes one", async () => {
    await act(async () => {
      root.render(
        wrapWithI18n(
          createElement(
            MemoryRouter,
            null,
            createElement(SubscriptionsMinePage),
          ),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      document.querySelector('[data-testid="subscriptions-mine-list"]')
        ?.textContent,
    ).toContain("DemoPub/Open");
    expect(
      document.querySelector(
        '[data-testid="subscriptions-mine-card-DemoPub/Open"]',
      ),
    ).toBeTruthy();
    expect(
      document.querySelector(
        '[data-testid="subscriptions-mine-card-DemoPub/Open"]',
      )?.textContent,
    ).toContain("Open to everyone");
    expect(
      document.querySelector('[data-testid="subscriptions-mine-list"]')
        ?.innerHTML,
    ).toContain("xl:grid-cols-4");
    expect(
      document.querySelector('[data-testid="subscriptions-mine-filter"]'),
    ).toBeTruthy();
    expect(mount.textContent).not.toContain(
      "unsubscribes it on the calendar server",
    );
    expect(mount.textContent).not.toContain("Subscribed calendars");
    calendarShareApiMocks.fetchCalendarShareSubscriptions.mockResolvedValue({
      items: [],
      ownHandle: "Wing",
    });
    await act(async () => {
      (
        document.querySelector(
          '[data-testid="subscriptions-remove-DemoPub/Open"]',
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      calendarShareApiMocks.removeCalendarShareSubscription,
    ).toHaveBeenCalledWith("DemoPub", "Open");
    expect(
      calendarShareApiMocks.fetchCalendarShareSubscriptions.mock.calls.length,
    ).toBe(1);
    expect(
      document.querySelector('[data-testid="subscriptions-mine-empty"]'),
    ).toBeTruthy();
    expect(
      document.querySelector('[data-testid="subscriptions-mine-filter"]'),
    ).toBeTruthy();
    expect(mount.textContent).toContain("No subscriptions yet.");
  });

  it("treats a catalog 404 as an empty mine list, not an error banner", async () => {
    calendarShareApiMocks.fetchCalendarShareSubscriptions.mockRejectedValue(
      new Error("Not found"),
    );
    await act(async () => {
      root.render(
        wrapWithI18n(
          createElement(
            MemoryRouter,
            null,
            createElement(SubscriptionsMinePage),
          ),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      document.querySelector('[data-testid="subscriptions-mine-empty"]'),
    ).toBeTruthy();
    expect(
      document.querySelector('[data-testid="subscriptions-mine-filter"]'),
    ).toBeTruthy();
    expect(mount.textContent).toContain("No subscriptions yet.");
    expect(mount.textContent).not.toMatch(/not found/i);
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it("filters listed cards by handle and slug without calling search", async () => {
    calendarShareApiMocks.fetchCalendarShareSubscriptions.mockResolvedValue({
      items: [
        { handle: "DemoPub", slug: "Open" },
        { handle: "Alice", slug: "Work" },
      ],
      ownHandle: "Wing",
    });
    await act(async () => {
      root.render(
        wrapWithI18n(
          createElement(
            MemoryRouter,
            null,
            createElement(SubscriptionsMinePage),
          ),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      document.querySelector(
        '[data-testid="subscriptions-mine-card-DemoPub/Open"]',
      ),
    ).toBeTruthy();
    expect(
      document.querySelector(
        '[data-testid="subscriptions-mine-card-Alice/Work"]',
      ),
    ).toBeTruthy();
    const input = document.querySelector(
      '[data-testid="subscriptions-mine-filter"]',
    ) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    act(() => {
      setter.call(input, "alice");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(
      document.querySelector(
        '[data-testid="subscriptions-mine-card-Alice/Work"]',
      ),
    ).toBeTruthy();
    expect(
      document.querySelector(
        '[data-testid="subscriptions-mine-card-DemoPub/Open"]',
      ),
    ).toBeNull();
    expect(
      calendarShareApiMocks.fetchCalendarShareSearch,
    ).not.toHaveBeenCalled();
    act(() => {
      setter.call(input, "zzz");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(
      document.querySelector('[data-testid="subscriptions-mine-filter-empty"]'),
    ).toBeTruthy();
    expect(
      document.querySelector('[data-testid="subscriptions-mine-empty"]'),
    ).toBeNull();
  });

  it("shows loading instead of empty while the catalog is in flight", async () => {
    let resolveSession: (value: unknown) => void = () => {};
    calendarShareApiMocks.fetchCalendarShareSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );
    await act(async () => {
      root.render(
        wrapWithI18n(
          createElement(
            MemoryRouter,
            null,
            createElement(SubscriptionsMinePage),
          ),
        ),
      );
      await Promise.resolve();
    });
    expect(
      document.querySelector('[data-testid="subscriptions-mine-list-loading"]'),
    ).toBeTruthy();
    expect(
      document.querySelector('[data-testid="subscriptions-mine-empty"]'),
    ).toBeNull();
    expect(mount.textContent).not.toContain("Sign in to calendar share");
    await act(async () => {
      resolveSession({
        connected: true,
        baseUrl: "http://127.0.0.1:8787",
        handle: "Wing",
        status: "connected",
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      document.querySelector('[data-testid="subscriptions-mine-list"]'),
    ).toBeTruthy();
  });

  it("greys remove actions when calendar share is unreachable", async () => {
    await act(async () => {
      root.render(
        wrapWithI18n(
          createElement(
            MemoryRouter,
            null,
            createElement(SubscriptionsMinePage),
          ),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    calendarShareApiMocks.fetchCalendarShareSubscriptions.mockRejectedValue({
      status: 502,
      message: "calendar share 502",
    });
    await act(async () => {
      await invalidateCalendarShareCatalog();
    });
    const statusIcon = document.querySelector(
      '[data-testid="calendar-share-connection-status"]',
    );
    expect(statusIcon?.getAttribute("data-availability")).toBe("offline");
    expect(statusIcon?.getAttribute("title")).toMatch(/unreachable/i);
    const list = document.querySelector(
      '[data-testid="subscriptions-mine-list"]',
    );
    expect(list?.className).toContain("opacity-50");
    expect(
      (
        document.querySelector(
          '[data-testid="subscriptions-remove-DemoPub/Open"]',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
