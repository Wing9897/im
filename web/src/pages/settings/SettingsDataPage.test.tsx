/**
 * Unit tests for SettingsDataPage full-reset + retention UI.
 */
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import {
  createTestHarness,
  type TestHarness,
} from "../../test/render-helpers";

vi.mock("../../hooks/useFocusTrap", () => ({
  useFocusTrap: () => ({ current: null }),
}));

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

vi.mock("./SettingsShared", () => ({
  SettingsContentCard: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-testid": "settings-card" }, children),
  SettingsFieldGroup: ({
    children,
  }: {
    children: React.ReactNode;
  }) => createElement("div", { "data-testid": "field-group" }, children),
}));

vi.mock("../../components/settings/useSettingsPageState", () => ({
  useSettingsPageState: () => ({
    settings: {
      retentionMessagesDays: "90",
      retentionAnalysisDays: "0",
      retentionLeaderboardDays: "90",
      retentionAppLogsDays: "30",
      retentionUserEventsDays: "0",
    },
    savedSnapshot: {
      retentionMessagesDays: "90",
      retentionAnalysisDays: "0",
      retentionLeaderboardDays: "90",
      retentionAppLogsDays: "30",
      retentionUserEventsDays: "0",
    },
    updateSettings: vi.fn(),
    applyPersistedSnapshot: vi.fn(),
    resettingRuntimeData: false,
    handleRequestFullReset: vi.fn(async () => {}),
    handleSave: vi.fn(async () => {}),
    saving: false,
    saveSuccess: false,
  }),
}));

import { SettingsDataPage } from "./SettingsDataPage";

describe("SettingsDataPage", () => {
  let harness: TestHarness;

  beforeEach(async () => {
    await i18n.changeLanguage("zh-Hant");
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.cleanup();
  });

  it('renders the "完全重置" button', async () => {
    await harness.render(SettingsDataPage);

    const buttons = Array.from(harness.container.querySelectorAll("button"));
    const resetButton = buttons.find((btn) => btn.textContent === "完全重置");
    expect(resetButton).toBeTruthy();
  });

  it("renders five independent retention day inputs", async () => {
    await harness.render(SettingsDataPage);

    expect(harness.container.textContent).not.toContain("定期清理");
    expect(harness.container.querySelector('[aria-label="實時監控保留天數"]')).toBeTruthy();
    expect(harness.container.querySelector('[aria-label="分析結果（情報事件）保留天數"]')).toBeTruthy();
    expect(harness.container.querySelector('[aria-label="排行榜保留天數"]')).toBeTruthy();
    expect(harness.container.querySelector('[aria-label="應用日誌保留天數"]')).toBeTruthy();
    expect(harness.container.querySelector('[aria-label="日曆／用戶事件保留天數"]')).toBeTruthy();
  });

  it('renders the "立即清理" button', async () => {
    await harness.render(SettingsDataPage);
    expect(harness.container.querySelector('[data-testid="retention-run-button"]')).toBeTruthy();
  });

  it("shows full-reset confirmation dialog when button is clicked", async () => {
    await harness.render(SettingsDataPage);

    const buttons = Array.from(harness.container.querySelectorAll("button"));
    const resetButton = buttons.find((btn) => btn.textContent === "完全重置");
    expect(resetButton).toBeTruthy();

    await act(async () => {
      resetButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain("確定要完全重置？");
    expect(document.body.textContent).toContain(
      "將刪除資料庫、secret.key、connection.json、管理員帳號、帳號 session 與前端快取",
    );
    expect(document.body.textContent).toContain("確認完全重置");
    expect(document.body.textContent).toContain("取消");
  });
});
