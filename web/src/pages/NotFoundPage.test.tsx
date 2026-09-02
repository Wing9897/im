import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SimpleModeProvider } from "../context/SimpleModeContext";
import { NotFoundPage } from "./NotFoundPage";
import { ensureZhHantLocale, wrapWithI18n } from "../test/i18nHarness";

describe("NotFoundPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await ensureZhHantLocale();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("shows a home button instead of silently redirecting", async () => {
    await act(async () => {
      root.render(
        wrapWithI18n(
          createElement(
            MemoryRouter,
            { initialEntries: ["/no-such-page"] },
            createElement(SimpleModeProvider, null, createElement(NotFoundPage)),
          ),
        ),
      );
      await Promise.resolve();
    });

    expect(container.textContent).toContain("找不到此頁面");
    expect(container.querySelector('[data-testid="not-found-home"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="not-found-home"]')?.textContent).toBe(
      "回到首頁",
    );
  });
});
