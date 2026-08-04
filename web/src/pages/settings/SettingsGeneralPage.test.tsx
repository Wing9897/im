import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { SimpleModeProvider } from "../../context/SimpleModeContext";
import { createTestHarness, type TestHarness } from "../../test/render-helpers";

const saveSystemSettings = vi.fn();
const restartCollector = vi.fn();
const applyPersistedSnapshot = vi.fn();

vi.mock("../../api/config", () => ({ saveSystemSettings }));
vi.mock("../../api/system", () => ({ restartCollector }));
vi.mock("../../components/settings/SystemVersionPanel", () => ({
  SystemVersionPanel: () => createElement("div", { "data-testid": "system-version-panel" }, "version"),
}));
vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());
vi.mock("../../hooks/useFocusTrap", () => ({ useFocusTrap: () => ({ current: null }) }));
vi.mock("./SettingsShared", () => ({
  SettingsContentCard: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
  SettingsFieldGroup: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
  useSettingsPageState: () => ({
    settings: {
      weatherLocation: "system",
      analysisTraceVerbose: false,
    },
    applyPersistedSnapshot,
  }),
}));

const { SettingsGeneralPage } = await import("./SettingsGeneralPage");

function SettingsGeneralPageWithProviders() {
  return createElement(SimpleModeProvider, null, createElement(SettingsGeneralPage));
}

describe("SettingsGeneralPage", () => {
  let harness: TestHarness;

  beforeEach(async () => {
    await i18n.changeLanguage("zh-Hant");
    harness = createTestHarness();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    harness.cleanup();
    window.localStorage.clear();
  });

  it("defaults the weather region to follow the system", async () => {
    await harness.render(SettingsGeneralPageWithProviders);

    const checkbox = Array.from(
      harness.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    ).find((el) => el.closest("label")?.textContent?.includes("跟系統"));
    expect(checkbox?.checked).toBe(true);
    expect(harness.container.textContent).toContain("跟系統");
  });

  it("exposes a simple-mode toggle for AI calendar UX", async () => {
    await harness.render(SettingsGeneralPageWithProviders);
    const toggle = harness.container.querySelector<HTMLInputElement>(
      '[data-testid="simple-mode-toggle"]',
    );
    expect(toggle).toBeTruthy();
    expect(toggle?.checked).toBe(false);
    expect(harness.container.textContent).toContain("簡化模式");
  });

  it("shows the interface language switcher near general prefs", async () => {
    await harness.render(SettingsGeneralPageWithProviders);

    expect(harness.container.querySelector('[data-testid="language-switcher"]')).not.toBeNull();
    expect(harness.container.textContent).toContain("介面語言");
    expect(harness.container.textContent).toContain("繁體中文");
  });

  it("persists a custom weather region", async () => {
    saveSystemSettings.mockResolvedValue({ weatherLocation: "臺北" });
    await harness.render(SettingsGeneralPageWithProviders);
    const checkbox = Array.from(
      harness.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    ).find((el) => el.closest("label")?.textContent?.includes("跟系統"))!;
    await act(async () => {
      checkbox.click();
    });
    const input = harness.container.querySelector<HTMLInputElement>('[aria-label="天氣地區"]')!;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    await act(async () => {
      nativeInputValueSetter.call(input, "臺北");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const save = Array.from(harness.container.querySelectorAll("button")).find(
      (button) => button.textContent === "儲存地區",
    )!;
    await act(async () => {
      save.click();
    });
    expect(saveSystemSettings).toHaveBeenCalledWith({ weatherLocation: "臺北" });
  });

  it("hosts analysis debug controls under system general settings", async () => {
    await harness.render(SettingsGeneralPageWithProviders);
    expect(harness.container.textContent).toContain("除錯與診斷");
    const toggle = Array.from(harness.container.querySelectorAll("button")).find(
      (btn) =>
        btn.getAttribute("aria-expanded") === "false" &&
        btn.closest("div")?.textContent?.includes("除錯與診斷"),
    );
    expect(toggle).toBeTruthy();
    await act(async () => toggle!.click());
    expect(harness.container.textContent).toContain("伺服器分析 Trace");
    expect(harness.container.querySelector('[role="switch"]')).toBeTruthy();
  });

  it("persists analysis trace immediately when the switch is toggled", async () => {
    saveSystemSettings.mockResolvedValue({
      weatherLocation: "system",
      analysisTraceVerbose: true,
    });
    await harness.render(SettingsGeneralPageWithProviders);
    const sectionToggle = Array.from(harness.container.querySelectorAll("button")).find(
      (btn) =>
        btn.getAttribute("aria-expanded") === "false" &&
        btn.closest("div")?.textContent?.includes("除錯與診斷"),
    );
    await act(async () => sectionToggle!.click());
    const switchEl = harness.container.querySelector<HTMLElement>('[role="switch"]')!;
    await act(async () => switchEl.click());
    expect(saveSystemSettings).toHaveBeenCalledWith({ analysisTraceVerbose: true });
    expect(applyPersistedSnapshot).toHaveBeenCalled();
  });

  it("keeps the collector restart action wired", async () => {
    await harness.render(SettingsGeneralPageWithProviders);
    const restart = Array.from(harness.container.querySelectorAll("button")).find(
      (button) => button.textContent === "重啟收集器",
    )!;
    await act(async () => restart.click());
    const confirm = Array.from(document.body.querySelectorAll("button")).find(
      (button) => button.textContent === "確認重啟",
    )!;
    restartCollector.mockResolvedValue({ message: "已重啟" });
    await act(async () => confirm.click());
    expect(restartCollector).toHaveBeenCalledOnce();
  });
});
