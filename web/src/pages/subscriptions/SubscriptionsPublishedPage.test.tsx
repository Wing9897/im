import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/calendarShare", async () =>
  (await import("../../test/calendarShareApiMock")).calendarShareApiModuleMock());

vi.mock("../../api/worksets", () => ({
  listWorksets: vi.fn(),
  deleteWorkset: vi.fn(),
}));

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

import { PUBLISHED_PENDING_SYNC_POLL_MS, SubscriptionsPublishedPage } from "./SubscriptionsPublishedPage";
import { SubscriptionsShell } from "./SubscriptionsShell";
import { i18n, wrapWithI18n } from "../../test/i18nHarness";
import { setAppLocale } from "../../i18n/locale";
import { calendarShareApiMocks, resetCalendarShareApiMocks } from "../../test/calendarShareApiMock";
import { resetCalendarShareCatalogForTests } from "../../domain/calendarShare/useCalendarShareCatalog";
import { deleteWorkset, listWorksets } from "../../api/worksets";

const LIVE = {
  worksetId: "ws-1",
  slug: "Ops",
  publicVisibility: "public_busy" as const,
  grants: [],
  lastSyncAt: null,
  lastError: null,
  isSystemWorkset: false,
  worksetName: "Ops",
  worksetMissing: false,
  cover: "data:image/jpeg;base64,cover",
  description: "Ops calendar",
};

const ORPHAN = {
  worksetId: "ws-gone",
  slug: "Orphan",
  publicVisibility: "public" as const,
  grants: [],
  lastSyncAt: null,
  lastError: null,
  isSystemWorkset: false,
  worksetName: "",
  worksetMissing: true,
};

const WORKSET = {
  id: "ws-1",
  name: "Ops",
  isSystem: false,
  notifyEnabled: true,
  externalEnabled: true,
  cover: "data:image/jpeg;base64,cover",
  description: "Ops calendar",
  createdAt: "",
  updatedAt: "",
};

describe("SubscriptionsPublishedPage", () => {
  let mount: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");
    resetCalendarShareCatalogForTests();
    resetCalendarShareApiMocks();
    vi.mocked(deleteWorkset).mockReset();
    vi.mocked(listWorksets).mockReset().mockResolvedValue([WORKSET]);
    calendarShareApiMocks.fetchCalendarShareSession.mockResolvedValue({
      connected: true,
      baseUrl: "http://127.0.0.1:8787",
      handle: "Wing",
      status: "connected",
    });
    calendarShareApiMocks.fetchCalendarShareSubscriptions.mockResolvedValue({
      items: [],
      ownHandle: "Wing",
    });
    calendarShareApiMocks.fetchCalendarSharePublishList.mockResolvedValue({ items: [LIVE] });
    calendarShareApiMocks.fetchCalendarSharePublish.mockResolvedValue(LIVE);
    calendarShareApiMocks.unpublishCalendarSharePublish.mockResolvedValue({ ...LIVE, slug: "" });
    calendarShareApiMocks.syncCalendarSharePublish.mockResolvedValue(LIVE);
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
    vi.useRealTimers();
  });

  async function renderPage() {
    await act(async () => {
      root.render(
        wrapWithI18n(
          createElement(MemoryRouter, null, createElement(SubscriptionsPublishedPage)),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  async function renderShell(path: string) {
    await act(async () => {
      root.render(
        wrapWithI18n(
          createElement(MemoryRouter, {
            initialEntries: [path],
            children: createElement(
              Routes,
              null,
              createElement(
                Route,
                { path: "/subscriptions", element: createElement(SubscriptionsShell) },
                createElement(Route, { path: "mine", element: createElement("div", { "data-testid": "mine-stub" }) }),
                createElement(Route, {
                  path: "published",
                  element: createElement(SubscriptionsPublishedPage),
                }),
                createElement(Route, { path: "account", element: createElement("div", { "data-testid": "account-stub" }) }),
                createElement(Route, { path: "search", element: createElement("div", { "data-testid": "search-stub" }) }),
              ),
            ),
          }),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("shows mine / published / account / search tabs and the published route", async () => {
    await renderShell("/subscriptions/published");
    const shell = document.querySelector('[data-testid="subscriptions-shell"]');
    expect(shell?.textContent).toContain("My subscriptions");
    expect(shell?.textContent).toContain("My published");
    expect(shell?.textContent).toContain("Calendar share");
    expect(shell?.textContent).toContain("Find calendars");
    const hrefs = [...document.querySelectorAll("a")].map((el) => el.getAttribute("href"));
    expect(hrefs).toContain("/subscriptions/mine");
    expect(hrefs).toContain("/subscriptions/published");
    expect(hrefs).toContain("/subscriptions/account");
    expect(hrefs).toContain("/subscriptions/search");
    expect(document.querySelector('[data-testid="subscriptions-published-list"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="subscriptions-published-list"]')?.textContent).toContain(
      "Public busy",
    );
    expect(document.querySelector('[data-testid="subscriptions-published-list"]')?.textContent).toContain(
      "Ops calendar",
    );
    expect(document.querySelector('[data-testid="subscriptions-published-list"]')?.innerHTML).toContain(
      "xl:grid-cols-4",
    );
    expect(document.querySelector('[data-testid="subscriptions-published-filter"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="subscriptions-shell"] > .mt-lg')).toBeNull();
    expect(hrefs.indexOf("/subscriptions/mine")).toBeLessThan(hrefs.indexOf("/subscriptions/published"));
    expect(hrefs.indexOf("/subscriptions/published")).toBeLessThan(hrefs.indexOf("/subscriptions/account"));
    expect(hrefs.indexOf("/subscriptions/account")).toBeLessThan(hrefs.indexOf("/subscriptions/search"));
  });

  it("surfaces lastError on the published card", async () => {
    calendarShareApiMocks.fetchCalendarSharePublishList.mockResolvedValue({
      items: [{ ...LIVE, lastError: "Calendar share request failed" }],
    });
    await renderPage();
    expect(document.querySelector('[data-testid="subscriptions-published-error-ws-1"]')?.textContent).toContain(
      "Calendar share request failed",
    );
    expect(document.querySelector('[data-testid="subscriptions-published-pending-ws-1"]')).toBeNull();
  });

  it("shows pending automatic update when dirty and not failed", async () => {
    calendarShareApiMocks.fetchCalendarSharePublishList.mockResolvedValue({
      items: [{ ...LIVE, pendingSync: true }],
    });
    await renderPage();
    expect(document.querySelector('[data-testid="subscriptions-published-pending-ws-1"]')?.textContent).toContain(
      "Pending automatic update",
    );
  });

  it("polls the publish list while pendingSync is set and drops the badge when clear", async () => {
    vi.useFakeTimers();
    calendarShareApiMocks.fetchCalendarSharePublishList.mockResolvedValue({
      items: [{ ...LIVE, pendingSync: true }],
    });
    await renderPage();
    expect(calendarShareApiMocks.fetchCalendarSharePublishList).toHaveBeenCalledTimes(1);
    calendarShareApiMocks.fetchCalendarSharePublishList.mockResolvedValue({
      items: [{ ...LIVE, pendingSync: false }],
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PUBLISHED_PENDING_SYNC_POLL_MS);
    });
    expect(calendarShareApiMocks.fetchCalendarSharePublishList.mock.calls.length).toBeGreaterThan(1);
    expect(document.querySelector('[data-testid="subscriptions-published-pending-ws-1"]')).toBeNull();
  });

  it("shows empty copy and opens the publish form in a modal", async () => {
    calendarShareApiMocks.fetchCalendarSharePublishList.mockResolvedValue({ items: [] });
    await renderPage();
    expect(document.querySelector('[data-testid="subscriptions-published-empty"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="subscriptions-published-filter"]')).toBeTruthy();
    expect(mount.textContent).toContain("No published calendars yet.");
    expect(mount.textContent).not.toMatch(/not found/i);
    expect(mount.textContent).not.toContain("Published calendars");
    expect(mount.textContent).not.toContain("Public calendars are managed here");
    expect(mount.textContent).not.toContain("Choose a local workset below");
    expect(document.querySelector('[data-testid="subscriptions-published-workset"]')).toBeNull();
    expect(document.querySelector('[data-testid="subscriptions-publish-modal"]')).toBeNull();
    const open = document.querySelector('[data-testid="subscriptions-published-open-form"]') as HTMLButtonElement;
    expect(open).toBeTruthy();
    expect(open.textContent).toContain("Publish a workset");
    await act(async () => {
      open.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(document.querySelector('[data-testid="subscriptions-publish-modal"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="subscriptions-published-workset"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="calendar-share-slug"]')).toBeNull();
    expect(document.querySelector('[data-testid="subscriptions-publish-confirm"]')?.textContent).toContain(
      "Confirm",
    );
    expect(document.querySelector('[data-testid="subscriptions-publish-cancel"]')?.textContent).toContain(
      "Cancel",
    );
    expect(
      (document.querySelector('[data-testid="subscriptions-publish-confirm"]') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(mount.textContent).not.toContain("Close");
    expect([...document.querySelectorAll("a")].some((el) => el.getAttribute("href") === "/worksets")).toBe(false);
  });

  it("does not leak a catalog 404 into the empty published list", async () => {
    calendarShareApiMocks.fetchCalendarSharePublishList.mockResolvedValue({ items: [] });
    calendarShareApiMocks.fetchCalendarShareSubscriptions.mockRejectedValue(new Error("Not found"));
    await renderPage();
    expect(document.querySelector('[data-testid="subscriptions-published-empty"]')).toBeTruthy();
    expect(mount.textContent).toContain("No published calendars yet.");
    expect(mount.textContent).not.toMatch(/not found/i);
    expect(document.querySelector('[data-testid="subscriptions-published-filter"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="subscriptions-published-open-form"]')).toBeTruthy();
  });

  it("treats a publish-list 404 as empty, not an error banner", async () => {
    calendarShareApiMocks.fetchCalendarSharePublishList.mockRejectedValue(
      Object.assign(new Error("Not found"), { status: 404, name: "ApiRequestError" }),
    );
    await renderPage();
    expect(document.querySelector('[data-testid="subscriptions-published-empty"]')).toBeTruthy();
    expect(mount.textContent).toContain("No published calendars yet.");
    expect(mount.textContent).not.toMatch(/not found/i);
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(document.querySelector('[data-testid="subscriptions-published-open-form"]')).toBeTruthy();
  });

  it("still shows a real publish-list failure above the empty state", async () => {
    calendarShareApiMocks.fetchCalendarSharePublishList.mockRejectedValue(new Error("publish list 500"));
    await renderPage();
    expect(document.querySelector('[data-testid="subscriptions-published-empty"]')).toBeTruthy();
    expect(mount.textContent).toContain("publish list 500");
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("publish list 500");
  });

  it("opens the same publish modal from the list when it is not empty", async () => {
    await renderPage();
    await act(async () => {
      (document.querySelector('[data-testid="subscriptions-published-open-form"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(document.querySelector('[data-testid="subscriptions-publish-modal"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="subscriptions-published-workset"]')).toBeTruthy();
  });

  it("filters listed published cards by slug and workset name", async () => {
    calendarShareApiMocks.fetchCalendarSharePublishList.mockResolvedValue({
      items: [
        LIVE,
        { ...LIVE, worksetId: "ws-2", slug: "Team", worksetName: "Team board" },
      ],
    });
    await renderPage();
    expect(document.querySelector('[data-testid="subscriptions-published-ws-1"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="subscriptions-published-ws-2"]')).toBeTruthy();
    const input = document.querySelector('[data-testid="subscriptions-published-filter"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      setter.call(input, "team");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(document.querySelector('[data-testid="subscriptions-published-ws-2"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="subscriptions-published-ws-1"]')).toBeNull();
    expect(calendarShareApiMocks.fetchCalendarShareSearch).not.toHaveBeenCalled();
  });

  it("unpublishes via DELETE and does not delete the workset", async () => {
    calendarShareApiMocks.unpublishCalendarSharePublish.mockImplementation(async () => {
      calendarShareApiMocks.fetchCalendarSharePublishList.mockResolvedValue({ items: [] });
      return { ...LIVE, slug: "" };
    });
    await renderPage();
    expect(document.querySelector('[data-testid="subscriptions-published-list"]')?.textContent).toContain("Ops");
    expect(document.querySelector('[data-testid="subscriptions-published-list"]')?.textContent).toContain("Wing/Ops");
    await act(async () => {
      (document.querySelector('[data-testid="subscriptions-unpublish-ws-1"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(calendarShareApiMocks.unpublishCalendarSharePublish).toHaveBeenCalledWith(LIVE);
    expect(deleteWorkset).not.toHaveBeenCalled();
    expect(document.querySelector('[data-testid="subscriptions-published-empty"]')).toBeTruthy();
  });

  it("shows syncing wait state while update public copy is in flight", async () => {
    let resolveSync: (value: unknown) => void = () => {};
    calendarShareApiMocks.syncCalendarSharePublish.mockReturnValue(
      new Promise((resolve) => {
        resolveSync = resolve;
      }),
    );
    await renderPage();
    const sync = document.querySelector(
      '[data-testid="subscriptions-published-sync-ws-1"]',
    ) as HTMLButtonElement;
    expect(sync.textContent).toContain("Update public copy");
    await act(async () => {
      sync.click();
      await Promise.resolve();
    });
    expect(sync.disabled).toBe(true);
    expect(sync.getAttribute("aria-busy")).toBe("true");
    expect(sync.textContent).toContain("Updating…");
    await act(async () => {
      resolveSync(LIVE);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it("updates the public copy without deleting the workset", async () => {
    await renderPage();
    await act(async () => {
      (document.querySelector('[data-testid="subscriptions-published-sync-ws-1"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(calendarShareApiMocks.syncCalendarSharePublish).toHaveBeenCalledWith(LIVE);
    expect(deleteWorkset).not.toHaveBeenCalled();
  });

  it("opens publish settings for a local workset", async () => {
    await renderPage();
    await act(async () => {
      (document.querySelector('[data-testid="subscriptions-published-edit-ws-1"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(document.querySelector('[data-testid="subscriptions-publish-modal"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="calendar-share-slug"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="calendar-share-grants"]')?.textContent).toContain(
      "Who can subscribe to this private group calendar",
    );
    expect(calendarShareApiMocks.fetchCalendarSharePublish).toHaveBeenCalledWith("ws-1");
    expect(document.querySelector('[data-testid="calendar-share-enabled"]')).toBeNull();
    expect(document.querySelector('[data-testid="calendar-share-apply"]')).toBeNull();
    expect(document.querySelector('[data-testid="subscriptions-publish-confirm"]')?.textContent).toContain(
      "Confirm",
    );
    expect(document.querySelector('[data-testid="subscriptions-publish-cancel"]')?.textContent).toContain(
      "Cancel",
    );
  });

  it("confirms from the modal footer to save and push, and cancel does not save", async () => {
    calendarShareApiMocks.putCalendarSharePublish.mockResolvedValue({
      ...LIVE,
      lastSyncAt: "2026-08-27T00:00:00Z",
    });
    await renderPage();
    await act(async () => {
      (document.querySelector('[data-testid="subscriptions-published-edit-ws-1"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    const confirm = document.querySelector(
      '[data-testid="subscriptions-publish-confirm"]',
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
    await act(async () => {
      confirm.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(calendarShareApiMocks.putCalendarSharePublish).toHaveBeenCalledWith("ws-1", {
      slug: "Ops",
      publicVisibility: "public_busy",
      grants: [],
      syncNow: true,
    });
    expect(document.querySelector('[data-testid="subscriptions-publish-modal"]')).toBeNull();

    calendarShareApiMocks.putCalendarSharePublish.mockClear();
    await act(async () => {
      (document.querySelector('[data-testid="subscriptions-published-edit-ws-1"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      (document.querySelector('[data-testid="subscriptions-publish-cancel"]') as HTMLButtonElement).click();
    });
    expect(calendarShareApiMocks.putCalendarSharePublish).not.toHaveBeenCalled();
    expect(document.querySelector('[data-testid="subscriptions-publish-modal"]')).toBeNull();
  });

  it("shows the new card after confirm when the published list GET fails", async () => {
    calendarShareApiMocks.fetchCalendarSharePublishList.mockResolvedValueOnce({ items: [] });
    calendarShareApiMocks.fetchCalendarSharePublishList.mockRejectedValue(
      new Error("Calendar share request failed"),
    );
    calendarShareApiMocks.putCalendarSharePublish.mockResolvedValue({
      ...LIVE,
      lastSyncAt: "2026-08-27T00:00:00Z",
      lastError: null,
    });
    await renderPage();
    await act(async () => {
      (document.querySelector('[data-testid="subscriptions-published-open-form"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
    });
    const select = document.querySelector('[data-testid="subscriptions-published-workset"]') as HTMLSelectElement;
    await act(async () => {
      select.value = "ws-1";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    const confirm = document.querySelector(
      '[data-testid="subscriptions-publish-confirm"]',
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
    await act(async () => {
      confirm.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(document.querySelector('[data-testid="subscriptions-publish-modal"]')).toBeNull();
    expect(document.querySelector('[data-testid="subscriptions-published-ws-1"]')).toBeTruthy();
    expect(mount.textContent).not.toContain("Calendar share request failed");
  });

  it("keeps the modal open and shows a real write failure", async () => {
    calendarShareApiMocks.putCalendarSharePublish.mockRejectedValue(new Error("Calendar share request failed"));
    calendarShareApiMocks.fetchCalendarSharePublish.mockResolvedValue({
      ...LIVE,
      lastSyncAt: null,
      lastError: "Calendar share request failed",
    });
    await renderPage();
    await act(async () => {
      (document.querySelector('[data-testid="subscriptions-published-edit-ws-1"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      (document.querySelector('[data-testid="subscriptions-publish-confirm"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(document.querySelector('[data-testid="subscriptions-publish-modal"]')).toBeTruthy();
    expect(calendarShareApiMocks.putCalendarSharePublish).toHaveBeenCalled();
  });

  it("shows a need-login banner and disables unpublish when logged out", async () => {
    calendarShareApiMocks.fetchCalendarShareSession.mockResolvedValue({
      connected: false,
      baseUrl: "http://127.0.0.1:8787",
      handle: "",
      status: "disconnected",
    });
    await renderShell("/subscriptions/published");
    expect(document.querySelector('[data-testid="subscriptions-need-login"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="calendar-share-login"]')).toBeNull();
    expect([...document.querySelectorAll("a")].some((el) => el.getAttribute("href") === "/subscriptions/account")).toBe(
      true,
    );
    const button = document.querySelector('[data-testid="subscriptions-unpublish-ws-1"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(
      (document.querySelector('[data-testid="subscriptions-published-sync-ws-1"]') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(document.querySelector('[data-testid="subscriptions-published-list"]')?.className).toContain("opacity-50");
  });

  it("lists leftover map rows after the workset was deleted", async () => {
    calendarShareApiMocks.fetchCalendarSharePublishList.mockResolvedValue({ items: [ORPHAN] });
    await renderPage();
    expect(document.querySelector('[data-testid="subscriptions-published-ws-gone"]')?.textContent).toContain(
      "Local workset deleted; the public calendar is still up.",
    );
    expect(document.querySelector('[data-testid="subscriptions-published-missing-ws-gone"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="subscriptions-published-sync-ws-gone"]')).toBeNull();
    const button = document.querySelector('[data-testid="subscriptions-unpublish-ws-gone"]') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it("disables unpublish when calendar share is unreachable", async () => {
    calendarShareApiMocks.fetchCalendarShareSubscriptions.mockRejectedValue({
      status: 502,
      message: "calendar share 502",
    });
    await renderPage();
    expect(mount.textContent).toContain("Calendar share is unreachable");
    const button = document.querySelector('[data-testid="subscriptions-unpublish-ws-1"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(document.querySelector('[data-testid="subscriptions-published-list"]')?.className).toContain("opacity-50");
  });
});
