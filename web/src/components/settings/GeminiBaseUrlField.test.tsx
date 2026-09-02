import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "../../i18n";
import { GeminiBaseUrlField } from "./GeminiBaseUrlField";

describe("GeminiBaseUrlField", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(async () => {
    await i18n.changeLanguage("zh-Hant");
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
  });

  function renderField(overrides: Partial<Parameters<typeof GeminiBaseUrlField>[0]> = {}) {
    const props = {
      value: "",
      placeholder: "https://generativelanguage.googleapis.com/v1beta",
      onChange: vi.fn(),
      ...overrides,
    };
    act(() => {
      root = createRoot(container);
      root.render(createElement(GeminiBaseUrlField, props));
    });
    return props;
  }

  it("opens preset menu and applies Beta or 正式 URL without datalist", () => {
    const props = renderField({
      value: "https://generativelanguage.googleapis.com/v1beta",
    });

    expect(container.querySelector("datalist")).toBeNull();

    const toggle = container.querySelector<HTMLButtonElement>("button[aria-label='選擇 Gemini API 版本']");
    expect(toggle).toBeTruthy();
    act(() => {
      toggle!.click();
    });

    const list = document.body.querySelector(
      '[data-testid="gemini-base-url-presets"]',
    ) as HTMLElement | null;
    expect(list).toBeTruthy();
    expect(container.querySelector('[data-testid="gemini-base-url-presets"]')).toBeNull();
    expect(list?.parentElement).toBe(document.body);
    expect(list?.style.zIndex).toBe("3000");
    expect(list?.textContent).toContain("Beta（預覽版，官方預設）");
    expect(list?.textContent).toContain("正式（穩定版）");

    const formalOption = Array.from(list!.querySelectorAll("button[role='option']")).find((button) =>
      button.textContent?.includes("正式（穩定版）"),
    );
    expect(formalOption).toBeTruthy();
    act(() => {
      formalOption!.click();
    });

    expect(props.onChange).toHaveBeenCalledWith("https://generativelanguage.googleapis.com/v1");
  });
});
