import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeMessage } from "../../test/messageFixtures";
import { ensureZhHantLocale, wrapWithI18n } from "../../test/i18nHarness";
import { MessageCard } from "./MessageCard";

describe("MessageCard", () => {
  beforeEach(async () => {
    await ensureZhHantLocale();
  });

  it("renders sender name, content, and platform info", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        wrapWithI18n(
          createElement(MessageCard, {
            message: makeMessage({
              id: "msg-1",
              senderName: "Bob",
              content: "Hello world",
              channelName: "General",
            }),
          }),
        ),
      );
    });
    expect(container.textContent).toContain("Bob");
    expect(container.textContent).toContain("Hello world");
    expect(container.textContent).toContain("General");
    expect(container.querySelector('[aria-label="Telegram"]')).toBeTruthy();
  });

  it("falls back to senderId when senderName is empty", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        wrapWithI18n(
          createElement(MessageCard, {
            message: makeMessage({ senderName: "", senderId: "u1" }),
          }),
        ),
      );
    });
    expect(container.textContent).toContain("u1");
  });
});

describe("MessageCard visual styles", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(async () => {
    await ensureZhHantLocale();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
  });

  describe("card chrome", () => {
    it("uses discrete feed-tile chrome with no elevated shadow", () => {
      const message = makeMessage();

      act(() => {
        root = createRoot(container);
        root.render(wrapWithI18n(createElement(MessageCard, { message })));
      });

      expect(container.querySelector(".im-feed-tile")).toBeTruthy();
      expect(container.querySelector(".im-material-elevated")).toBeFalsy();
    });
  });

  describe("information hierarchy", () => {
    it("renders sender name with semibold truncate typography", () => {
      const message = makeMessage({ senderName: "Bob" });

      act(() => {
        root = createRoot(container);
        root.render(wrapWithI18n(createElement(MessageCard, { message })));
      });

      const sender = Array.from(container.querySelectorAll("span")).find(
        (el) => el.textContent === "Bob",
      );
      expect(sender?.className).toContain("font-medium");
      expect(sender?.className).toContain("truncate");
    });

    it("renders message content with secondary text class from the FeedCard body slot", () => {
      const message = makeMessage({ content: "Test message content" });

      act(() => {
        root = createRoot(container);
        root.render(wrapWithI18n(createElement(MessageCard, { message })));
      });

      const contentEl = container.querySelector('[data-testid="message-card-content"]');
      expect(contentEl?.textContent).toBe("Test message content");
      expect(contentEl?.parentElement?.className).toContain("text-text-secondary");
    });

    it("renders compact timestamp in the meta slot", () => {
      const message = makeMessage();

      act(() => {
        root = createRoot(container);
        root.render(wrapWithI18n(createElement(MessageCard, { message })));
      });

      const timeEl = container.querySelector("time")!;
      expect(timeEl).toBeTruthy();
    });

    it("renders channel name as truncated meta text", () => {
      const message = makeMessage({ channelName: "TestChannel" });

      act(() => {
        root = createRoot(container);
        root.render(wrapWithI18n(createElement(MessageCard, { message })));
      });

      const channelTag = Array.from(container.querySelectorAll("span")).find(
        (el) => el.textContent === "TestChannel",
      );
      expect(channelTag).toBeTruthy();
      expect(channelTag?.parentElement?.className).toContain("truncate");
      expect(channelTag?.parentElement?.className).toContain("text-text-muted");
    });
  });

  it("calls onSelect when the card is clicked", () => {
    const onSelect = vi.fn();
    const message = makeMessage({ senderName: "Alice" });

    act(() => {
      root = createRoot(container);
      root.render(wrapWithI18n(createElement(MessageCard, { message, onSelect })));
    });

    const card = container.querySelector('[aria-label="查看訊息詳情：Alice"]');
    expect(card).toBeTruthy();

    act(() => {
      card!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
