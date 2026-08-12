import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSessionLlmProfileSelect } from "./AssistantSessionLlmProfileSelect";
import { ensureZhHantLocale, wrapWithI18n } from "../../test/i18nHarness";

const listLlmProfiles = vi.fn();
const listLlmGlobalSlots = vi.fn();

vi.mock("../../api/llmProfiles", () => ({
  listLlmProfiles: (...args: unknown[]) => listLlmProfiles(...args),
  listLlmGlobalSlots: (...args: unknown[]) => listLlmGlobalSlots(...args),
}));

function completeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "profile-complete",
    name: "Ollama local",
    provider: "ollama",
    baseUrl: "http://localhost:11434",
    model: "llama3",
    apiKey: "",
    thinkingEnabled: false,
    jsonMode: "disabled",
    webSearchEnabled: true,
    webSearchProvider: "auto",
    braveSearchApiKey: "",
    isDefault: true,
    staffClasses: [],
    staffInstances: [],
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

function boundAssistantSlots(profileId = "profile-complete") {
  return [
    {
      slot: "assistant",
      profileId,
      profileName: "Ollama local",
      profileProvider: "ollama",
      profileModel: "llama3",
      profileIsDefault: true,
    },
    {
      slot: "liaison",
      profileId: null,
      profileName: null,
      profileProvider: null,
      profileModel: null,
      profileIsDefault: null,
    },
    {
      slot: "taskEditor",
      profileId: null,
      profileName: null,
      profileProvider: null,
      profileModel: null,
      profileIsDefault: null,
    },
  ];
}

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  await ensureZhHantLocale();
  listLlmProfiles.mockReset();
  listLlmGlobalSlots.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("AssistantSessionLlmProfileSelect", () => {
  it("guides to assistant global slot when unbound", async () => {
    listLlmProfiles.mockResolvedValue([completeProfile()]);
    listLlmGlobalSlots.mockResolvedValue(
      boundAssistantSlots().map((row) =>
        row.slot === "assistant" ? { ...row, profileId: null } : row,
      ),
    );
    const onChange = vi.fn();

    await act(async () => {
      root.render(
        wrapWithI18n(
          createElement(AssistantSessionLlmProfileSelect, {
            value: null,
            onChange,
          }),
        ),
      );
    });

    expect(container.querySelector('[data-testid="assistant-llm-profile-unbound"]')).toBeTruthy();
    const cta = container.querySelector(
      '[data-testid="assistant-llm-profile-slot-cta"]',
    ) as HTMLAnchorElement | null;
    expect(cta?.getAttribute("href")).toBe("/ai/provider");
    expect(container.textContent).toContain("全局 AI 角色");
  });

  it("renders follow-slot option when assistant slot is bound and complete", async () => {
    listLlmProfiles.mockResolvedValue([
      completeProfile(),
      completeProfile({
        id: "profile-incomplete",
        name: "Broken",
        model: "",
        isDefault: false,
        staffClasses: [],
      }),
    ]);
    listLlmGlobalSlots.mockResolvedValue(boundAssistantSlots());
    const onChange = vi.fn();

    await act(async () => {
      root.render(
        wrapWithI18n(
          createElement(AssistantSessionLlmProfileSelect, {
            value: null,
            onChange,
          }),
        ),
      );
    });

    expect(container.querySelector('[data-testid="assistant-llm-profile"]')).toBeTruthy();
    expect(container.textContent).toContain("跟隨助手槽位");
  });

  it("clears a stale incomplete override after profiles load", async () => {
    listLlmProfiles.mockResolvedValue([
      completeProfile({
        id: "profile-incomplete",
        name: "Broken",
        model: "",
        isDefault: false,
      }),
      completeProfile({ id: "profile-ok", name: "OK", isDefault: false }),
    ]);
    listLlmGlobalSlots.mockResolvedValue(boundAssistantSlots("profile-ok"));
    const onChange = vi.fn();

    await act(async () => {
      root.render(
        wrapWithI18n(
          createElement(AssistantSessionLlmProfileSelect, {
            value: "profile-incomplete",
            onChange,
          }),
        ),
      );
    });

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
