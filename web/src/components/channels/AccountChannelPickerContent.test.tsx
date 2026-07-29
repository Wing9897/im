import { beforeEach, describe, it, expect, vi } from "vitest";
import { createElement, act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";

import type { ChannelWithAccount } from "../../types";
import i18n from "../../i18n";
import { setAppLocale } from "../../i18n/locale";
import { AccountChannelPickerContent } from "./AccountChannelPickerContent";

const channels: ChannelWithAccount[] = [
  {
    id: "telegram:10001",
    platform: "telegram",
    platformId: "10001",
    channelName: "News",
    accountIds: ["acc-1"],
    accountId: "acc-1",
    accountName: "My Telegram",
  },
  {
    id: "rss:https://example.com/feed",
    platform: "rss",
    platformId: "https://example.com/feed",
    channelName: "Example Feed",
    accountIds: ["acc-2"],
    accountId: "acc-2",
    accountName: "RSS Account",
  },
];

function renderWithI18n(node: ReactElement) {
  const container = document.createElement("div");
  act(() => {
    createRoot(container).render(createElement(I18nextProvider, { i18n }, node));
  });
  return container;
}

function renderPicker(
  selectedIds: string[],
  onChange: (ids: string[]) => void,
) {
  return renderWithI18n(
    createElement(AccountChannelPickerContent, {
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

describe("AccountChannelPickerContent", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  it("groups channels by platform with account labels for account-tree layouts", () => {
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
      createElement(AccountChannelPickerContent, {
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
      accountIds: ["acc-1"],
      accountId: "acc-1",
      accountName: "My Telegram",
    })) as ChannelWithAccount[];

    const container = renderWithI18n(
      createElement(AccountChannelPickerContent, {
        channels: [...manyTelegram, ...channels.slice(1)],
        selectedIds: [],
        onChange: vi.fn(),
      }),
    );

    const telegramSection = container.querySelector(".im-picker-platform-section.is-collapsed");
    expect(telegramSection).not.toBeNull();
  });

  it("renders every channel row after expanding a large account group", () => {
    const accountLabel = "+85252955549";
    const manyTelegram = Array.from({ length: 187 }, (_, index) => ({
      id: `telegram:${index}`,
      platform: "telegram",
      platformId: String(index),
      channelName: `Channel ${index}`,
      accountIds: ["acc-tg"],
      accountId: "acc-tg",
      accountName: accountLabel,
    })) as ChannelWithAccount[];

    const container = renderWithI18n(
      createElement(AccountChannelPickerContent, {
        channels: manyTelegram,
        selectedIds: [],
        onChange: vi.fn(),
        hidePlatformHeaders: true,
        fillAvailableHeight: true,
      }),
    );

    const accountToggle = container.querySelector<HTMLButtonElement>(".im-picker-account-toggle");
    expect(accountToggle).not.toBeNull();
    act(() => {
      accountToggle!.click();
    });

    const rows = container.querySelectorAll(".im-picker-row");
    expect(rows).toHaveLength(187);

    const expandedSection = container.querySelector(".im-picker-platform-section.is-flat");
    expect(expandedSection).not.toBeNull();
    expect(expandedSection!.classList.contains("is-collapsed")).toBe(false);
  });
});
