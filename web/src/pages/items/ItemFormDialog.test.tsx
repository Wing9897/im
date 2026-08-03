import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ItemCategory, TrackableItem } from "../../api/items";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { ItemFormDialog } from "./ItemFormDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const CATEGORIES: ItemCategory[] = [
  {
    id: "seed_passport_docs",
    name: "證件",
    slug: "passport_docs",
    sortOrder: 10,
    color: "#3B82F6",
    emoji: "🪪",
    fieldSchema: [
      { key: "id_number", label: "證件號碼" },
      { key: "issuer", label: "簽發機關" },
    ],
    defaultRemindBeforeDays: 90,
    createdAt: null,
    updatedAt: null,
  },
  {
    id: "seed_food",
    name: "食物",
    slug: "food",
    sortOrder: 20,
    color: "#22C55E",
    emoji: "🍎",
    fieldSchema: [
      { key: "brand", label: "品牌" },
      { key: "storage", label: "保存方式" },
    ],
    defaultRemindBeforeDays: 3,
    createdAt: null,
    updatedAt: null,
  },
];

const WORKSETS = [
  {
    id: SYSTEM_WORKSET_ID,
    name: "General",
    isSystem: true,
    createdAt: "",
    updatedAt: "",
  },
];

function makeItem(partial: Partial<TrackableItem> = {}): TrackableItem {
  return {
    id: "item-1",
    title: "Passport",
    worksetId: SYSTEM_WORKSET_ID,
    categoryId: "seed_passport_docs",
    purchasedAt: null,
    expiresAt: "2030-01-01",
    remindBeforeDays: 14,
    notes: "",
    status: "active",
    emoji: null,
    attributes: { id_number: "A123456", custom_tag: "keep-me" },
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

describe("ItemFormDialog", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.querySelectorAll('[role="dialog"]').forEach((node) => node.remove());
  });

  function renderDialog(opts?: {
    item?: TrackableItem | null;
    initialCategoryId?: string | null;
    onSave?: (draft: unknown) => Promise<void>;
  }) {
    const onSave = opts?.onSave ?? vi.fn(async () => undefined);
    const onClose = vi.fn();
    act(() => {
      root.render(
        createElement(ItemFormDialog, {
          item: opts?.item === undefined ? makeItem() : opts.item,
          categories: CATEGORIES,
          worksets: WORKSETS,
          categoryLabel: (category) => category?.name ?? "none",
          initialCategoryId: opts?.initialCategoryId ?? null,
          onClose,
          onSave,
        }),
      );
    });
    return { onSave, onClose };
  }

  function categorySelect(): HTMLSelectElement {
    const el = document.getElementById("item-category") as HTMLSelectElement | null;
    expect(el).toBeTruthy();
    return el!;
  }

  function remindInput(): HTMLInputElement {
    const el = document.getElementById("item-remind") as HTMLInputElement | null;
    expect(el).toBeTruthy();
    return el!;
  }

  it("keeps attributes when switching category (extras move to other)", () => {
    renderDialog();

    expect(
      (document.getElementById("item-attr-id_number") as HTMLInputElement).value,
    ).toBe("A123456");
    expect(
      (document.getElementById("item-other-custom_tag") as HTMLInputElement).value,
    ).toBe("keep-me");

    act(() => {
      const select = categorySelect();
      select.value = "seed_food";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Passport schema keys become "other"; food schema shows brand/storage slots.
    expect(document.getElementById("item-attr-id_number")).toBeNull();
    expect(
      (document.getElementById("item-other-id_number") as HTMLInputElement).value,
    ).toBe("A123456");
    expect(
      (document.getElementById("item-other-custom_tag") as HTMLInputElement).value,
    ).toBe("keep-me");
    expect(document.getElementById("item-attr-brand")).toBeTruthy();
    expect(document.getElementById("item-attr-storage")).toBeTruthy();
  });

  it("soft-fills remind from category default only when empty", () => {
    renderDialog({ item: null });
    expect(remindInput().value).toBe("");

    act(() => {
      const select = categorySelect();
      select.value = "seed_food";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(remindInput().value).toBe("3");

    act(() => {
      const select = categorySelect();
      select.value = "seed_passport_docs";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    // Existing soft-filled 3 must not be overwritten by passport default (90).
    expect(remindInput().value).toBe("3");
  });

  it("does not overwrite an explicit remind when category changes", () => {
    renderDialog({ item: makeItem({ remindBeforeDays: 14 }) });
    expect(remindInput().value).toBe("14");

    act(() => {
      const select = categorySelect();
      select.value = "seed_food";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(remindInput().value).toBe("14");
  });

  it("soft-fills remind from initialCategoryId when creating", () => {
    renderDialog({ item: null, initialCategoryId: "seed_food" });
    expect(categorySelect().value).toBe("seed_food");
    expect(remindInput().value).toBe("3");
  });

  it("submits retained attributes after a category switch", async () => {
    const onSave = vi.fn(async () => undefined);
    renderDialog({ onSave });

    act(() => {
      const select = categorySelect();
      select.value = "seed_food";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const save = buttons.find((btn) => btn.textContent === "save");
      save?.click();
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: "seed_food",
        attributes: { id_number: "A123456", custom_tag: "keep-me" },
        remindBeforeDays: 14,
      }),
    );
  });
});
