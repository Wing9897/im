import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness, type TestHarness } from "../../test/render-helpers";
import { ensureZhHantLocale } from "../../test/i18nHarness";
import { emptyProfileDraft, LlmProfileEditorDialog } from "./LlmProfileEditorDialog";

describe("LlmProfileEditorDialog", () => {
  let harness: TestHarness;

  beforeEach(async () => {
    await ensureZhHantLocale();
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.cleanup();
  });

  it("uses form-size shell with sectioned layout", async () => {
    await harness.render(LlmProfileEditorDialog, {
      open: true,
      mode: "create",
      initial: emptyProfileDraft(true),
      saving: false,
      onClose: vi.fn(),
      onSave: vi.fn(),
    });

    const dialog = document.body.querySelector('[data-testid="llm-profile-editor-dialog"]');
    expect(dialog).toBeTruthy();

    const shell = dialog?.querySelector('[role="dialog"]');
    expect(shell?.className ?? "").toContain("w-[720px]");
    expect(shell?.className ?? "").toContain("max-h-[min(86vh,780px)]");

    expect(dialog?.querySelector('[aria-label="設定檔"]')).toBeTruthy();
    expect(dialog?.querySelector('[aria-label="供應商與模型"]')).toBeTruthy();
    expect(dialog?.querySelector('[aria-label="員工綁定"]')).toBeTruthy();
    expect(dialog?.querySelector('[aria-label="聯網搜尋"]')).toBeTruthy();

    const staff = dialog?.querySelector('[data-testid="llm-profile-staff-classes"]');
    expect(staff?.className ?? "").toContain("sm:grid-cols-2");

    const save = Array.from(dialog?.querySelectorAll("button") ?? []).find((btn) =>
      (btn.textContent ?? "").includes("儲存"),
    );
    expect(save?.disabled).toBe(true);
  });
});
