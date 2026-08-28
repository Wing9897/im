import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/calendarShare", async () =>
  (await import("../../test/calendarShareApiMock")).calendarShareApiModuleMock());

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock(),
);

import { CalendarSharePublishForm } from "./CalendarSharePublishForm";
import { ensureZhHantLocale, wrapWithI18n } from "../../test/i18nHarness";
import { calendarShareApiMocks, resetCalendarShareApiMocks } from "../../test/calendarShareApiMock";
import { mockShowToast } from "../../test/context-mocks";
import { resetCalendarShareCatalogForTests } from "../../domain/calendarShare/useCalendarShareCatalog";

const PUBLISH = {
  worksetId: "ws-1",
  slug: "Ops",
  publicVisibility: "private_group" as const,
  grants: [],
  lastSyncAt: null,
  lastError: null,
  isSystemWorkset: false,
};

describe("CalendarSharePublishForm", () => {
  let container: HTMLDivElement;
  let root: Root;
  let submitRef: { current: (() => Promise<boolean>) | null };

  beforeEach(async () => {
    await ensureZhHantLocale();
    resetCalendarShareCatalogForTests();
    resetCalendarShareApiMocks();
    submitRef = { current: null };
    calendarShareApiMocks.fetchCalendarShareSubscriptions.mockResolvedValue({
      items: [],
      ownHandle: "",
    });
    calendarShareApiMocks.fetchCalendarSharePublish.mockResolvedValue(PUBLISH);
    mockShowToast.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
    resetCalendarShareCatalogForTests();
  });

  async function renderForm() {
    act(() => {
      root.render(
        wrapWithI18n(
          createElement(CalendarSharePublishForm, {
            worksetId: "ws-1",
            worksetTitle: "Ops",
            isSystem: false,
            submitRef,
          }),
        ),
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  function mockConnectedSession() {
    calendarShareApiMocks.fetchCalendarShareSession.mockResolvedValue({
      connected: true,
      baseUrl: "http://127.0.0.1:8787",
      handle: "Wing",
      status: "connected",
    });
  }

  it("keeps publish controls disabled when logged out", async () => {
    calendarShareApiMocks.fetchCalendarShareSession.mockResolvedValue({
      connected: false,
      baseUrl: "http://127.0.0.1:8787",
      handle: "",
      status: "disconnected",
    });
    await renderForm();
    expect(calendarShareApiMocks.fetchCalendarShareSession).toHaveBeenCalledTimes(1);
    expect(calendarShareApiMocks.fetchCalendarSharePublish).toHaveBeenCalledWith("ws-1");
    expect(container.querySelector('[data-testid="calendar-share-enabled"]')).toBeNull();
    expect(
      (container.querySelector('[data-testid="calendar-share-slug"]') as HTMLInputElement).disabled,
    ).toBe(true);
  });

  it("enables publish controls when the catalog session is connected", async () => {
    mockConnectedSession();
    await renderForm();
    expect(calendarShareApiMocks.fetchCalendarShareSession).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="calendar-share-enabled"]')).toBeNull();
    expect(
      (container.querySelector('[data-testid="calendar-share-slug"]') as HTMLInputElement).disabled,
    ).toBe(false);
    expect(document.querySelector('[data-testid="calendar-share-slug"]')).toBeTruthy();
    expect(container.textContent).toContain("誰能訂這本私人群組日曆");
    const listing = container.querySelector('[data-testid="calendar-share-public"]') as HTMLSelectElement;
    expect([...listing.options].map((option) => option.textContent)).toEqual([
      "私人",
      "公開",
      "公開閒忙",
    ]);
    expect(listing.value).toBe("private_group");
    const addGrant = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "新增授權",
    );
    expect(addGrant).toBeTruthy();
    await act(async () => {
      addGrant!.click();
    });
    const grantSelect = container
      .querySelector('[data-testid="calendar-share-grants"]')
      ?.querySelector("select") as HTMLSelectElement;
    expect([...grantSelect.options].map((option) => option.textContent)).toEqual(["私人閒忙", "詳情"]);
    expect(grantSelect.textContent).not.toContain("公開閒忙");
    expect(grantSelect.textContent).not.toContain("公開");
  });

  it("explains confirm-to-upload and does not offer an enable toggle or auto-sync", async () => {
    mockConnectedSession();
    await renderForm();
    expect(container.textContent).toContain("確定會把目前工作集上載到遠端");
    expect(container.textContent).toContain("關掉上載請在卡片取消上載");
    expect(container.textContent).toContain("每分鐘合併成一次公開副本更新");
    expect(container.textContent).not.toContain("內容不會自動同步");
    expect(container.textContent).not.toContain("啟用上載");
    expect(container.textContent).not.toContain("關閉上載會刪除遠端 slug 日曆");
    expect(container.textContent).not.toContain("更新公開副本");
    expect(container.querySelector('[data-testid="calendar-share-enabled"]')).toBeNull();
    expect(container.querySelector('[data-testid="calendar-share-auto-sync"]')).toBeNull();
    expect(container.querySelector('[data-testid="calendar-share-save"]')).toBeNull();
    expect(container.querySelector('[data-testid="calendar-share-sync"]')).toBeNull();
    expect(container.querySelector('[data-testid="calendar-share-apply"]')).toBeNull();
    expect(container.textContent).not.toContain("變更後自動上載");
    expect(container.textContent).not.toContain("儲存設定");
  });

  it("pushes a snapshot with upload enabled on confirm", async () => {
    mockConnectedSession();
    calendarShareApiMocks.putCalendarSharePublish.mockResolvedValue({
      ...PUBLISH,
      lastSyncAt: "2026-08-27T00:00:00Z",
    });
    calendarShareApiMocks.fetchCalendarSharePublishList.mockResolvedValue({
      items: [{ ...PUBLISH, lastSyncAt: "2026-08-27T00:00:00Z", worksetName: "Ops", worksetMissing: false }],
    });
    await renderForm();
    expect(submitRef.current).toBeTruthy();
    await act(async () => {
      const ok = await submitRef.current!();
      expect(ok).toBe(true);
    });
    expect(calendarShareApiMocks.putCalendarSharePublish).toHaveBeenCalledWith("ws-1", {
      slug: "Ops",
      publicVisibility: "private_group",
      grants: [],
      syncNow: true,
    });
    expect(mockShowToast).toHaveBeenCalledWith("已上載", "success");
  });

  it("still succeeds when the published list GET fails after a successful write", async () => {
    mockConnectedSession();
    calendarShareApiMocks.putCalendarSharePublish.mockResolvedValue({
      ...PUBLISH,
      lastSyncAt: "2026-08-27T00:00:00Z",
    });
    calendarShareApiMocks.fetchCalendarSharePublishList.mockRejectedValue(
      new Error("Calendar share request failed"),
    );
    await renderForm();
    await act(async () => {
      const ok = await submitRef.current!();
      expect(ok).toBe(true);
    });
    expect(mockShowToast).toHaveBeenCalledWith("已上載，列表稍後更新", "warning");
    expect(mockShowToast).not.toHaveBeenCalledWith("Calendar share request failed", "error");
    expect(mockShowToast.mock.calls.some((call) => String(call[0]).includes("Calendar share request failed"))).toBe(
      false,
    );
  });

  it("does not unpublish from the form", async () => {
    mockConnectedSession();
    calendarShareApiMocks.fetchCalendarSharePublish.mockResolvedValue({ ...PUBLISH });
    await renderForm();
    expect(container.querySelector('[data-testid="calendar-share-apply"]')).toBeNull();
    expect(container.querySelector('[data-testid="calendar-share-enabled"]')).toBeNull();
    expect([...container.querySelectorAll("button")].map((button) => button.textContent)).not.toContain(
      "取消上載",
    );
    expect(submitRef.current).toBeTruthy();
    calendarShareApiMocks.putCalendarSharePublish.mockResolvedValue({ ...PUBLISH });
    await act(async () => {
      await submitRef.current!();
    });
    expect(calendarShareApiMocks.putCalendarSharePublish).toHaveBeenCalledWith(
      "ws-1",
      expect.objectContaining({ slug: "Ops", syncNow: true }),
    );
  });

  it("prefills general for the builtin 一般 workset", async () => {
    mockConnectedSession();
    calendarShareApiMocks.fetchCalendarSharePublish.mockResolvedValue({
      ...PUBLISH,
      worksetId: "__general__",
      slug: "",
      isSystemWorkset: true,
    });
    act(() => {
      root.render(
        wrapWithI18n(
          createElement(CalendarSharePublishForm, {
            worksetId: "__general__",
            worksetTitle: "一般",
            isSystem: true,
            submitRef,
          }),
        ),
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const input = container.querySelector('[data-testid="calendar-share-slug"]') as HTMLInputElement;
    expect(input.value).toBe("general");
  });

  it("rejects a slug with spaces without calling publish", async () => {
    mockConnectedSession();
    calendarShareApiMocks.fetchCalendarSharePublish.mockResolvedValue({ ...PUBLISH, slug: "foo bar" });
    await renderForm();
    await act(async () => {
      const ok = await submitRef.current!();
      expect(ok).toBe(false);
    });
    expect(calendarShareApiMocks.putCalendarSharePublish).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith("slug 須為 1–64 字元，以字母或數字開頭，其後可為字母、數字、點、底線或連字號。", "error");
  });
});
