import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MenuSelect } from "./MenuSelect";

const options = [
  { value: "default", label: "跟隨預設（花瓣）" },
  { value: "none", label: "無紋理" },
  { value: "leaf", label: "葉片" },
] as const;

describe("MenuSelect", () => {
  it("renders a full-width trigger showing the current label", () => {
    const html = renderToStaticMarkup(
      createElement(MenuSelect, {
        value: "default",
        options,
        onChange: () => {},
        "data-testid": "theme-texture-pref",
        "aria-label": "紋理",
      }),
    );
    expect(html).toContain("跟隨預設（花瓣）");
    expect(html).toContain('data-testid="theme-texture-pref"');
    expect(html).toContain('data-testid="theme-texture-pref-value"');
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("min-width:280px");
    expect(html).toContain("white-space:nowrap");
    expect(html).toContain("text-overflow:ellipsis");
    expect(html).not.toContain('role="listbox"');
    expect(html).not.toContain('role="radiogroup"');
  });

  it("field variant uses form control chrome without the 280px min width", () => {
    const html = renderToStaticMarkup(
      createElement(MenuSelect, {
        value: "cat-a",
        options: [{ value: "cat-a", label: "🍎 Alpha" }],
        onChange: () => {},
        variant: "field",
        "data-testid": "item-form-category-select",
        "aria-label": "Category",
      }),
    );
    expect(html).toContain("🍎 Alpha");
    expect(html).toContain('data-testid="item-form-category-select-value"');
    expect(html).toContain("w-full");
    expect(html).toContain("width:100%");
    expect(html).not.toContain("min-width:280px");
  });

  it("toolbar variant stays inline and does not force full width", () => {
    const html = renderToStaticMarkup(
      createElement(MenuSelect, {
        value: "12",
        options: [{ value: "12", label: "LIVE ±12h" }],
        onChange: () => {},
        variant: "toolbar",
        "data-testid": "map-live-window-select",
        "aria-label": "Live window",
      }),
    );
    expect(html).toContain("LIVE ±12h");
    expect(html).toContain("inline-flex");
    expect(html).toContain("w-auto");
    expect(html).toContain("shrink-0");
    expect(html).toContain("width:auto");
    expect(html).not.toMatch(/(?:^|[^-])width:100%/);
    expect(html).not.toContain("min-width:280px");
    // Shell must not bake w-full (toolbar call sites used to fight this with className).
    expect(html).not.toMatch(/class="[^"]*\bw-full\b/);
  });

  describe("interactive listbox", () => {
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

    it("opens a listbox and selects an option", () => {
      const onChange = vi.fn();
      act(() => {
        root.render(
          createElement(MenuSelect, {
            value: "leaf",
            options,
            onChange,
            "data-testid": "theme-texture-pref",
            "aria-label": "紋理",
          }),
        );
      });

      const trigger = container.querySelector<HTMLButtonElement>(
        '[data-testid="theme-texture-pref-value"]',
      );
      expect(trigger).toBeTruthy();
      expect(trigger?.textContent).toContain("葉片");
      expect(trigger?.getAttribute("aria-expanded")).toBe("false");
      expect(getComputedStyle(trigger!).minWidth).not.toBe("0px");

      act(() => {
        trigger?.click();
      });

      expect(trigger?.getAttribute("aria-expanded")).toBe("true");
      const list = container.querySelector('[data-testid="theme-texture-pref-list"]');
      expect(list?.getAttribute("role")).toBe("listbox");
      expect(
        container.querySelector('[data-testid="theme-texture-pref-option-default"]'),
      ).toBeTruthy();

      act(() => {
        container
          .querySelector<HTMLButtonElement>(
            '[data-testid="theme-texture-pref-option-default"]',
          )
          ?.click();
      });

      expect(onChange).toHaveBeenCalledWith("default");
      expect(container.querySelector('[data-testid="theme-texture-pref-list"]')).toBeNull();
    });

    it("portals the listbox to document.body when menuPortal is set", () => {
      act(() => {
        root.render(
          createElement(MenuSelect, {
            value: "leaf",
            options,
            onChange: () => {},
            menuPortal: true,
            "data-testid": "portal-select",
            "aria-label": "紋理",
          }),
        );
      });

      const trigger = container.querySelector<HTMLButtonElement>(
        '[data-testid="portal-select-value"]',
      );
      act(() => {
        trigger?.click();
      });

      const list = document.body.querySelector('[data-testid="portal-select-list"]');
      expect(list).toBeTruthy();
      expect(container.querySelector('[data-testid="portal-select-list"]')).toBeNull();
      expect(list?.parentElement).toBe(document.body);
    });
  });
});
