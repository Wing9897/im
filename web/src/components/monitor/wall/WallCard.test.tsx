import { beforeEach, describe, it, expect, vi } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n";
import { setAppLocale } from "../../../i18n/locale";

import type { Channel, Message } from "../../../types";
import { WallCard } from "./WallCard";
import type { WallSlotState } from "../../../domain/monitor/wall/wallModel";
import {
  wallBannerBackground,
  wallContentProps,
  wallMediaImageClass,
} from "./wallCardLayout";
import { pickWallLayout } from "../../../domain/monitor/wall/wallLayout";

const mediaState = vi.hoisted(() => ({
  objectUrl: null as string | null,
  loading: false,
  failed: false,
  retry: vi.fn(),
}));

vi.mock("./useSlideMedia", () => ({
  useSlideMedia: () => mediaState,
}));

const channel: Channel = {
  id: "telegram:10001",
  platform: "telegram",
  platformId: "10001",
  channelName: "TG News Channel",
  createdAt: "2026-07-01T10:00:00+00:00",
};

const message: Message = {
  id: "msg-1",
  accountId: "acc-1",
  platform: "telegram",
  platformId: "10001",
  channelName: "TG News Channel",
  platformMessageId: "1001",
  senderId: "sender-1",
  senderName: "Alice",
  content: "地震速報",
  timestamp: "2026-07-01T10:00:00+00:00",
  rawData: null,
  createdAt: "2026-07-01T10:00:01+00:00",
};

const slot: WallSlotState = {
  queue: [message, { ...message, id: "msg-2", content: "第二則" }],
  currentIndex: 0,
  unseenCount: 1,
};

beforeEach(async () => {
  setAppLocale("zh-Hant");
  await i18n.changeLanguage("zh-Hant");
});

describe("WallCard", () => {
  beforeEach(() => {
    mediaState.objectUrl = null;
    mediaState.loading = false;
    mediaState.failed = false;
    mediaState.retry.mockReset();
  });

  it("renders banner watermark, message content, dots, and unseen badge", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(I18nextProvider, { i18n }, createElement(WallCard, {
          channel,
          slot,
          onAdvance: vi.fn(),
          onSelectIndex: vi.fn(),
          getCachedUrl: () => undefined,
          putCachedUrl: (_id, url) => url,
        })),
      );
    });

    expect(container.textContent).toContain("TG News Channel");
    expect(container.textContent).toContain("Telegram");
    expect(container.textContent).toContain("地震速報");
    expect(container.textContent).toContain("+1 新");
    expect(container.textContent).not.toContain("Alice");
    expect(container.querySelector("time")).toBeNull();

    const dotsRow = container.querySelector(".im-wall-dots-row");
    expect(dotsRow).not.toBeNull();
    const dots = container.querySelectorAll("button[aria-label^='第']");
    expect(dots.length).toBe(2);
  });

  it("shows empty state when queue is empty", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(I18nextProvider, { i18n }, createElement(WallCard, {
          channel,
          slot: { queue: [], currentIndex: 0, unseenCount: 0 },
          onAdvance: vi.fn(),
          onSelectIndex: vi.fn(),
          getCachedUrl: () => undefined,
          putCachedUrl: (_id, url) => url,
        })),
      );
    });
    expect(container.textContent).toContain("尚無訊息");
  });

  it("adapts text size and layout to message volume", () => {
    const shortText = wallContentProps(12, "text-only");
    const longText = wallContentProps(220, "text-only");
    const stacked = wallContentProps(12, "stack");

    expect(shortText.style["--wall-content-font-size"]).not.toBe(
      longText.style["--wall-content-font-size"],
    );
    expect(shortText.style["--wall-content-font-size"]).not.toBe(
      stacked.style["--wall-content-font-size"],
    );
    expect(shortText.className).not.toContain("im-wall-content--clamp");
    expect(shortText.className).toContain("im-wall-content");
    expect(wallMediaImageClass).toContain("w-full");
    expect(
      pickWallLayout({
        hasVisualMedia: true,
        hasText: true,
        textLength: 120,
        aspectRatio: 1.6,
      }),
    ).toBe("stack");
  });

  it("uses a stable patterned background for each channel", () => {
    const background = wallBannerBackground("telegram:10001");
    expect(wallBannerBackground("telegram:10001")).toBe(background);
    expect(background).toMatch(/radial-gradient|repeating-linear-gradient/);
    expect(background).toContain("var(--wall-banner-");
  });

  it("shows a retry action when media loading fails", () => {
    mediaState.failed = true;
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(I18nextProvider, { i18n }, createElement(WallCard, {
          channel,
          slot: {
            queue: [{ ...message, media: { kind: "photo" } }],
            currentIndex: 0,
            unseenCount: 0,
          },
          onAdvance: vi.fn(),
          onSelectIndex: vi.fn(),
          getCachedUrl: () => undefined,
          putCachedUrl: (_id, url) => url,
        })),
      );
    });

    expect(container.textContent).toContain("媒體載入失敗");
    act(() => {
      container.querySelector<HTMLButtonElement>("button")!.click();
    });
    expect(mediaState.retry).toHaveBeenCalledOnce();
  });

  it("opens a lightbox when the loaded media image is clicked", () => {
    mediaState.objectUrl = "blob:wall-preview";
    mediaState.failed = false;
    const container = document.createElement("div");
    document.body.appendChild(container);
    act(() => {
      createRoot(container).render(
        createElement(I18nextProvider, { i18n }, createElement(WallCard, {
          channel,
          slot: {
            queue: [{ ...message, media: { kind: "photo" }, content: "地震速報" }],
            currentIndex: 0,
            unseenCount: 0,
          },
          onAdvance: vi.fn(),
          onSelectIndex: vi.fn(),
          getCachedUrl: () => undefined,
          putCachedUrl: (_id, url) => url,
        })),
      );
    });

    act(() => {
      container.querySelector<HTMLImageElement>("img")!.click();
    });

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain("地震速報");
    container.remove();
  });
});
