import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../../../test/i18nIdentityMock";

import { ItemFormAttributesSection } from "./ItemFormSections";

describe("ItemFormAttributesSection", () => {
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

  async function renderSection(
    overrides: Partial<Parameters<typeof ItemFormAttributesSection>[0]> = {},
  ) {
    const props = {
      partitions: { suggested: [], other: [] },
      extraKey: "",
      extraValue: "",
      saving: false,
      onAttrChange: vi.fn(),
      onAttrRemove: vi.fn(),
      onExtraKeyChange: vi.fn(),
      onExtraValueChange: vi.fn(),
      onAddExtra: vi.fn(),
      ...overrides,
    };

    await act(async () => {
      root.render(createElement(ItemFormAttributesSection, props));
      await Promise.resolve();
    });

    return props;
  }

  it("renders suggested and other fields in one field grid", async () => {
    await renderSection({
      partitions: {
        suggested: [{ key: "brand", label: "Brand", value: "Acme" }],
        other: [{ key: "tag", value: "vip" }],
      },
    });

    expect(document.querySelector('[data-testid="item-form-attribute-grid"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="item-form-attribute-chip-brand"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="item-form-attribute-chip-tag"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="item-form-add-attribute"]')).toBeTruthy();
  });

  it("opens inline add panel from dashed chip", async () => {
    await renderSection();

    const add = document.querySelector(
      '[data-testid="item-form-add-attribute"]',
    ) as HTMLButtonElement;
    await act(async () => {
      add.click();
    });

    expect(document.querySelector('[data-testid="item-form-add-attribute-panel"]')).toBeTruthy();
    expect(document.getElementById("item-extra-key")).toBeTruthy();
    expect(document.getElementById("item-extra-value")).toBeTruthy();
  });

  it("enters edit mode when pen is clicked", async () => {
    await renderSection({
      partitions: {
        suggested: [{ key: "brand", label: "Brand", value: "Acme" }],
        other: [],
      },
    });

    const edit = document.querySelector(
      '[data-testid="item-form-attribute-edit-brand"]',
    ) as HTMLButtonElement;
    await act(async () => {
      edit.click();
    });

    expect(document.getElementById("item-attr-brand")).toBeTruthy();
  });

  it("removes attribute key when delete is clicked", async () => {
    const props = await renderSection({
      partitions: {
        suggested: [],
        other: [{ key: "tag", value: "vip" }],
      },
    });

    const del = document.querySelector(
      '[data-testid="item-form-attribute-delete-tag"]',
    ) as HTMLButtonElement;
    expect(del).toBeTruthy();

    await act(async () => {
      del.click();
    });

    expect(props.onAttrRemove).toHaveBeenCalledWith("tag");
  });
});
