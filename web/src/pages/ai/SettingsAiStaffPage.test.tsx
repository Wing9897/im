import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureZhHantLocale, wrapWithI18n } from "../../test/i18nHarness";
import { defaultSettingsSnapshot } from "../../test/settingsSnapshot";

const mockUpdateSettings = vi.fn();
const mockHandleSave = vi.fn();
const mockSaveSystemSettings = vi.fn();
const mockFetchSystemSettings = vi.fn();

vi.mock("../../api/config", () => ({
  fetchSystemSettings: (...args: unknown[]) => mockFetchSystemSettings(...args),
  saveSystemSettings: (...args: unknown[]) => mockSaveSystemSettings(...args),
}));

vi.mock("../../components/settings/useSettingsPageState", () => {
  return {
    useSettingsPageState: () => ({
      settings: { ...defaultSettingsSnapshot },
      updateSettings: mockUpdateSettings,
      saving: false,
      saveSuccess: false,
      handleSave: mockHandleSave,
    }),
  };
});

import { SettingsAiStaffPage } from "./SettingsAiStaffPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderPage(root: Root) {
  act(() => {
    root.render(
      wrapWithI18n(
        createElement(MemoryRouter, null, createElement(SettingsAiStaffPage)),
      ),
    );
  });
}

describe("SettingsAiStaffPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await ensureZhHantLocale();
    window.localStorage.clear();
    mockUpdateSettings.mockReset();
    mockHandleSave.mockReset();
    mockHandleSave.mockResolvedValue(undefined);
    mockFetchSystemSettings.mockReset();
    mockSaveSystemSettings.mockReset();
    mockFetchSystemSettings.mockResolvedValue({
      ...defaultSettingsSnapshot,
      assistantDisplayName: "",
      assistantAvatar: "",
    });
    mockSaveSystemSettings.mockImplementation(async (patch: Record<string, string>) => ({
      ...defaultSettingsSnapshot,
      ...patch,
    }));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    window.localStorage.clear();
  });

  it("renders five runtime staff cards plus page-local liaison intro card", async () => {
    renderPage(root);
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="ai-staff-card-assistant"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ai-staff-card-liaison"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ai-staff-card-taskEditor"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ai-staff-card-leaderboard"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ai-staff-card-intel_event"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ai-staff-card-agent"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ai-staff-avatar-assistant"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="ai-staff-avatar-assistant"]')?.getAttribute("data-staff-kind"),
    ).toBe("agent");
    expect(
      container
        .querySelector('[data-testid="ai-staff-avatar-leaderboard"]')
        ?.getAttribute("data-staff-surface"),
    ).toBe("backoffice");
    expect(container.querySelector('[data-testid="ai-staff-avatar-liaison"]')).not.toBeNull();

    const liaisonCard = container.querySelector('[data-testid="ai-staff-card-liaison"]');
    expect(liaisonCard?.textContent).toContain("客戶經理");
    expect(liaisonCard?.textContent).toContain("Agent 級");
    expect(liaisonCard?.textContent).toContain("對外席");
    expect(liaisonCard?.textContent).toContain("物品");
    expect(liaisonCard?.textContent).not.toContain("與助手同組");
    const apiLink = liaisonCard?.querySelector('a[href="/settings/integrations?tab=a2a"]');
    expect(apiLink).not.toBeNull();
    expect(apiLink?.textContent).toContain("A2A");

    const assistantCard = container.querySelector('[data-testid="ai-staff-card-assistant"]');
    expect(assistantCard?.textContent).toContain("可追蹤物品");
    const agentCard = container.querySelector('[data-testid="ai-staff-card-agent"]');
    expect(agentCard?.textContent).toContain("專案經理");
    expect(agentCard?.textContent).toContain("不可新增或更改物品");
    expect(agentCard?.textContent).not.toContain("items.create");
    expect(agentCard?.textContent).toContain("游標抽乾不可同時開情報事件輸出");
  });

  it("does not list staff instances or bound profiles", async () => {
    renderPage(root);
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="llm-staff-instances"]')).toBeNull();
    expect(container.textContent).not.toContain("員工實例");
    expect(container.textContent).not.toMatch(/設定檔：/);
  });

  it("exposes assistant rename/history icons and avatar upload without permanent form fields", async () => {
    renderPage(root);
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="assistant-edit-name"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="assistant-edit-history"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="assistant-avatar-upload"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="assistant-avatar-file"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="assistant-display-name"]')).toBeNull();
    expect(container.querySelector('[data-testid="assistant-llm-provider"]')).toBeNull();
    expect(container.textContent).not.toContain("跟隨 AI 供應商");

    expect(
      container.querySelector('[data-testid="ai-staff-card-taskEditor"] [data-testid="assistant-edit-name"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="ai-staff-card-leaderboard"] [data-testid="assistant-edit-history"]'),
    ).toBeNull();
  });

  it("opens inline rename via pencil and persists display name to settings API", async () => {
    renderPage(root);
    await act(async () => {
      await Promise.resolve();
    });

    const editBtn = container.querySelector(
      '[data-testid="assistant-edit-name"]',
    ) as HTMLButtonElement;
    act(() => {
      editBtn.click();
    });

    const input = container.querySelector(
      '[data-testid="assistant-display-name"]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(input, "我的助手");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await Promise.resolve();
    });

    expect(mockSaveSystemSettings).toHaveBeenCalledWith(
      expect.objectContaining({ assistantDisplayName: "我的助手" }),
    );
    expect(container.querySelector('[data-testid="assistant-display-name"]')).toBeNull();
  });

  it("opens assistant history dialog from sparkles icon", async () => {
    renderPage(root);
    await act(async () => {
      await Promise.resolve();
    });

    expect(document.body.querySelector('[data-testid="assistant-history-dialog"]')).toBeNull();

    const editHistory = container.querySelector(
      '[data-testid="assistant-edit-history"]',
    ) as HTMLButtonElement;
    act(() => {
      editHistory.click();
    });

    const dialog = document.body.querySelector('[data-testid="assistant-history-dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain("助手對話保留");
    expect(document.body.querySelector('[data-testid="assistant-history-max-messages"]')).not.toBeNull();
  });

  it("staff intro avatars omit framed border/background ring classes", async () => {
    renderPage(root);
    await act(async () => {
      await Promise.resolve();
    });

    const avatar = container.querySelector(
      '[data-testid="ai-staff-avatar-assistant"]',
    ) as HTMLElement;
    expect(avatar).not.toBeNull();
    expect(avatar.className).not.toMatch(/\bborder\b/);
    expect(avatar.className).toContain("bg-transparent");

    const upload = container.querySelector(
      '[data-testid="assistant-avatar-upload"]',
    ) as HTMLElement;
    expect(upload).not.toBeNull();
    expect(upload.className).toMatch(/\bborder-0\b/);
    expect(upload.className).toContain("bg-transparent");
    expect(upload.className).toContain("p-0");
    expect(upload.className).toContain("shadow-none");
  });
});
