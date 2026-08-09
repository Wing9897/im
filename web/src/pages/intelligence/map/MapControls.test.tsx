import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
});
