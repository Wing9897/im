import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/calendarShare", async () =>
  (await import("../../test/calendarShareApiMock")).calendarShareApiModuleMock());

import { SubscriptionsSearchPage } from "./SubscriptionsSearchPage";
import { i18n, wrapWithI18n } from "../../test/i18nHarness";
import { setAppLocale } from "../../i18n/locale";
import { calendarShareApiMocks, resetCalendarShareApiMocks } from "../../test/calendarShareApiMock";
import { resetCalendarShareCatalogForTests } from "../../domain/calendarShare/useCalendarShareCatalog";

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
        { handle: "DemoPub", slug: "Open", visibility: "details" },
        { handle: "Alice", slug: "Work", visibility: "busy" },
      ],
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
          createElement(MemoryRouter, null, createElement(SubscriptionsSearchPage)),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("lists search results and marks already-subscribed calendars", async () => {
    await renderPage();
    const results = document.querySelector('[data-testid="subscriptions-search-results"]');
    expect(results?.textContent).toContain("DemoPub/Open");
    expect(results?.textContent).toContain("Alice/Work");
    expect(results?.textContent).toContain("Subscribed");
    expect(document.querySelector('[data-testid="subscriptions-add-Alice/Work"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="subscriptions-add-DemoPub/Open"]')).toBeNull();
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
    const add = document.querySelector('[data-testid="subscriptions-add-Alice/Work"]') as HTMLButtonElement;
    expect(add).toBeTruthy();
    expect(add.disabled).toBe(true);
  });

  it("uses catalog ownHandle for the path form when session.handle is empty", async () => {
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
    const input = document.querySelector('[data-testid="subscribe-path"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      setter.call(input, "Wing/Work");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(document.body.textContent).toContain("You cannot subscribe to your own calendar.");
    expect((document.querySelector('[data-testid="subscribe-path-submit"]') as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
