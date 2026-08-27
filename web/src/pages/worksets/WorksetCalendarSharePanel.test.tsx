import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/calendarShare", async () =>
  (await import("../../test/calendarShareApiMock")).calendarShareApiModuleMock());

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock(),
);

import { WorksetCalendarSharePanel } from "./WorksetCalendarSharePanel";
import { ensureZhHantLocale, wrapWithI18n } from "../../test/i18nHarness";
import { calendarShareApiMocks, resetCalendarShareApiMocks } from "../../test/calendarShareApiMock";
import { resetCalendarShareCatalogForTests } from "../../domain/calendarShare/useCalendarShareCatalog";

const PUBLISH = {
  worksetId: "ws-1",
  slug: "Ops",
  enabled: false,
  autoSync: false,
  publicVisibility: "off" as const,
  grants: [],
  lastSyncAt: null,
  lastError: null,
  isSystemWorkset: false,
};

describe("WorksetCalendarSharePanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await ensureZhHantLocale();
    resetCalendarShareCatalogForTests();
    resetCalendarShareApiMocks();
    calendarShareApiMocks.fetchCalendarShareSubscriptions.mockResolvedValue({
      items: [],
      ownHandle: "",
    });
    calendarShareApiMocks.fetchCalendarSharePublish.mockResolvedValue(PUBLISH);
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
      root.render(
        wrapWithI18n(
          createElement(WorksetCalendarSharePanel, {
            worksetId: "ws-1",
            worksetTitle: "Ops",
            isSystem: false,
          }),
        ),
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("shows the login hint and keeps publish controls disabled when logged out", async () => {
    calendarShareApiMocks.fetchCalendarShareSession.mockResolvedValue({
      connected: false,
      baseUrl: "http://127.0.0.1:8787",
      handle: "",
      status: "disconnected",
    });
    await renderPanel();
    expect(calendarShareApiMocks.fetchCalendarShareSession).toHaveBeenCalledTimes(1);
    expect(calendarShareApiMocks.fetchCalendarSharePublish).toHaveBeenCalledWith("ws-1");
    expect(container.textContent).toContain("請先到帳戶 → 身分登入日曆分享服務。");
    expect(
      container.querySelector('[data-testid="calendar-share-enabled"]')?.getAttribute("aria-disabled"),
    ).toBe("true");
    expect(
      (container.querySelector('[data-testid="calendar-share-slug"]') as HTMLInputElement).disabled,
    ).toBe(true);
  });

  it("enables publish controls when the catalog session is connected", async () => {
    calendarShareApiMocks.fetchCalendarShareSession.mockResolvedValue({
      connected: true,
      baseUrl: "http://127.0.0.1:8787",
      handle: "Wing",
      status: "connected",
    });
    await renderPanel();
    expect(calendarShareApiMocks.fetchCalendarShareSession).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector('[data-testid="calendar-share-enabled"]')?.getAttribute("aria-disabled"),
    ).toBe("false");
    expect(
      (container.querySelector('[data-testid="calendar-share-slug"]') as HTMLInputElement).disabled,
    ).toBe(false);
    expect(container.querySelector('[data-testid="calendar-share-slug"]')).toBeTruthy();
  });
});
