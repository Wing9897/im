import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { ensureZhHantLocale, i18n, wrapWithI18n } from "./i18nHarness";

describe("i18nHarness", () => {
  it("ensureZhHantLocale locks zh-Hant on the i18n instance", async () => {
    await ensureZhHantLocale();
    expect(i18n.language).toBe("zh-Hant");
  });

  it("wrapWithI18n mounts children under I18nextProvider", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        wrapWithI18n(createElement("span", { "data-testid": "child" }, "ok")),
      );
    });
    expect(container.querySelector('[data-testid="child"]')?.textContent).toBe("ok");
  });
});
