import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { zIndex } from "../../../styles/tokens";
import { ensureZhHantLocale, wrapWithI18n } from "../../../test/i18nHarness";
import { MapControls } from "./MapControls";

describe("MapControls", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await ensureZhHantLocale();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps LIVE window select inline in one control row without w-full", () => {
    act(() => {
      root.render(
        wrapWithI18n(
          createElement(MapControls, {
            overlayDisplayMode: "both",
            onOverlayDisplayCycle: vi.fn(),
            sharedDanmakuMode: "off",
            onDanmakuModeCycle: vi.fn(),
            liveWindowHours: 12,
            onLiveWindowHoursChange: vi.fn(),
            isFullscreen: false,
            onToggleFullscreen: vi.fn(),
          }),
        ),
      );
    });

    const row = container.querySelector<HTMLElement>('[data-testid="map-controls"]');
    expect(row).not.toBeNull();
    expect(row!.className).toContain("inline-flex");
    expect(row!.className).toContain("shrink-0");

    const select = container.querySelector<HTMLElement>('[data-testid="map-live-window-select"]');
    expect(select).not.toBeNull();
    expect(select!.className).toContain("w-auto");
    expect(select!.className).toContain("shrink-0");
    expect(select!.className).not.toContain("w-full");

    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-testid="map-live-window-select-value"]',
    );
    expect(trigger).not.toBeNull();
    expect(trigger!.style.width).toBe("auto");
    expect(trigger!.textContent).toMatch(/12/);
  });

  it("portals the LIVE window listbox and flips it above a bottom trigger", () => {
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });

    act(() => {
      root.render(
        wrapWithI18n(
          createElement(MapControls, {
            overlayDisplayMode: "both",
            onOverlayDisplayCycle: vi.fn(),
            sharedDanmakuMode: "persistent",
            onDanmakuModeCycle: vi.fn(),
            liveWindowHours: 12,
            onLiveWindowHoursChange: vi.fn(),
            isFullscreen: false,
            onToggleFullscreen: vi.fn(),
          }),
        ),
      );
    });

    const row = container.querySelector<HTMLElement>('[data-testid="map-controls"]');
    expect(row?.textContent).toContain("資訊+事件");
    expect(row?.textContent).toContain("持久");
    expect(row?.querySelector('button[aria-label="全螢幕"]')).toBeTruthy();

    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-testid="map-live-window-select-value"]',
    );
    expect(trigger).toBeTruthy();
    trigger!.getBoundingClientRect = () =>
      ({
        top: 760,
        left: 200,
        width: 120,
        height: 32,
        bottom: 792,
        right: 320,
        x: 200,
        y: 760,
        toJSON() {
          return this;
        },
      }) as DOMRect;

    act(() => {
      trigger!.click();
    });

    const list = document.body.querySelector(
      '[data-testid="map-live-window-select-list"]',
    ) as HTMLElement | null;
    expect(list).toBeTruthy();
    expect(row!.contains(list)).toBe(false);
    expect(list?.parentElement).toBe(document.body);
    expect(list?.style.position).toBe("fixed");
    expect(list?.style.zIndex).toBe(String(zIndex.menu));
    expect(list?.textContent).toMatch(/LIVE ±1h/);
    expect(list?.textContent).toMatch(/LIVE ±12h/);

    Object.defineProperty(list!, "offsetHeight", { configurable: true, value: 180 });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(Number.parseFloat(list!.style.top)).toBeLessThan(760);
  });
});
