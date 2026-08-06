import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ItemFormToolbar } from "./ItemFormToolbar";
import {
  itemsPageChromeInnerClass,
  itemsPageChromeOuterClass,
  itemsPageChromePrimaryActionClass,
  itemsPageChromeTitleClusterClass,
} from "./itemsPageChromeClasses";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("ItemFormToolbar", () => {
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

  it("uses the shared ItemsPageChrome outer/inner classes", () => {
    act(() => {
      root.render(
        createElement(ItemFormToolbar, {
          isEditMode: false,
          canSave: true,
          busy: false,
          onBack: vi.fn(),
          onSave: vi.fn(),
        }),
      );
    });

    const toolbar = container.querySelector('[data-testid="item-form-toolbar"]');
    expect(toolbar).not.toBeNull();
    expect(toolbar!.className).toBe(itemsPageChromeOuterClass);
    expect(toolbar!.className).toContain("sticky");
    expect(toolbar!.className).toContain("border-b");

    const row = toolbar!.firstElementChild as HTMLElement;
    expect(row.className).toBe(itemsPageChromeInnerClass);
    expect(row.className).toContain("max-w-5xl");
    expect(row.className).toContain("py-sm");
    expect(row.className).not.toContain("max-w-3xl");
    expect(row.className).not.toContain("max-w-[768px]");

    const titleCluster = row.firstElementChild as HTMLElement;
    expect(titleCluster.className).toBe(itemsPageChromeTitleClusterClass);
  });

  it("renders title and wires back / save with shared primary action class", () => {
    const onBack = vi.fn();
    const onSave = vi.fn();
    act(() => {
      root.render(
        createElement(ItemFormToolbar, {
          isEditMode: true,
          canSave: true,
          busy: false,
          onBack,
          onSave,
        }),
      );
    });

    expect(container.querySelector("h1")?.textContent).toBe("editItem");

    act(() => {
      (container.querySelector('button[aria-label="backToList"]') as HTMLButtonElement).click();
    });
    expect(onBack).toHaveBeenCalledTimes(1);

    const save = container.querySelector(
      '[data-testid="item-form-save"]',
    ) as HTMLButtonElement;
    expect(save.className).toContain(itemsPageChromePrimaryActionClass);
    act(() => {
      save.click();
    });
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
