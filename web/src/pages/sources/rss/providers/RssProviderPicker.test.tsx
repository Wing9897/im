import { describe, expect, it, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

import { RssProviderPicker } from "./RssProviderPicker";
import { RSS_PROVIDERS } from "./registry";
import { ensureZhHantLocale, i18n, wrapWithI18n } from "../../../../test/i18nHarness";

describe("RssProviderPicker", () => {
  beforeEach(async () => {
    await ensureZhHantLocale();
  });

  it("renders a grouped select instead of stacked provider chips", () => {
    const container = document.createElement("div");
    const onChange = vi.fn();

    act(() => {
      createRoot(container).render(
        wrapWithI18n(createElement(RssProviderPicker, {
            providers: RSS_PROVIDERS,
            activeId: "linuxdo",
            onChange,
          })),
      );
    });

    const trigger = container.querySelector<HTMLButtonElement>("#rss-provider-select");
    expect(trigger).not.toBeNull();
    expect(container.querySelectorAll(".rss-provider-picker__chip").length).toBe(0);
    expect(container.textContent).toContain(i18n.t("sources:rss.providers.linuxdo.pickerHint"));

    act(() => {
      trigger!.click();
    });
    expect(document.body.textContent).toContain("社群");
    const v2ex = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="rss-provider-select-option-v2ex"]',
    );
    expect(v2ex).toBeTruthy();
    act(() => {
      v2ex!.click();
    });

    expect(onChange).toHaveBeenCalledWith("v2ex");
  });
});
