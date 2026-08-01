import { beforeEach, describe, it, expect, vi } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";

import type { ChannelWithAccount } from "../../types";
import { ensureZhHantLocale, wrapWithI18n } from "../../test/i18nHarness";
import { ChannelSelectorDialog } from "./ChannelSelectorDialog";

const channels: ChannelWithAccount[] = Array.from({ length: 7 }, (_, index) => ({
  id: index === 0 ? "telegram:10001" : `email:INBOX-${index}`,
  platform: index === 0 ? "telegram" : "email",
  platformId: index === 0 ? "10001" : `INBOX-${index}`,
  channelName: index === 0 ? "News" : `Folder ${index}`,
  accountIds: [`acc-${index}`],
  accountId: `acc-${index}`,
  accountName: index === 0 ? "My Telegram" : `user${index}@gmail.com`,
})) as ChannelWithAccount[];

describe("ChannelSelectorDialog", () => {
  beforeEach(async () => {
    await ensureZhHantLocale();
  });

  it("renders unified picker with platform chips and confirms selection", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const container = document.createElement("div");

    act(() => {
      createRoot(container).render(
        wrapWithI18n(
          createElement(ChannelSelectorDialog, {
            open: true,
            channels,
            selectedChannelIds: [],
            onConfirm,
            onClose,
          }),
        ),
      );
    });

    expect(document.body.querySelector('[data-testid="task-channel-selector-dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Email");
    expect(document.body.querySelector(".im-picker-search-input")).not.toBeNull();

    act(() => {
      document.body.querySelector<HTMLInputElement>('input[aria-label="News"]')!.click();
    });
    act(() => {
      document.body.querySelector<HTMLButtonElement>('[data-testid="task-channel-selector-confirm"]')!.click();
    });

    expect(onConfirm).toHaveBeenCalledWith(["telegram:10001"]);
    expect(onClose).toHaveBeenCalled();
  });
});
