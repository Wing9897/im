import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSessionLlmProfileSelect } from "./AssistantSessionLlmProfileSelect";
import { ensureZhHantLocale, wrapWithI18n } from "../../test/i18nHarness";

const listLlmProfiles = vi.fn();

vi.mock("../../api/llmProfiles", () => ({
  listLlmProfiles: (...args: unknown[]) => listLlmProfiles(...args),
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
    staffClasses: ["assistant"],
    staffInstances: [],
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  await ensureZhHantLocale();
  listLlmProfiles.mockReset();
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
  it("shows create CTA when profiles list is empty", async () => {
    listLlmProfiles.mockResolvedValue([]);
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

    expect(container.querySelector('[data-testid="assistant-llm-profile-empty"]')).toBeTruthy();
    const cta = container.querySelector(
      '[data-testid="assistant-llm-profile-create-cta"]',
    ) as HTMLAnchorElement | null;
    expect(cta?.getAttribute("href")).toBe("/ai/provider");
  });

  it("renders follow-staff option and disables incomplete profiles", async () => {
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
    expect(container.textContent).toContain("跟隨員工設定檔");
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
