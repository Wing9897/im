import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness, type TestHarness } from "../../../test/render-helpers";
import { ensureZhHantLocale } from "../../../test/i18nHarness";
import { emptyKeyedWebSearchApiKeyFields } from "../../../domain/settings/assistantWebSearchRoute";
import { SettingsAiProviderPage } from "./SettingsAiProviderPage";

const listLlmProfiles = vi.fn();
const listLlmGlobalSlots = vi.fn();
const bindLlmGlobalSlot = vi.fn();

vi.mock("../../../api/llmProfiles", () => ({
  listLlmProfiles: (...args: unknown[]) => listLlmProfiles(...args),
  listLlmGlobalSlots: (...args: unknown[]) => listLlmGlobalSlots(...args),
  bindLlmGlobalSlot: (...args: unknown[]) => bindLlmGlobalSlot(...args),
  createLlmProfile: vi.fn(),
  patchLlmProfile: vi.fn(),
  deleteLlmProfile: vi.fn(),
  copyLlmProfile: vi.fn(),
  }));

vi.mock("../../../api/system", () => ({
  testAiEngine: vi.fn(),
}));

vi.mock("../../../context/ToastContext", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("../../../context/CollectorStatusContext", () => ({
  useCollectorStatus: () => ({ requestAiStatusRefresh: vi.fn() }),
}));

vi.mock("../../../components/settings/useSettingsPageState", () => ({
  useSettingsPageState: () => ({
    settingsObject: { llmGenerationTimeout: "120" },
    handleSettingChange: vi.fn(),
    handleSave: vi.fn(),
    saving: false,
    saveSuccess: false,
  }),
}));

function completeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "profile-1",
    name: "Local",
    provider: "ollama",
    baseUrl: "http://localhost:11434",
    model: "llama3",
    apiKey: "",
    thinkingEnabled: false,
    jsonMode: "disabled",
    webSearchEnabled: true,
    webSearchProvider: "auto",
    ...emptyKeyedWebSearchApiKeyFields(),
    staffClasses: ["agent"],
    staffInstances: [],
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

const unboundSlots = [
  {
    slot: "assistant",
    profileId: null,
    profileName: null,
    profileProvider: null,
    profileModel: null,
  },
  {
    slot: "liaison",
    profileId: null,
    profileName: null,
    profileProvider: null,
    profileModel: null,
  },
  {
    slot: "taskEditor",
    profileId: null,
    profileName: null,
    profileProvider: null,
    profileModel: null,
  },
];

describe("SettingsAiProviderPage", () => {
  let harness: TestHarness;

  beforeEach(async () => {
    await ensureZhHantLocale();
    harness = createTestHarness();
    listLlmProfiles.mockReset();
    listLlmGlobalSlots.mockReset();
    bindLlmGlobalSlot.mockReset();
    listLlmProfiles.mockResolvedValue([completeProfile()]);
    listLlmGlobalSlots.mockResolvedValue([
      {
        slot: "assistant",
        profileId: "profile-1",
        profileName: "Local",
        profileProvider: "ollama",
        profileModel: "llama3",
          },
      unboundSlots[1],
      unboundSlots[2],
    ]);
  });

  afterEach(() => {
    harness.cleanup();
  });

  it("renders global slots section above task-mode profiles section", async () => {
    await harness.render(SettingsAiProviderPage, {});

    expect(document.body.querySelector('[data-testid="llm-global-slots"]')).toBeTruthy();
    expect(document.body.querySelector('[data-testid="llm-global-slot-assistant"]')).toBeTruthy();
    expect(document.body.querySelector('[data-testid="llm-global-slot-liaison"]')).toBeTruthy();
    expect(document.body.querySelector('[data-testid="llm-global-slot-taskEditor"]')).toBeTruthy();
    expect(document.body.querySelector('[data-testid="llm-task-profiles"]')).toBeTruthy();
    expect(document.body.querySelector('[data-testid="llm-profile-card-profile-1"]')).toBeTruthy();
    expect(document.body.textContent).toContain("全局 AI 角色");
    expect(document.body.textContent).toContain("任務模式設定檔");
    expect(document.body.textContent).toContain("助手");
    expect(document.body.textContent).toContain("客戶經理");
    expect(document.body.textContent).toContain("任務顧問");
  });

  it("shows staff avatars on the three fixed global slots", async () => {
    await harness.render(SettingsAiProviderPage, {});

    const assistantCard = document.body.querySelector('[data-testid="llm-global-slot-assistant"]');
    const liaisonCard = document.body.querySelector('[data-testid="llm-global-slot-liaison"]');
    const taskEditorCard = document.body.querySelector('[data-testid="llm-global-slot-taskEditor"]');

    expect(assistantCard?.querySelector('[data-testid="ai-staff-avatar-assistant"]')).toBeTruthy();
    expect(liaisonCard?.querySelector('[data-testid="ai-staff-avatar-liaison"]')).toBeTruthy();
    expect(taskEditorCard?.querySelector('[data-testid="ai-staff-avatar-taskEditor"]')).toBeTruthy();
  });

  it("shows bound profile summary on a ready global slot", async () => {
    await harness.render(SettingsAiProviderPage, {});

    const assistant = document.body.querySelector('[data-testid="llm-global-slot-assistant"]');
    expect(assistant?.textContent).toContain("Local · llama3");
    expect(assistant?.textContent).toContain("已綁定");
  });

  it("shows empty state when there are no profiles", async () => {
    listLlmProfiles.mockResolvedValue([]);
    listLlmGlobalSlots.mockResolvedValue(unboundSlots);

    await harness.render(SettingsAiProviderPage, {});

    expect(document.body.querySelector('[data-testid="llm-profiles-empty"]')).toBeTruthy();
    expect(document.body.textContent).toContain("尚無設定檔");
    expect(document.body.querySelector('[data-testid="llm-global-slot-assistant-empty"]')).toBeTruthy();
  });

  it("shows task-staff avatar chips on profile rows", async () => {
    await harness.render(SettingsAiProviderPage, {});

    const row = document.body.querySelector('[data-testid="llm-profile-card-profile-1"]');
    expect(row?.querySelector('[data-testid="ai-staff-avatar-agent"]')).toBeTruthy();
    expect(row?.textContent).toContain("專案經理");
  });

  it("shows ErrorRetryBanner on load failure instead of a spinner", async () => {
    listLlmProfiles.mockRejectedValue(new Error("profiles down"));
    listLlmGlobalSlots.mockRejectedValue(new Error("slots down"));

    await harness.render(SettingsAiProviderPage, {});

    const alert = document.body.querySelector('[role="alert"]');
    expect(alert?.textContent).toMatch(/profiles down|slots down/);
    expect(document.body.textContent).not.toContain("載入 AI 設定檔中");
    expect(
      Array.from(document.body.querySelectorAll("button")).some((btn) => btn.textContent === "重試"),
    ).toBe(true);
  });

  it("shows LLM generation timeout in the advanced section without expanding", async () => {
    await harness.render(SettingsAiProviderPage, {});

    expect(document.body.querySelector('[data-testid="llm-provider-advanced"]')).toBeTruthy();
    expect(document.body.textContent).toContain("進階設定");
    expect(document.body.textContent).toContain("AI 生成超時（秒）");
    const timeout = document.body.querySelector<HTMLInputElement>("#llm-generation-timeout");
    expect(timeout).toBeTruthy();
    expect(timeout!.value).toBe("120");
  });
});
