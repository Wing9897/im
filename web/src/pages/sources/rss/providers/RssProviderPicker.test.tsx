import { describe, expect, it, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../../i18n";
import { setAppLocale } from "../../../../i18n/locale";

import { RssProviderPicker } from "./RssProviderPicker";
import { RSS_PROVIDERS } from "./registry";

describe("RssProviderPicker", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  it("renders a grouped select instead of stacked provider chips", () => {
    const container = document.createElement("div");
    const onChange = vi.fn();

    act(() => {
      createRoot(container).render(
        createElement(
          I18nextProvider,
          { i18n },
          createElement(RssProviderPicker, {
            providers: RSS_PROVIDERS,
            activeId: "linuxdo",
            onChange,
          }),
        ),
      );
    });

    const select = container.querySelector<HTMLSelectElement>("#rss-provider-select");
    expect(select).not.toBeNull();
    expect(container.querySelectorAll("optgroup").length).toBeGreaterThanOrEqual(3);
    expect(container.querySelectorAll(".rss-provider-picker__chip").length).toBe(0);
    expect(container.textContent).toContain(i18n.t("sources:rss.providers.linuxdo.pickerHint"));

    act(() => {
      select!.value = "v2ex";
      select!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith("v2ex");
  });
});
