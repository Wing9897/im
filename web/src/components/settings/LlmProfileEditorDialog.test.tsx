import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness, type TestHarness } from "../../test/render-helpers";
import { ensureZhHantLocale } from "../../test/i18nHarness";
import { DEFAULT_PROVIDER_BASE_URLS } from "../../domain/settings/llmProviderConfig";
import { DEFAULT_WEB_SEARCH_PROVIDER } from "../../domain/settings/assistantWebSearchRoute";
import {
  emptyProfileDraft,
  LlmProfileEditorDialog,
  type LlmProfileDraft,
} from "./LlmProfileEditorDialog";

describe("LlmProfileEditorDialog", () => {
  let harness: TestHarness;

  beforeEach(async () => {
    await ensureZhHantLocale();
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.cleanup();
  });

  it("defaults new profile web search to DuckDuckGo", () => {
    expect(emptyProfileDraft().webSearchProvider).toBe(DEFAULT_WEB_SEARCH_PROVIDER);
  });

  it("uses form-size shell with sectioned layout", async () => {
    await harness.render(LlmProfileEditorDialog, {
      open: true,
      mode: "create",
      initial: emptyProfileDraft(),
      saving: false,
      onClose: vi.fn(),
      onSave: vi.fn(),
    });

    const dialog = document.body.querySelector('[data-testid="llm-profile-editor-dialog"]');
    expect(dialog).toBeTruthy();

    const shell = dialog?.querySelector('[role="dialog"]');
    expect(shell?.className ?? "").toContain("w-[720px]");
    expect(shell?.className ?? "").toContain("h-[min(86vh,780px)]");

    expect(dialog?.querySelector('[aria-label="設定檔"]')).toBeTruthy();
    expect(dialog?.querySelector('[aria-label="供應商與模型"]')).toBeTruthy();
    expect(dialog?.querySelector('[aria-label="任務員工綁定"]')).toBeTruthy();
    expect(dialog?.querySelector('[aria-label="聯網搜尋"]')).toBeTruthy();

    const staff = dialog?.querySelector('[data-testid="llm-profile-staff-classes"]');
    expect(staff?.className ?? "").toContain("sm:grid-cols-2");
    // Task-mode only — assistant is a global slot, not a checkbox.
    expect(staff?.querySelector("#llm-profile-staff-assistant")).toBeNull();
    expect(staff?.querySelector("#llm-profile-staff-agent")).toBeTruthy();

    const save = Array.from(dialog?.querySelectorAll("button") ?? []).find((btn) =>
      (btn.textContent ?? "").includes("儲存"),
    );
    expect(save?.disabled).toBe(true);
  });

  function providerTile(label: string): HTMLButtonElement | undefined {
    return Array.from(
      document.body.querySelectorAll<HTMLButtonElement>("button[aria-pressed]"),
    ).find((btn) => (btn.textContent ?? "").includes(label));
  }

  function baseUrlInput(): HTMLInputElement | null {
    return document.body.querySelector<HTMLInputElement>("#llm-base-url");
  }

  it("resets leftover Ollama localhost when switching provider to Gemini", async () => {
    const initial: LlmProfileDraft = {
      ...emptyProfileDraft(),
      name: "local",
      provider: "ollama",
      baseUrl: DEFAULT_PROVIDER_BASE_URLS.ollama,
    };

    await harness.render(LlmProfileEditorDialog, {
      open: true,
      mode: "edit",
      initial,
      saving: false,
      onClose: vi.fn(),
      onSave: vi.fn(),
    });

    expect(baseUrlInput()?.value).toBe(DEFAULT_PROVIDER_BASE_URLS.ollama);

    const gemini = providerTile("Gemini");
    expect(gemini).toBeTruthy();
    await act(async () => {
      gemini!.click();
    });

    expect(baseUrlInput()?.value).toBe(DEFAULT_PROVIDER_BASE_URLS.gemini_compatible);
  });

  it("keeps a custom Gemini proxy when switching away after the user edited it", async () => {
    const custom = "https://proxy.example.com/gemini";
    const initial: LlmProfileDraft = {
      ...emptyProfileDraft(),
      name: "proxy",
      provider: "gemini_compatible",
      baseUrl: custom,
    };

    await harness.render(LlmProfileEditorDialog, {
      open: true,
      mode: "edit",
      initial,
      saving: false,
      onClose: vi.fn(),
      onSave: vi.fn(),
    });

    expect(baseUrlInput()?.value).toBe(custom);

    const openai = providerTile("OpenAI");
    expect(openai).toBeTruthy();
    await act(async () => {
      openai!.click();
    });

    expect(baseUrlInput()?.value).toBe(custom);
  });

  it("fills the Gemini default when switching from an empty URL", async () => {
    const initial: LlmProfileDraft = {
      ...emptyProfileDraft(),
      name: "blank",
      provider: "ollama",
      baseUrl: "",
    };

    await harness.render(LlmProfileEditorDialog, {
      open: true,
      mode: "create",
      initial,
      saving: false,
      onClose: vi.fn(),
      onSave: vi.fn(),
    });

    await act(async () => {
      providerTile("Gemini")!.click();
    });

    expect(baseUrlInput()?.value).toBe(DEFAULT_PROVIDER_BASE_URLS.gemini_compatible);
  });
});
