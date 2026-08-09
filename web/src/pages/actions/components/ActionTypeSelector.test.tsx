/**
 * Unit tests for ActionTypeSelector.
 *
 * Coverage for conditional rendering and user interaction handlers
 * (tile selection, disabled state, prompt visibility based on null value).
 */
import { beforeEach, describe, it, expect, vi } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { ensureZhHantLocale, wrapWithI18n } from "../../../test/i18nHarness";
import { ActionTypeSelector } from "./ActionTypeSelector";
import type { ActionType } from "../../../types";

function renderSelector(
  value: ActionType | null,
  onChange: (t: ActionType) => void = () => {},
  disabled = false,
) {
  const container = document.createElement("div");
  act(() => {
    createRoot(container).render(
      wrapWithI18n(createElement(ActionTypeSelector, { value, onChange, disabled })),
    );
  });
  return container;
}

function getChannelTiles(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll("button[aria-pressed]"));
}

describe("ActionTypeSelector", () => {
  beforeEach(async () => {
    await ensureZhHantLocale();
  });
  it("renders four channel options as selectable tiles", () => {
    const container = renderSelector(null);
    const tiles = getChannelTiles(container);
    expect(tiles.length).toBe(4);
  });

  it("renders label text for each option", () => {
    const container = renderSelector(null);
    const labels = getChannelTiles(container).map((el) => el.textContent?.trim());
    expect(labels).toEqual([
      "Telegram Bot",
      "Discord Webhook",
      "HTTP Webhook",
      "MQTT",
    ]);
  });

  it("shows the placeholder hint when no value is selected", () => {
    const container = renderSelector(null);
    expect(container.textContent).toContain("請先選擇通知類型以顯示對應設定欄位");
  });

  it("hides the placeholder hint once a value is selected", () => {
    const container = renderSelector("telegram_bot");
    expect(container.textContent).not.toContain("請先選擇通知類型");
  });

  it("marks the selected option with aria-pressed=true", () => {
    const container = renderSelector("discord_webhook");
    const pressed = getChannelTiles(container).map((tile) =>
      tile.getAttribute("aria-pressed"),
    );
    expect(pressed).toEqual(["false", "true", "false", "false"]);
  });

  it("calls onChange with the clicked option value", () => {
    const onChange = vi.fn();
    const container = renderSelector(null, onChange);
    const tiles = getChannelTiles(container);
    act(() => {
      tiles[2].click(); // HTTP Webhook
    });
    expect(onChange).toHaveBeenCalledWith("http_webhook");
  });

  it("does not call onChange when disabled and option is clicked", () => {
    const onChange = vi.fn();
    const container = renderSelector(null, onChange, true);
    const tiles = getChannelTiles(container);
    act(() => {
      tiles[0].click();
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("applies disabled styling when disabled prop is true", () => {
    const container = renderSelector("mqtt", () => {}, true);
    const tiles = getChannelTiles(container);
    for (const tile of tiles) {
      expect(tile.className).toContain("pointer-events-none");
      expect(tile.className).toContain("opacity-50");
    }
  });

  it("supports selecting each of the four channel types", () => {
    const onChange = vi.fn();
    const container = renderSelector(null, onChange);
    const tiles = getChannelTiles(container);
    act(() => {
      tiles[0].click();
      tiles[1].click();
      tiles[3].click();
    });
    expect(onChange).toHaveBeenNthCalledWith(1, "telegram_bot");
    expect(onChange).toHaveBeenNthCalledWith(2, "discord_webhook");
    expect(onChange).toHaveBeenNthCalledWith(3, "mqtt");
  });
});

