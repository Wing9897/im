import { beforeEach, describe, it, expect, vi } from "vitest";
import { createElement, act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";

import type { ChannelWithSource } from "../../types";
import { SourceChannelPickerContent } from "./SourceChannelPickerContent";
import { ensureZhHantLocale, wrapWithI18n } from "../../test/i18nHarness";

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
    id: "rss:https://example.com/feed",
    platform: "rss",
    platformId: "https://example.com/feed",
    channelName: "Example Feed",
    sourceIds: ["acc-2"],
    sourceId: "acc-2",
    sourceName: "RSS Source",
  },
];

function renderWithI18n(node: ReactElement) {
  const container = document.createElement("div");
  act(() => {
    createRoot(container).render(wrapWithI18n(node));
  });
  return container;
}

function renderPicker(
  selectedIds: string[],
  onChange: (ids: string[]) => void,
) {
  return renderWithI18n(
    createElement(SourceChannelPickerContent, {
      channels,
      selectedIds,
      onChange,
      testId: "picker-panel",
    }),
  );
}

function setSearchInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("SourceChannelPickerContent", () => {
  beforeEach(async () => {
    await ensureZhHantLocale();
  });

  it("groups channels by platform with source labels for source-tree layouts", () => {
    const container = renderPicker([], vi.fn());
    expect(container.textContent).toContain("Telegram");
    expect(container.textContent).toContain("My Telegram");
    expect(container.textContent).toContain("RSS");
  });

  it("toggles channel selection via checkbox", () => {
    const onChange = vi.fn();
    const container = renderPicker([], onChange);
    const checkbox = container.querySelector<HTMLInputElement>('input[aria-label="News"]')!;
    act(() => {
      checkbox.click();
    });
    expect(onChange).toHaveBeenCalledWith(["telegram:10001"]);
  });

  it("selects all visible channels via 全選", () => {
    const onChange = vi.fn();
    const container = renderPicker([], onChange);
    const selectAll = container.querySelector<HTMLButtonElement>("button")!;
    const selectAllBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "全選",
    )!;
    act(() => {
      selectAllBtn.click();
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining(["telegram:10001", "rss:https://example.com/feed"]),
    );
    expect(selectAll).not.toBeNull();
  });

  it("clears selection via 清空", () => {
    const onChange = vi.fn();
    const container = renderPicker(["telegram:10001"], onChange);
    const clearBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "清空",
    )!;
    act(() => {
      clearBtn!.click();
    });
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("filters channels by search query", () => {
    const container = renderPicker([], vi.fn());
    const search = container.querySelector<HTMLInputElement>('[aria-label="搜尋頻道"]')!;
    act(() => {
      setSearchInputValue(search, "Example");
    });
    expect(container.textContent).toContain("Example Feed");
    expect(container.textContent).not.toContain("News");
  });

  it("hides platform groups when hidePlatformHeaders is true", () => {
    const container = renderWithI18n(
      createElement(SourceChannelPickerContent, {
        channels,
        selectedIds: [],
        onChange: vi.fn(),
        hidePlatformHeaders: true,
      }),
    );
    expect(container.textContent).toContain("News");
    expect(container.querySelector(".im-picker-platform-toggle")).toBeNull();
    expect(container.querySelector(".im-picker-platform-section.is-flat")).not.toBeNull();
  });

  it("collapses large platform groups by default", () => {
    const manyTelegram = Array.from({ length: 12 }, (_, index) => ({
      id: `telegram:${index}`,
      platform: "telegram",
      platformId: String(index),
      channelName: `Channel ${index}`,
      sourceIds: ["acc-1"],
      sourceId: "acc-1",
      sourceName: "My Telegram",
    })) as ChannelWithSource[];

    const container = renderWithI18n(
      createElement(SourceChannelPickerContent, {
        channels: [...manyTelegram, ...channels.slice(1)],
        selectedIds: [],
        onChange: vi.fn(),
      }),
    );

    const telegramSection = container.querySelector(".im-picker-platform-section.is-collapsed");
    expect(telegramSection).not.toBeNull();
  });

  it("renders every channel row after expanding a large source group", () => {
    const sourceLabel = "+85252955549";
    const manyTelegram = Array.from({ length: 187 }, (_, index) => ({
      id: `telegram:${index}`,
      platform: "telegram",
      platformId: String(index),
      channelName: `Channel ${index}`,
      sourceIds: ["acc-tg"],
      sourceId: "acc-tg",
      sourceName: sourceLabel,
    })) as ChannelWithSource[];

    const container = renderWithI18n(
      createElement(SourceChannelPickerContent, {
        channels: manyTelegram,
        selectedIds: [],
        onChange: vi.fn(),
        hidePlatformHeaders: true,
        fillAvailableHeight: true,
      }),
    );

    const sourceToggle = container.querySelector<HTMLButtonElement>(".im-picker-source-toggle");
    expect(sourceToggle).not.toBeNull();
    act(() => {
      sourceToggle!.click();
    });

    const rows = container.querySelectorAll(".im-picker-row");
    expect(rows).toHaveLength(187);

    const expandedSection = container.querySelector(".im-picker-platform-section.is-flat");
    expect(expandedSection).not.toBeNull();
    expect(expandedSection!.classList.contains("is-collapsed")).toBe(false);
  });
});
