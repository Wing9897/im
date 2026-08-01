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
  });
});
