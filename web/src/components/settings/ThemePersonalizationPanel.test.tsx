import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureZhHantLocale, wrapWithI18n } from "../../test/i18nHarness";
import { ThemePersonalizationPanel } from "./ThemePersonalizationPanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../../styles/themeData", async () => {
  const actual = await vi.importActual<typeof import("../../styles/themeData")>(
    "../../styles/themeData",
  );
  return {
    ...actual,
    refreshFocalBackground: vi.fn().mockResolvedValue(null),
    advanceAndMaterializeFocal: vi.fn().mockResolvedValue({ entry: null, applyUrl: null }),
    loadBgForTheme: vi.fn(),
  };
});

function expandSection(container: HTMLElement, title: string) {
  const toggle = Array.from(container.querySelectorAll("button")).find(
    (btn) =>
      btn.getAttribute("aria-expanded") === "false" &&
      btn.closest("div")?.textContent?.includes(title),
  );
  expect(toggle).toBeTruthy();
  act(() => {
    toggle!.click();
  });
}

describe("ThemePersonalizationPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await ensureZhHantLocale();
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

  it("keeps personalization collapsed so texture/bg controls stay off the first screen", () => {
    act(() => {
      root.render(wrapWithI18n(createElement(ThemePersonalizationPanel, { themeId: "moss" })));
    });

    expect(container.querySelector('[data-testid="theme-personalization"]')).not.toBeNull();
    expect(container.textContent).toContain("個人化");
    expect(container.querySelector('[data-testid="theme-texture-pref"]')).toBeNull();
    expect(container.querySelector('[data-testid="theme-bg-mode"]')).toBeNull();
    expect(container.querySelector('[data-testid="theme-color-accent"]')).toBeNull();
  });

  it("reveals texture, background, and color controls when expanded", () => {
    act(() => {
      root.render(wrapWithI18n(createElement(ThemePersonalizationPanel, { themeId: "moss" })));
    });

    expandSection(container, "個人化");

    expect(container.querySelector('[data-testid="theme-texture-pref"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="theme-bg-mode"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="theme-color-accent"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="theme-personalization-reset"]')).not.toBeNull();
    expect(container.textContent).toContain("顏色與不透明度");
  });

  it("shows focal refresh controls when focal mode is selected", async () => {
    const themeData = await import("../../styles/themeData");
    themeData.saveThemeBgMode("moss", "focal");
    themeData.saveFocalCache({
      day: "2026-08-12",
      locale: "zh-Hant",
      imageUrl: "https://www.bing.com/th?id=OHR.Test",
      idx: 0,
      fetchedAt: Date.now(),
    });

    act(() => {
      root.render(wrapWithI18n(createElement(ThemePersonalizationPanel, { themeId: "moss" })));
    });
    expandSection(container, "個人化");

    const refreshBtn = container.querySelector(
      '[data-testid="theme-focal-refresh"]',
    ) as HTMLButtonElement | null;
    expect(refreshBtn).not.toBeNull();
    expect(container.querySelector('[data-testid="theme-focal-refresh-hours"]')).not.toBeNull();

    await act(async () => {
      refreshBtn!.click();
    });
    expect(themeData.advanceAndMaterializeFocal).toHaveBeenCalled();
  });

  it("interpolates focal refresh-hours option labels (no raw {count})", async () => {
    const themeData = await import("../../styles/themeData");
    themeData.saveThemeBgMode("moss", "focal");
    themeData.saveFocalRefreshHours(6);
    themeData.saveFocalCache({
      day: "2026-08-12",
      locale: "zh-Hant",
      imageUrl: "https://www.bing.com/th?id=OHR.Test",
      idx: 0,
      fetchedAt: Date.now(),
    });

    act(() => {
      root.render(wrapWithI18n(createElement(ThemePersonalizationPanel, { themeId: "moss" })));
    });
    expandSection(container, "個人化");

    const trigger = container.querySelector(
      '[data-testid="theme-focal-refresh-hours-value"]',
    ) as HTMLButtonElement | null;
    expect(trigger).not.toBeNull();
    expect(trigger!.textContent).toContain("每 6 小時");
    expect(trigger!.textContent).not.toContain("{count}");
    expect(trigger!.textContent).not.toContain("{{count}}");

    act(() => {
      trigger!.click();
    });

    const list = container.querySelector('[data-testid="theme-focal-refresh-hours-list"]');
    expect(list).not.toBeNull();
    const labels = Array.from(list!.querySelectorAll('[role="option"]')).map(
      (el) => el.textContent ?? "",
    );
    expect(labels.some((l) => l.includes("關閉自動重新整理"))).toBe(true);
    expect(labels).toContain("每 1 小時");
    expect(labels).toContain("每 6 小時");
    expect(labels).toContain("每 12 小時");
    expect(labels).toContain("每 24 小時");
    for (const label of labels) {
      expect(label).not.toContain("{count}");
      expect(label).not.toContain("{{count}}");
    }
  });

  it("uses frosted panel tokens on nested color rows (not opaque bg-surface-card)", () => {
    act(() => {
      root.render(wrapWithI18n(createElement(ThemePersonalizationPanel, { themeId: "moss" })));
    });
    expandSection(container, "個人化");

    const accentRow = container.querySelector(
      '[data-testid="theme-color-row-accent"]',
    ) as HTMLElement | null;
    expect(accentRow).not.toBeNull();
    expect(accentRow!.className).toContain("im-surface-panel");
    expect(accentRow!.className).not.toContain("bg-surface-card");

    const textureSelect = container.querySelector(
      '[data-testid="theme-texture-pref-value"]',
    ) as HTMLElement | null;
    expect(textureSelect).not.toBeNull();
    expect(textureSelect!.className).toContain("im-surface-inset");
  });
});
