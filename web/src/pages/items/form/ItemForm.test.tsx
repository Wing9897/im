import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../emoji/emojiPickerReactMock";
import "./itemFormTestMocks";

import {
  cleanupItemFormDialogs,
  commitItemTitle,
  createItemFormRenderer,
  flushDeferredEmojiGrid,
  makeItem,
  pickCategory,
  resetItemFormTestMocks,
  waitForEmojiDialogDismiss,
} from "./itemFormTestHarness";

describe("ItemForm", () => {
  let container: HTMLDivElement;
  let root: Root;
  let renderForm: ReturnType<typeof createItemFormRenderer>;

  beforeEach(() => {
    resetItemFormTestMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    renderForm = createItemFormRenderer(root);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    cleanupItemFormDialogs();
  });

  it("does not render removed item-level date fields", async () => {
    await renderForm();
    expect(document.getElementById("item-purchased")).toBeNull();
    expect(document.getElementById("item-expires")).toBeNull();
    expect(document.getElementById("item-remind")).toBeNull();
  });

  it("renders a CV identity header with avatar, title, and labeled meta", async () => {
    await renderForm({
      item: makeItem({
        emoji: "🪪",
        expiresAt: "2030-01-01",
        status: "archived",
        quantity: 2,
        unit: "kg",
        price: 1280,
      }),
    });

    expect(document.querySelector('[data-testid="item-form-cv"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="item-form-cv-header"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="item-form-cv-meta"]')).toBeTruthy();
    expect(
      document.querySelector('[data-testid="item-form-cv-title-display"]')?.textContent,
    ).toBe("Passport");
    expect(document.querySelector('[data-testid="item-form-cv-title-edit"]')).toBeTruthy();
    expect(document.getElementById("item-title")).toBeNull();
    expect(
      document.querySelector('[data-testid="item-form-category-select-value"]')?.textContent?.trim(),
    ).toBe("🪪 證件");
    expect(
      document.querySelector('[data-testid="item-form-workset-select-value"]')?.textContent?.trim(),
    ).toBe("General");
    expect(document.querySelector('[data-testid="item-form-cv-status-badge"]')?.textContent).toBe(
      "statusArchived",
    );

    const header = document.querySelector('[data-testid="item-form-cv-header"]');
    expect(header?.querySelector('[data-testid="item-form-cv-inventory"]')).toBeTruthy();
    expect(header?.querySelector('[data-testid="item-form-cv-inventory-qty-unit"]')).toBeTruthy();
    expect(
      (header?.querySelector('[data-testid="item-form-quantity-input"]') as HTMLInputElement)?.value,
    ).toBe("2");
    expect((header?.querySelector('[data-testid="item-form-price-input"]') as HTMLInputElement)?.value).toBe(
      "1280",
    );
  });

  it("places notes full width at the bottom, not in a sidebar column", async () => {
    await renderForm();

    const cv = document.querySelector('[data-testid="item-form-cv"]');
    const body = document.querySelector('[data-testid="item-form-cv-body"]');
    const notes = document.querySelector('[data-testid="item-form-notes"]');

    expect(body?.contains(notes)).toBe(false);
    expect(cv?.contains(notes)).toBe(true);
    expect(notes?.parentElement?.className).not.toMatch(/border-l/);
  });

  it("uses compact emoji trigger (not free-text) and submits selection", async () => {
    const onSave = vi.fn(async () => undefined);
    const { formRef } = await renderForm({
      item: makeItem({ emoji: null }),
      onSave,
    });

    expect(document.querySelector("input#item-emoji")).toBeNull();
    const trigger = document.querySelector(
      '[data-testid="emoji-picker-trigger"]',
    ) as HTMLButtonElement;
    await act(async () => {
      trigger.click();
    });
    await flushDeferredEmojiGrid();

    const pick = document.querySelector(
      '[data-testid="emoji-option-🍎"]',
    ) as HTMLButtonElement;
    await act(async () => {
      pick.click();
    });

    const done = document.querySelector(
      '[data-testid="emoji-picker-done"]',
    ) as HTMLButtonElement;
    await act(async () => {
      done.click();
    });
    await waitForEmojiDialogDismiss();

    await act(async () => {
      await formRef.current?.submit();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        emoji: "🍎",
      }),
    );
  });

  it("clears emoji via picker clear control", async () => {
    const onSave = vi.fn(async () => undefined);
    const { formRef } = await renderForm({
      item: makeItem({ emoji: "🍎" }),
      onSave,
    });

    const clear = document.querySelector(
      '[data-testid="emoji-picker-clear"]',
    ) as HTMLButtonElement;
    await act(async () => {
      clear.click();
    });

    await act(async () => {
      await formRef.current?.submit();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        emoji: null,
      }),
    );
  });

  it("shows friendly extras section with schema labels in field grid", async () => {
    await renderForm();

    const extras = document.querySelector('[data-testid="item-form-extras"]');
    expect(extras?.textContent).toContain("sectionExtras");
    expect(extras?.textContent).toContain("證件號碼");
    expect(document.querySelector('[data-testid="item-form-attribute-grid"]')).toBeTruthy();
  });

  it("shows empty extras hint when item has no suggested or other attributes", async () => {
    await renderForm({
      item: makeItem({
        categoryId: null,
        attributes: {},
      }),
    });

    expect(
      document.querySelector('[data-testid="item-form-extras"]')?.textContent,
    ).toContain("attributesEmpty");
  });

  async function openAttributeEditor(key: string) {
    const edit = document.querySelector(
      `[data-testid="item-form-attribute-edit-${key}"]`,
    ) as HTMLButtonElement;
    await act(async () => {
      edit.click();
    });
  }

  it("keeps attributes when switching category (extras move to other)", async () => {
    await renderForm();

    await openAttributeEditor("id_number");
    expect(
      (document.getElementById("item-attr-id_number") as HTMLInputElement).value,
    ).toBe("A123456");

    await pickCategory("seed_food");

    await openAttributeEditor("id_number");
    expect(
      (document.getElementById("item-other-id_number") as HTMLInputElement).value,
    ).toBe("A123456");
  });

  it("create mode shows title display with edit button, not a direct input", async () => {
    await renderForm({ item: null });

    expect(document.getElementById("item-title")).toBeNull();
    expect(document.querySelector('[data-testid="item-form-cv-title-edit"]')).toBeTruthy();
    expect(
      document.querySelector('[data-testid="item-form-cv-title-display"]')?.textContent,
    ).toBe("titleField");
  });

  it("create mode seeds category preset keys into submit attributes", async () => {
    const onSave = vi.fn(async () => undefined);
    const { formRef } = await renderForm({
      item: null,
      initialCategoryId: "seed_passport_docs",
      onSave,
    });

    await commitItemTitle("證件一");

    await act(async () => {
      await formRef.current?.submit();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "證件一",
        categoryId: "seed_passport_docs",
        attributes: expect.objectContaining({
          id_number: "",
          issuer: "",
        }),
      }),
    );
  });

  it("submits ItemSaveDraft without legacy date fields", async () => {
    const onSave = vi.fn(async () => undefined);
    const { formRef } = await renderForm({ onSave });

    await pickCategory("seed_food");

    await act(async () => {
      await formRef.current?.submit();
    });

    const draft = onSave.mock.calls[0][0] as Record<string, unknown>;
    expect(draft).not.toHaveProperty("purchasedAt");
    expect(draft).not.toHaveProperty("expiresAt");
    expect(draft).not.toHaveProperty("remindBeforeDays");
  });

  it("submits quantity, unit, and price from header inventory fields", async () => {
    const onSave = vi.fn(async () => undefined);
    const { formRef } = await renderForm({
      item: makeItem({ quantity: null, unit: null, price: null }),
      onSave,
    });

    const quantity = document.querySelector(
      '[data-testid="item-form-quantity-input"]',
    ) as HTMLInputElement;
    const price = document.querySelector(
      '[data-testid="item-form-price-input"]',
    ) as HTMLInputElement;

    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(quantity, "3");
      quantity.dispatchEvent(new Event("input", { bubbles: true }));
      setter?.call(price, "99.5");
      price.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      await formRef.current?.submit();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 3,
        price: 99.5,
      }),
    );
  });
});
