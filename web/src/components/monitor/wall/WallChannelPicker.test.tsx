import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";

import type { ChannelWithSource } from "../../../types";
import { WallChannelPicker } from "./WallChannelPicker";
import { ensureZhHantLocale, wrapWithI18n } from "../../../test/i18nHarness";

const channels: ChannelWithSource[] = [
  {
    id: "telegram:10001",
    platform: "telegram",
    platformId: "10001",
    channelName: "News",
    sourceIds: ["acc-1"],
    sourceId: "acc-1",
    sourceName: "My Telegram",
  },
  {
    id: "telegram:10002",
    platform: "telegram",
    platformId: "10002",
    channelName: "Alerts",
    sourceIds: ["acc-1"],
    sourceId: "acc-1",
    sourceName: "My Telegram",
  },
];

let root: Root | null = null;

function renderPicker(props: {
  channels: ChannelWithSource[];
  selectedChannelIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const container = document.createElement("div");
  root = createRoot(container);
  act(() => {
    root!.render(wrapWithI18n(createElement(WallChannelPicker, props)));
  });
  return container;
}

describe("WallChannelPicker", () => {
  beforeEach(async () => {
    await ensureZhHantLocale();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
      root = null;
    }
  });

  it("opens dialog and toggles channel selection", () => {
    const onChange = vi.fn();
    const container = renderPicker({
      channels,
      selectedChannelIds: [],
      onChange,
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="wall-channel-picker-trigger"]')!
        .click();
    });

    expect(document.body.querySelector('[data-testid="wall-channel-picker-dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain("My Telegram");

    const newsCheckbox = document.body.querySelector<HTMLInputElement>('input[aria-label="News"]')!;
    act(() => {
      newsCheckbox.click();
    });
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      document.body
        .querySelector<HTMLButtonElement>('[data-testid="wall-channel-picker-apply"]')!
        .click();
    });
    expect(onChange).toHaveBeenCalledWith(["telegram:10001"]);
  });

  it("discards draft selection when the dialog is closed", () => {
    const onChange = vi.fn();
    const container = renderPicker({
      channels,
      selectedChannelIds: [],
      onChange,
    });
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="wall-channel-picker-trigger"]')!
        .click();
    });
    act(() => {
      document.body.querySelector<HTMLInputElement>('input[aria-label="News"]')!.click();
      document.body.querySelector<HTMLButtonElement>('button[aria-label="關閉"]')!.click();
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows selected count badge on trigger", () => {
    const container = renderPicker({
      channels,
      selectedChannelIds: ["telegram:10001", "telegram:10002"],
      onChange: vi.fn(),
    });
    expect(container.textContent).toContain("2");
  });

  it("shows platform filter chips when multiple platforms exist", () => {
    const multiPlatformChannels: ChannelWithSource[] = [
      ...channels,
      {
        id: "email:INBOX",
        platform: "email",
        platformId: "INBOX",
        channelName: "INBOX",
        sourceIds: ["acc-email"],
        sourceId: "acc-email",
        sourceName: "user@gmail.com",
      },
    ];
    const container = renderPicker({
      channels: multiPlatformChannels,
      selectedChannelIds: [],
      onChange: vi.fn(),
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="wall-channel-picker-trigger"]')!.click();
    });
    expect(document.body.querySelector('[role="group"][aria-label="訊息牆平台過濾"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Email");
  });
});
