import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../../../test/i18nIdentityMock";

import { ItemFormCvBelonging } from "./ItemFormCvBelonging";
import {
  ITEM_FORM_TEST_WORKSETS,
  makeItemCategory,
} from "./itemFormTestFixtures";

const CATEGORY = makeItemCategory({ id: "cat-a", name: "Alpha", emoji: "🍎" });
const DEFAULT_WORKSET_ID = ITEM_FORM_TEST_WORKSETS[0]!.id;

describe("ItemFormCvBelonging", () => {
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
  });

  async function renderBelonging(
    overrides: Partial<Parameters<typeof ItemFormCvBelonging>[0]> = {},
  ) {
    await act(async () => {
      root.render(
        createElement(ItemFormCvBelonging, {
          worksetId: DEFAULT_WORKSET_ID,
          categoryId: "cat-a",
          categories: [CATEGORY],
          worksets: ITEM_FORM_TEST_WORKSETS,
          categoryLabel: (category) => category?.name ?? "none",
          busy: false,
          onWorksetChange: vi.fn(),
          onCategoryChange: vi.fn(),
          ...overrides,
        }),
      );
      await Promise.resolve();
    });
  }

  it("shows the current category and workset on the field trigger", async () => {
    await renderBelonging();
    expect(
      document.querySelector('[data-testid="item-form-category-select-value"]')?.textContent?.trim(),
    ).toBe("🍎 Alpha");
    expect(
      document.querySelector('[data-testid="item-form-workset-select-value"]')?.textContent?.trim(),
    ).toBe("General");
  });

  it("keeps orphan category ids selectable", async () => {
    await renderBelonging({ categoryId: "missing-cat", categories: [] });
    const trigger = document.getElementById("item-category") as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    expect(
      document.querySelector('[data-testid="item-form-category-select-value"]')?.textContent?.trim(),
    ).toBe("missing-cat");
  });
});
