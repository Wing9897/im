import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarShareLoginSection } from "./CalendarShareLoginSection";
import { ensureZhHantLocale, wrapWithI18n } from "../../../test/i18nHarness";

const fetchCalendarShareSession = vi.fn();
const fetchCalendarShareTimezone = vi.fn();
const loginCalendarShare = vi.fn();
const logoutCalendarShare = vi.fn();
const putCalendarShareTimezone = vi.fn();
const invalidateCalendarShareCatalog = vi.fn();

vi.mock("../../../api/calendarShare", () => ({
  fetchCalendarShareSession: (...args: unknown[]) => fetchCalendarShareSession(...args),
  fetchCalendarShareTimezone: (...args: unknown[]) => fetchCalendarShareTimezone(...args),
  loginCalendarShare: (...args: unknown[]) => loginCalendarShare(...args),
  logoutCalendarShare: (...args: unknown[]) => logoutCalendarShare(...args),
  putCalendarShareTimezone: (...args: unknown[]) => putCalendarShareTimezone(...args),
}));

vi.mock("../../../domain/calendarShare/useCalendarShareCatalog", () => ({
  invalidateCalendarShareCatalog: (...args: unknown[]) => invalidateCalendarShareCatalog(...args),
}));

vi.mock("../../../context/ToastContext", async () =>
  (await import("../../../test/context-mocks")).toastContextModuleMock(),
);

describe("CalendarShareLoginSection timezone", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await ensureZhHantLocale();
    fetchCalendarShareSession.mockReset();
    fetchCalendarShareTimezone.mockReset();
    loginCalendarShare.mockReset();
    logoutCalendarShare.mockReset();
    putCalendarShareTimezone.mockReset();
    invalidateCalendarShareCatalog.mockReset();
    fetchCalendarShareSession.mockResolvedValue({
      connected: false,
      baseUrl: "http://127.0.0.1:8787",
      handle: "",
      status: "disconnected",
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
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

  it("shows a reminder when the last public timezone update did not finish", async () => {
    fetchCalendarShareTimezone.mockResolvedValue({
      timezone: "Asia/Hong_Kong",
      suggestedTimezone: "Asia/Hong_Kong",
      pendingPublicTimezone: true,
      lastPublicTimezone: "",
    });
    await renderSection();
    expect(fetchCalendarShareTimezone).toHaveBeenCalled();
    expect(container.querySelector('[data-testid="calendar-share-timezone-pending"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="calendar-share-timezone"]')).toBeTruthy();
  });

  it("hides the reminder when the public replica is current", async () => {
    fetchCalendarShareTimezone.mockResolvedValue({
      timezone: "Asia/Taipei",
      suggestedTimezone: "Asia/Hong_Kong",
      pendingPublicTimezone: false,
      lastPublicTimezone: "Asia/Taipei",
    });
    await renderSection();
    expect(container.querySelector('[data-testid="calendar-share-timezone-pending"]')).toBeNull();
  });

  it("invalidates the shared catalog after login and logout", async () => {
    fetchCalendarShareTimezone.mockResolvedValue({
      timezone: "Asia/Taipei",
      suggestedTimezone: "Asia/Taipei",
      pendingPublicTimezone: false,
      lastPublicTimezone: "Asia/Taipei",
    });
    loginCalendarShare.mockResolvedValue({
      connected: true,
      baseUrl: "http://127.0.0.1:8787",
      handle: "Wing",
      status: "connected",
    });
    logoutCalendarShare.mockResolvedValue({
      connected: false,
      baseUrl: "http://127.0.0.1:8787",
      handle: "",
      status: "disconnected",
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
    });
    expect(invalidateCalendarShareCatalog).toHaveBeenCalledTimes(1);

    await act(async () => {
      (container.querySelector('[data-testid="calendar-share-logout"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(invalidateCalendarShareCatalog).toHaveBeenCalledTimes(2);
  });
});
