import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../api/calendarShare", async () =>
  (await import("../../../test/calendarShareApiMock")).calendarShareApiModuleMock());

vi.mock("../../../context/ToastContext", async () =>
  (await import("../../../test/context-mocks")).toastContextModuleMock(),
);

import { CalendarShareLoginSection } from "./CalendarShareLoginSection";
import { ensureZhHantLocale, wrapWithI18n } from "../../../test/i18nHarness";
import { calendarShareApiMocks, resetCalendarShareApiMocks } from "../../../test/calendarShareApiMock";
import { resetCalendarShareCatalogForTests } from "../../../domain/calendarShare/useCalendarShareCatalog";

const DISCONNECTED = {
  connected: false,
  baseUrl: "http://127.0.0.1:8787",
  handle: "",
  status: "disconnected" as const,
};

const CONNECTED = {
  connected: true,
  baseUrl: "http://127.0.0.1:8787",
  handle: "Wing",
  status: "connected" as const,
};

describe("CalendarShareLoginSection timezone", () => {
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

  async function renderSection() {
    act(() => {
      root.render(wrapWithI18n(createElement(CalendarShareLoginSection)));
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("loads session only through the shared catalog", async () => {
    calendarShareApiMocks.fetchCalendarShareTimezone.mockResolvedValue({
      timezone: "Asia/Taipei",
      suggestedTimezone: "Asia/Taipei",
      pendingPublicTimezone: false,
      lastPublicTimezone: "Asia/Taipei",
    });
    await renderSection();
    expect(calendarShareApiMocks.fetchCalendarShareSession).toHaveBeenCalledTimes(1);
    expect(calendarShareApiMocks.fetchCalendarShareTimezone).toHaveBeenCalled();
  });

  it("shows a reminder when the last public timezone update did not finish", async () => {
    calendarShareApiMocks.fetchCalendarShareTimezone.mockResolvedValue({
      timezone: "Asia/Hong_Kong",
      suggestedTimezone: "Asia/Hong_Kong",
      pendingPublicTimezone: true,
      lastPublicTimezone: "",
    });
    await renderSection();
    expect(calendarShareApiMocks.fetchCalendarShareTimezone).toHaveBeenCalled();
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
    await renderSection();
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
    await renderSection();

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
    expect(calendarShareApiMocks.fetchCalendarShareSession.mock.calls.length).toBeGreaterThan(1);
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
