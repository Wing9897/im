import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
import i18n from "../../i18n";
import { createTestHarness, type TestHarness } from "../../test/render-helpers";
import {
  getAppLocalePreference,
  setAppLocalePreference,
} from "../../i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";

describe("LanguageSwitcher", () => {
  let harness: TestHarness;

  beforeEach(async () => {
    localStorage.removeItem("im:ui-locale");
    setAppLocalePreference("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.cleanup();
    localStorage.removeItem("im:ui-locale");
  });

  it("renders visible chip options with the current preference selected", async () => {
    await harness.render(LanguageSwitcher);

    const root = harness.container.querySelector('[data-testid="language-switcher"]');
    expect(root).not.toBeNull();
    expect(root?.textContent).toContain("介面語言");
    expect(root?.textContent).toContain("自動跟隨系統；選語系則整站使用該語言。");

    const options = root!.querySelector('[data-testid="language-switcher-options"]');
    expect(options?.querySelectorAll('input[type="radio"]')).toHaveLength(4);
    expect(
      (root!.querySelector('[data-testid="language-option-zh-Hant"]') as HTMLInputElement).checked,
    ).toBe(true);

    expect(root?.textContent).toContain("自動");
    expect(root?.textContent).toContain("繁體中文");
    expect(root?.textContent).toContain("简体中文");
    expect(root?.textContent).toContain("English");
  });

  it("updates preference when another chip is chosen", async () => {
    await harness.render(LanguageSwitcher);

    const english = harness.container.querySelector(
      '[data-testid="language-option-en"]',
    ) as HTMLInputElement;

    await act(async () => {
      english.click();
    });

    expect(getAppLocalePreference()).toBe("en");
    expect(english.checked).toBe(true);
  });

  it("compact variant is a MenuSelect without settings help copy", async () => {
    await harness.render(() => createElement(LanguageSwitcher, { variant: "compact" }));

    const root = harness.container.querySelector('[data-testid="language-switcher"]');
    expect(root?.getAttribute("data-variant")).toBe("compact");
    expect(root?.textContent).not.toContain("自動跟隨系統");
    expect(root?.querySelectorAll('input[type="radio"]')).toHaveLength(0);

    const trigger = root!.querySelector(
      '[data-testid="language-switcher-select-value"]',
    ) as HTMLButtonElement;
    expect(trigger).not.toBeNull();
    expect(trigger.getAttribute("aria-label")).toBe("介面語言");
    expect(trigger.textContent).toContain("繁體中文");

    await act(async () => {
      trigger.click();
    });
    expect(
      document.body.querySelectorAll('[data-testid^="language-switcher-select-option-"]'),
    ).toHaveLength(4);
    await act(async () => {
      document.body
        .querySelector<HTMLButtonElement>('[data-testid="language-switcher-select-option-en"]')
        ?.click();
    });
    expect(getAppLocalePreference()).toBe("en");
  });
});
