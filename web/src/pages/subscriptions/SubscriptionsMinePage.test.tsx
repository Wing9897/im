import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/calendarShare", async () =>
  (await import("../../test/calendarShareApiMock")).calendarShareApiModuleMock());

import { SubscriptionsMinePage } from "./SubscriptionsMinePage";
import { i18n, wrapWithI18n } from "../../test/i18nHarness";
import { setAppLocale } from "../../i18n/locale";
import { calendarShareApiMocks, resetCalendarShareApiMocks } from "../../test/calendarShareApiMock";
import { resetCalendarShareCatalogForTests } from "../../domain/calendarShare/useCalendarShareCatalog";

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
      items: [{ handle: "DemoPub", slug: "Open" }],
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

  it("lists subscriptions and removes one", async () => {
    await act(async () => {
      root.render(
        wrapWithI18n(
          createElement(MemoryRouter, null, createElement(SubscriptionsMinePage)),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(document.querySelector('[data-testid="subscriptions-mine-list"]')?.textContent).toContain(
      "DemoPub/Open",
    );
    expect(mount.textContent).toContain("unsubscribes it on the calendar server");
    calendarShareApiMocks.fetchCalendarShareSubscriptions.mockResolvedValue({
      items: [],
      ownHandle: "Wing",
    });
    await act(async () => {
      (document.querySelector('[data-testid="subscriptions-remove-DemoPub/Open"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(calendarShareApiMocks.removeCalendarShareSubscription).toHaveBeenCalledWith("DemoPub", "Open");
  });
});
