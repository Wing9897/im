import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../../../test/i18nIdentityMock";

import { ItemFormCvInventory } from "./ItemFormCvInventory";

describe("ItemFormCvInventory", () => {
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

  async function renderInventory(
    overrides: Partial<Parameters<typeof ItemFormCvInventory>[0]> = {},
  ) {
    const props = {
      quantityInput: "",
      unit: "",
      priceInput: "",
      busy: false,
      onQuantityInputChange: vi.fn(),
      onUnitChange: vi.fn(),
      onPriceInputChange: vi.fn(),
      ...overrides,
    };

    await act(async () => {
      root.render(createElement(ItemFormCvInventory, props));
      await Promise.resolve();
    });

    return props;
  }

  it("groups quantity and unit adjacent in one cluster", async () => {
    await renderInventory({ quantityInput: "2", unit: "kg" });

    const cluster = document.querySelector('[data-testid="item-form-cv-inventory-qty-unit"]');
    expect(cluster).toBeTruthy();
    expect(cluster?.querySelector('[data-testid="item-form-quantity-input"]')).toBeTruthy();
    expect(cluster?.querySelector("#item-unit")).toBeTruthy();
    expect(
      cluster?.contains(document.querySelector('[data-testid="item-form-price-input"]')),
    ).toBe(false);
  });

  it("renders price with dollar prefix input", async () => {
    await renderInventory({ priceInput: "1280" });

    const price = document.querySelector(
      '[data-testid="item-form-price-input"]',
    ) as HTMLInputElement;
    expect(price?.value).toBe("1280");
    expect(price?.className).toContain("pl-6");
  });
});
