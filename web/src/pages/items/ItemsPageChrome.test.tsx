import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ItemsPageChrome } from "./ItemsPageChrome";
import {
  itemsPageChromeActionsClass,
  itemsPageChromeInnerClass,
  itemsPageChromeOuterClass,
  itemsPageChromeTitleClass,
  itemsPageChromeTitleClusterClass,
} from "./itemsPageChromeClasses";

describe("ItemsPageChrome", () => {
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

  it("exposes the shared sticky band tokens (border-b + blur + max-w-[1280px])", () => {
    act(() => {
      root.render(
        createElement(ItemsPageChrome, {
          title: "物品",
          actions: createElement("button", { type: "button" }, "add"),
          "data-testid": "items-category-toolbar",
        }),
      );
    });

    const toolbar = container.querySelector('[data-testid="items-category-toolbar"]');
    expect(toolbar).not.toBeNull();
    expect(toolbar!.className).toBe(itemsPageChromeOuterClass);
    expect(toolbar!.className).toContain("sticky");
    expect(toolbar!.className).toContain("border-b");
    expect(toolbar!.className).toContain("backdrop-blur");
    expect(toolbar!.querySelector("h1")?.textContent).toBe("物品");
    expect(toolbar!.querySelector("h1")?.className).toBe(itemsPageChromeTitleClass);

    const row = toolbar!.firstElementChild as HTMLElement;
    expect(row.className).toBe(itemsPageChromeInnerClass);
    expect(row.className).toContain("max-w-[1280px]");
    expect(row.className).toContain("py-sm");
    expect(row.className).toContain("gap-sm");
    expect(row.className).not.toContain("max-w-3xl");
    expect(row.className).not.toContain("max-w-[768px]");

    const titleCluster = row.firstElementChild as HTMLElement;
    expect(titleCluster.className).toBe(itemsPageChromeTitleClusterClass);

    const actions = row.lastElementChild as HTMLElement;
    expect(actions.className).toBe(itemsPageChromeActionsClass);
    expect(actions.className).toContain("relative");
    expect(actions.className).toContain("z-[1]");
  });
});
