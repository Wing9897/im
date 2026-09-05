import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/calendarShare", async () =>
  (
    await import("../../test/calendarShareApiMock")
  ).calendarShareApiModuleMock(),
);

import { SubscriptionsSearchPage } from "./SubscriptionsSearchPage";
import { SubscriptionsMinePage } from "./SubscriptionsMinePage";
import { i18n, wrapWithI18n } from "../../test/i18nHarness";
import { setAppLocale } from "../../i18n/locale";
import {
  calendarShareApiMocks,
  resetCalendarShareApiMocks,
} from "../../test/calendarShareApiMock";
import { applyCalendarShareCatalogItems } from "../../domain/calendarShare/useCalendarShareCatalog";
import { resetCalendarShareCatalogForTests } from "../../domain/calendarShare/useCalendarShareCatalog.testing";
describe("SubscriptionsSearchPage", () => {
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
      items: [{ handle: "DemoPub", slug: "Open" }],
      ownHandle: "Wing",
    });
    calendarShareApiMocks.fetchCalendarShareSearch.mockResolvedValue({
      items: [
        {
          handle: "DemoPub",
          slug: "Open",
          hitKind: "listing" as const,
          publicVisibility: "public" as const,
          cover: "data:image/jpeg;base64,cover-a",
          description: "Open to everyone",
        },
        {
          handle: "Alice",
          slug: "Work",
          hitKind: "listing" as const,
          publicVisibility: "public_busy" as const,
          cover: "data:image/jpeg;base64,cover-b",
          description: "",
        },
      ],
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

  async function renderPage() {
    await act(async () => {
      root.render(
        wrapWithI18n(
          createElement(
            MemoryRouter,
            null,
            createElement(SubscriptionsSearchPage),
          ),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("lists search results and marks already-subscribed calendars", async () => {
    await renderPage();
    expect(calendarShareApiMocks.fetchCalendarShareSearch).toHaveBeenCalledWith(
      "",
    );
    const results = document.querySelector(
      '[data-testid="subscriptions-search-recommended"]',
    );
    expect(results?.textContent).toContain("DemoPub/Open");
    expect(results?.textContent).toContain("Alice/Work");
    expect(
      document.querySelector(
        '[data-testid="subscriptions-unsubscribe-DemoPub/Open"]',
      ),
    ).toBeTruthy();
    expect(
      document.querySelector(
        '[data-testid="subscriptions-search-card-Alice/Work"]',
      ),
    ).toBeTruthy();
    expect(
      document.querySelector(
        '[data-testid="subscriptions-search-card-DemoPub/Open"]',
      )?.textContent,
    ).toContain("Public");
    expect(
      document.querySelector(
        '[data-testid="subscriptions-search-card-DemoPub/Open"]',
      )?.textContent,
    ).not.toContain("Public busy");
    expect(
      document.querySelector(
        '[data-testid="subscriptions-search-card-Alice/Work"]',
      )?.textContent,
    ).toContain("Public busy");
    expect(
      document.querySelector(
        '[data-testid="subscriptions-search-card-DemoPub/Open"]',
      )?.textContent,
    ).toContain("Open to everyone");
    expect(
      document.querySelector('[data-testid="subscriptions-search-recommended"]')
        ?.innerHTML,
    ).toContain("xl:grid-cols-4");
    expect(
      document.querySelector('[data-testid="subscriptions-add-Alice/Work"]'),
    ).toBeTruthy();
    expect(
      document.querySelector('[data-testid="subscriptions-add-DemoPub/Open"]'),
    ).toBeNull();
    expect(
      document.querySelector(
        '[data-testid="subscriptions-unsubscribe-DemoPub/Open"]',
      ),
    ).toBeTruthy();
    expect(document.querySelector('[data-testid="subscribe-path"]')).toBeNull();
    expect(document.body.textContent).not.toContain(
      "Recommended public calendars",
    );
    expect(document.body.textContent).not.toContain("Search public calendars");
    expect(document.body.textContent).not.toContain("Add a closed calendar");
    expect(
      document.querySelector('[data-testid="subscriptions-search-hint"]')
        ?.textContent,
    ).toContain(
      "Private group calendars: paste handle/slug. The publisher must add your handle on My published",
    );
  });

  it("shows grant badges for grant-only hits, not listing Public labels", async () => {
    calendarShareApiMocks.fetchCalendarShareSearch.mockResolvedValue({
      items: [
        {
          handle: "DemoPub",
          slug: "Closed",
          hitKind: "grant" as const,
          visibility: "details" as const,
          cover: "data:image/jpeg;base64,cover-c",
          description: "Private group grant",
        },
        {
          handle: "DemoPub",
          slug: "ClosedBusy",
          hitKind: "grant" as const,
          visibility: "busy" as const,
          cover: "data:image/jpeg;base64,cover-d",
          description: "",
        },
      ],
    });
    await renderPage();
    const detailsCard = document.querySelector(
      '[data-testid="subscriptions-search-card-DemoPub/Closed"]',
    );
    expect(detailsCard?.textContent).toContain("Private group grant");
    expect(
      document.querySelector(
        '[data-testid="subscriptions-search-visibility-DemoPub/Closed"]',
      )?.textContent,
    ).toBe("Private");
    expect(
      document.querySelector(
        '[data-testid="subscriptions-search-visibility-DemoPub/ClosedBusy"]',
      )?.textContent,
    ).toBe("Private busy");
  });

  it("loads recommended calendars with empty q on mount", async () => {
    await renderPage();
    expect(
      calendarShareApiMocks.fetchCalendarShareSearch.mock.calls[0],
    ).toEqual([""]);
    expect(
      document.querySelector(
        '[data-testid="subscriptions-search-recommended"]',
      ),
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain(
      "Recommended public calendars",
    );
    expect(document.body.textContent).not.toContain("Search public calendars");
    expect(document.querySelector("h2")).toBeNull();
    expect(document.querySelector("h3")).toBeNull();
  });

  it("treats a search 404 as an empty recommended list, not Not found", async () => {
    calendarShareApiMocks.fetchCalendarShareSearch.mockRejectedValue(
      new Error("Not found"),
    );
    await renderPage();
    expect(
      document.querySelector(
        '[data-testid="subscriptions-search-recommended-empty"]',
      ),
    ).toBeTruthy();
    expect(document.body.textContent).toContain("No public calendars yet.");
    expect(document.body.textContent).not.toMatch(/not found/i);
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it("cannot add when logged out", async () => {
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
    await renderPage();
    const statusIcon = document.querySelector(
      '[data-testid="calendar-share-connection-status"]',
    );
    expect(statusIcon).toBeTruthy();
    expect(statusIcon?.getAttribute("data-availability")).toBe("loggedOut");
    expect(
      document.querySelector('[data-testid="calendar-share-login"]'),
    ).toBeNull();
    const add = document.querySelector(
      '[data-testid="subscriptions-add-Alice/Work"]',
    ) as HTMLButtonElement;
    expect(add).toBeTruthy();
    expect(add.disabled).toBe(true);
    expect(
      (
        document.querySelector(
          '[data-testid="subscriptions-search-submit"]',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(
      document.querySelector('[data-testid="subscriptions-search-recommended"]')
        ?.className,
    ).toContain("opacity-50");
  });

  it("uses catalog ownHandle for path subscribe when session.handle is empty", async () => {
    calendarShareApiMocks.fetchCalendarShareSession.mockResolvedValue({
      connected: true,
      baseUrl: "http://127.0.0.1:8787",
      handle: "",
      status: "connected",
    });
    calendarShareApiMocks.fetchCalendarShareSubscriptions.mockResolvedValue({
      items: [],
      ownHandle: "Wing",
    });
    await renderPage();
    const input = document.querySelector(
      '[data-testid="subscriptions-search-query"]',
    ) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    act(() => {
      setter.call(input, "Wing/Work");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(
      document.querySelector('[data-testid="subscriptions-search-hint"]')
        ?.textContent,
    ).toContain("You cannot subscribe to your own calendar.");
    expect(
      (
        document.querySelector(
          '[data-testid="subscriptions-search-submit"]',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      document.querySelector(
        '[data-testid="subscriptions-search-recommended"]',
      ),
    ).toBeNull();
  });

  it("applies POST body to catalog without an extra GET", async () => {
    calendarShareApiMocks.addCalendarShareSubscription.mockResolvedValue({
      items: [
        { handle: "DemoPub", slug: "Open" },
        { handle: "Alice", slug: "Work" },
      ],
      ownHandle: "Wing",
    });
    await renderPage();
    const before =
      calendarShareApiMocks.fetchCalendarShareSubscriptions.mock.calls.length;
    await act(async () => {
      (
        document.querySelector(
          '[data-testid="subscriptions-add-Alice/Work"]',
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      calendarShareApiMocks.addCalendarShareSubscription,
    ).toHaveBeenCalledWith({
      handle: "Alice",
      slug: "Work",
    });
    expect(
      calendarShareApiMocks.fetchCalendarShareSubscriptions.mock.calls.length,
    ).toBe(before);
    expect(
      document.querySelector('[data-testid="subscriptions-add-Alice/Work"]'),
    ).toBeNull();
    expect(
      document.querySelector(
        '[data-testid="subscriptions-unsubscribe-Alice/Work"]',
      ),
    ).toBeTruthy();
  });

  it("does not search while typing; only button click or Enter submits", async () => {
    await renderPage();
    const callsAfterMount =
      calendarShareApiMocks.fetchCalendarShareSearch.mock.calls.length;
    expect(callsAfterMount).toBe(1);
    expect(
      calendarShareApiMocks.fetchCalendarShareSearch.mock.calls[0],
    ).toEqual([""]);
    const input = document.querySelector(
      '[data-testid="subscriptions-search-query"]',
    ) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    act(() => {
      setter.call(input, "Al");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      setter.call(input, "Alice");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(
      calendarShareApiMocks.fetchCalendarShareSearch.mock.calls.length,
    ).toBe(callsAfterMount);
    expect(
      document.querySelector('[data-testid="subscriptions-search-recommended"]')
        ?.textContent,
    ).toContain("Alice/Work");
    expect(
      document.querySelector('[data-testid="subscriptions-search-results"]'),
    ).toBeNull();
    calendarShareApiMocks.fetchCalendarShareSearch.mockImplementation(
      async (q: string) => {
        if (!q) {
          return {
            items: [
              {
                handle: "DemoPub",
                slug: "Open",
                hitKind: "listing" as const,
                publicVisibility: "public" as const,
              },
              {
                handle: "Alice",
                slug: "Work",
                hitKind: "listing" as const,
                publicVisibility: "public_busy" as const,
              },
            ],
          };
        }
        return {
          items: [
            {
              handle: "Alice",
              slug: "Work",
              hitKind: "listing" as const,
              publicVisibility: "public_busy" as const,
            },
          ],
        };
      },
    );
    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      input.closest("form")?.requestSubmit();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(calendarShareApiMocks.fetchCalendarShareSearch).toHaveBeenCalledWith(
      "Alice",
    );
    expect(
      document.querySelector('[data-testid="subscriptions-search-results"]')
        ?.textContent,
    ).toContain("Alice/Work");
  });

  it("reloads recommended calendars on empty submit", async () => {
    await renderPage();
    const before =
      calendarShareApiMocks.fetchCalendarShareSearch.mock.calls.length;
    await act(async () => {
      (
        document.querySelector(
          '[data-testid="subscriptions-search-submit"]',
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      calendarShareApiMocks.fetchCalendarShareSearch.mock.calls.length,
    ).toBe(before + 1);
    expect(
      calendarShareApiMocks.fetchCalendarShareSearch.mock.calls.at(-1),
    ).toEqual([""]);
  });

  it("disables submit while search is in flight to prevent double-submit", async () => {
    let resolveSearch: (value: unknown) => void = () => {};
    calendarShareApiMocks.fetchCalendarShareSearch.mockReturnValue(
      new Promise((resolve) => {
        resolveSearch = resolve;
      }),
    );
    await act(async () => {
      root.render(
        wrapWithI18n(
          createElement(
            MemoryRouter,
            null,
            createElement(SubscriptionsSearchPage),
          ),
        ),
      );
      await Promise.resolve();
    });
    const submit = document.querySelector(
      '[data-testid="subscriptions-search-submit"]',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(submit.getAttribute("aria-busy")).toBe("true");
    expect(submit.textContent).toContain("Searching…");
    await act(async () => {
      resolveSearch({
        items: [
          {
            handle: "DemoPub",
            slug: "Open",
            hitKind: "listing" as const,
            publicVisibility: "public" as const,
          },
          {
            handle: "Alice",
            slug: "Work",
            hitKind: "listing" as const,
            publicVisibility: "public_busy" as const,
          },
        ],
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(submit.disabled).toBe(false);
    expect(submit.getAttribute("aria-busy")).toBeNull();
  });

  it("shows adding wait state on subscribe buttons while add is in flight", async () => {
    let resolveAdd: (value: unknown) => void = () => {};
    calendarShareApiMocks.addCalendarShareSubscription.mockReturnValue(
      new Promise((resolve) => {
        resolveAdd = resolve;
      }),
    );
    await renderPage();
    const add = document.querySelector(
      '[data-testid="subscriptions-add-Alice/Work"]',
    ) as HTMLButtonElement;
    expect(add.getAttribute("aria-label")).toBe("Subscribe");
    await act(async () => {
      add.click();
      await Promise.resolve();
    });
    expect(add.disabled).toBe(true);
    expect(add.getAttribute("aria-busy")).toBe("true");
    expect(add.getAttribute("aria-label")).toBe("Adding…");
    await act(async () => {
      resolveAdd({
        items: [
          { handle: "DemoPub", slug: "Open" },
          { handle: "Alice", slug: "Work" },
        ],
        ownHandle: "Wing",
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it("shows a localized rate-limit message instead of failing silently", async () => {
    const { CalendarShareRateLimitError } =
      await import("../../domain/calendarShare/calendarShareRateLimit");
    calendarShareApiMocks.fetchCalendarShareSearch.mockRejectedValue(
      new CalendarShareRateLimitError("search"),
    );
    await renderPage();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "Too many requests",
    );
    expect(document.querySelector('[role="alert"]')?.textContent).not.toMatch(
      /RATE_LIMITED/,
    );
  });

  it("filters the list on submit using the search API", async () => {
    calendarShareApiMocks.fetchCalendarShareSearch.mockImplementation(
      async (q: string) => {
        if (!q) {
          return {
            items: [
              {
                handle: "DemoPub",
                slug: "Open",
                hitKind: "listing" as const,
                publicVisibility: "public" as const,
              },
              {
                handle: "Alice",
                slug: "Work",
                hitKind: "listing" as const,
                publicVisibility: "public_busy" as const,
              },
            ],
          };
        }
        return {
          items: [
            {
              handle: "Alice",
              slug: "Work",
              hitKind: "listing" as const,
              publicVisibility: "public_busy" as const,
            },
          ],
        };
      },
    );
    await renderPage();
    const input = document.querySelector(
      '[data-testid="subscriptions-search-query"]',
    ) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    act(() => {
      setter.call(input, "Alice");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      (
        document.querySelector(
          '[data-testid="subscriptions-search-submit"]',
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(calendarShareApiMocks.fetchCalendarShareSearch).toHaveBeenCalledWith(
      "Alice",
    );
    const results = document.querySelector(
      '[data-testid="subscriptions-search-results"]',
    );
    expect(results?.textContent).toContain("Alice/Work");
    expect(
      document.querySelector(
        '[data-testid="subscriptions-search-recommended"]',
      ),
    ).toBeNull();
    expect(document.querySelector('[data-testid="subscribe-path"]')).toBeNull();
  });

  it("treats handle/slug as path subscribe instead of search", async () => {
    calendarShareApiMocks.addCalendarShareSubscription.mockResolvedValue({
      items: [
        { handle: "DemoPub", slug: "Open" },
        { handle: "Alice", slug: "Work" },
      ],
      ownHandle: "Wing",
    });
    await renderPage();
    const callsAfterMount =
      calendarShareApiMocks.fetchCalendarShareSearch.mock.calls.length;
    const input = document.querySelector(
      '[data-testid="subscriptions-search-query"]',
    ) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    act(() => {
      setter.call(input, "Alice/Work");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(
      calendarShareApiMocks.fetchCalendarShareSearch.mock.calls.length,
    ).toBe(callsAfterMount);
    expect(
      document.querySelector(
        '[data-testid="subscriptions-search-recommended"]',
      ),
    ).toBeNull();
    await act(async () => {
      (
        document.querySelector(
          '[data-testid="subscriptions-search-submit"]',
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      calendarShareApiMocks.addCalendarShareSubscription,
    ).toHaveBeenCalledWith({
      handle: "Alice",
      slug: "Work",
    });
    expect(
      (
        document.querySelector(
          '[data-testid="subscriptions-search-query"]',
        ) as HTMLInputElement
      ).value,
    ).toBe("");
    expect(
      document.querySelector(
        '[data-testid="subscriptions-search-recommended"]',
      ),
    ).toBeTruthy();
  });

  it("shows invalid path under the single search field", async () => {
    await renderPage();
    const input = document.querySelector(
      '[data-testid="subscriptions-search-query"]',
    ) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    act(() => {
      setter.call(input, "Alice");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(document.body.textContent).not.toContain("Use handle/slug.");
    act(() => {
      setter.call(input, "Alice/");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(
      document.querySelector('[data-testid="subscriptions-search-hint"]')
        ?.textContent,
    ).toContain("Use handle/slug.");
    expect(
      (
        document.querySelector(
          '[data-testid="subscriptions-search-submit"]',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("maps a 403 subscribe to the closed-calendar grant hint", async () => {
    const { ApiRequestError } = await import("../../api/parseApiError");
    calendarShareApiMocks.addCalendarShareSubscription.mockRejectedValue(
      new ApiRequestError(403, { error: "forbidden", message: "Forbidden" }),
    );
    await renderPage();
    await act(async () => {
      (
        document.querySelector(
          '[data-testid="subscriptions-add-Alice/Work"]',
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      document.querySelector('[data-testid="subscriptions-search-hint"]')
        ?.textContent,
    ).toContain("Ask the publisher to add your handle on My published");
  });

  it("unsubscribes from search and shows subscribe again without catalog GET", async () => {
    calendarShareApiMocks.removeCalendarShareSubscription.mockResolvedValue({
      items: [],
      ownHandle: "Wing",
    });
    await renderPage();
    expect(
      document.querySelector(
        '[data-testid="subscriptions-unsubscribe-DemoPub/Open"]',
      ),
    ).toBeTruthy();
    const before =
      calendarShareApiMocks.fetchCalendarShareSubscriptions.mock.calls.length;
    await act(async () => {
      (
        document.querySelector(
          '[data-testid="subscriptions-unsubscribe-DemoPub/Open"]',
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      calendarShareApiMocks.removeCalendarShareSubscription,
    ).toHaveBeenCalledWith("DemoPub", "Open");
    expect(
      calendarShareApiMocks.fetchCalendarShareSubscriptions.mock.calls.length,
    ).toBe(before);
    expect(
      document.querySelector('[data-testid="subscriptions-add-DemoPub/Open"]'),
    ).toBeTruthy();
    expect(
      document.querySelector(
        '[data-testid="subscriptions-unsubscribe-DemoPub/Open"]',
      ),
    ).toBeNull();
  });

  it("shows subscribe on search after mine remove without relying on catalog GET", async () => {
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
    const getCallsAfterMount =
      calendarShareApiMocks.fetchCalendarShareSubscriptions.mock.calls.length;
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
    await vi.waitFor(() => {
      expect(
        document.querySelector('[data-testid="subscriptions-mine-empty"]'),
      ).toBeTruthy();
    });
    calendarShareApiMocks.fetchCalendarShareSubscriptions.mockRejectedValue(
      new Error("rate limited"),
    );
    await act(async () => {
      root.render(
        wrapWithI18n(
          createElement(
            MemoryRouter,
            null,
            createElement(SubscriptionsSearchPage),
          ),
        ),
      );
    });
    await vi.waitFor(() => {
      expect(
        document.querySelector(
          '[data-testid="subscriptions-search-card-DemoPub/Open"]',
        ),
      ).toBeTruthy();
    });
    expect(
      calendarShareApiMocks.fetchCalendarShareSubscriptions.mock.calls.length,
    ).toBe(getCallsAfterMount);
    expect(
      document.querySelector('[data-testid="subscriptions-add-DemoPub/Open"]'),
    ).toBeTruthy();
    expect(
      document.querySelector(
        '[data-testid="subscriptions-unsubscribe-DemoPub/Open"]',
      ),
    ).toBeNull();
  });

  it("reflects applyCalendarShareCatalogItems on search without catalog GET", async () => {
    await renderPage();
    const getCallsAfterMount =
      calendarShareApiMocks.fetchCalendarShareSubscriptions.mock.calls.length;
    calendarShareApiMocks.fetchCalendarShareSubscriptions.mockRejectedValue(
      new Error("rate limited"),
    );
    act(() => {
      applyCalendarShareCatalogItems([], "Wing");
    });
    await act(async () => {
      root.render(
        wrapWithI18n(
          createElement(
            MemoryRouter,
            null,
            createElement(SubscriptionsSearchPage),
          ),
        ),
      );
    });
    await vi.waitFor(() => {
      expect(
        document.querySelector(
          '[data-testid="subscriptions-search-card-DemoPub/Open"]',
        ),
      ).toBeTruthy();
    });
    expect(
      calendarShareApiMocks.fetchCalendarShareSubscriptions.mock.calls.length,
    ).toBe(getCallsAfterMount);
    expect(
      document.querySelector('[data-testid="subscriptions-add-DemoPub/Open"]'),
    ).toBeTruthy();
  });
});
