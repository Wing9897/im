import { describe, it, expect, vi } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { MessageListItem } from "./MessageListItem";
import { makeMessage } from "../../../test/messageFixtures";

const msg = makeMessage();

describe("MessageListItem", () => {
  it("renders sender, content, and timestamp", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(createElement(MessageListItem, { message: msg }));
    });
    expect(container.textContent).toContain("Alice");
    expect(container.textContent).toContain("Test message");
  });

  it("uses list contrast hooks for source, body, and row frost", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(createElement(MessageListItem, { message: msg }));
    });
    const row = container.querySelector(".im-monitor-list-item");
    expect(row).toBeTruthy();
    const source = container.querySelector(".im-monitor-list-source");
    expect(source?.textContent).toBe("Test Channel");
    expect(source?.className).toContain("text-text-secondary");
    const body = container.querySelector(".im-monitor-list-body");
    expect(body?.textContent).toBe("Test message");
    expect(body?.className).not.toContain("is-unread");
    expect(container.querySelector("time")).toBeTruthy();
  });

  it("marks unread body as primary ink", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(MessageListItem, { message: msg, isRead: false }),
      );
    });
    const body = container.querySelector(".im-monitor-list-body");
    expect(body?.className).toContain("is-unread");
    expect(body?.className).toContain("text-text-primary");
  });

  it("falls back to senderId when senderName is empty", () => {
    const noName = makeMessage({ senderName: "" });
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(createElement(MessageListItem, { message: noName }));
    });
    expect(container.textContent).toContain("u1");
  });
});

/* ------------------------------------------------------------------ */
/*  Title attributes for truncated text (Req 8.1)                      */
/* ------------------------------------------------------------------ */

describe("MessageListItem title attributes", () => {
  it("has title attribute on channel name span", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(createElement(MessageListItem, { message: msg }));
    });

    const spans = container.querySelectorAll("span");
    const channelSpan = Array.from(spans).find((s) => s.textContent === "Test Channel");
    expect(channelSpan).toBeTruthy();
    expect(channelSpan!.getAttribute("title")).toBe("Test Channel");
  });

  it("has title attribute on content span", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(createElement(MessageListItem, { message: msg }));
    });

    const spans = container.querySelectorAll("span");
    const contentSpan = Array.from(spans).find((s) => s.textContent === "Test message");
    expect(contentSpan).toBeTruthy();
    expect(contentSpan!.getAttribute("title")).toBe("Test message");
  });

  it("does not render channel span when channelName is null", () => {
    const noChannel = makeMessage({ channelName: null });
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(createElement(MessageListItem, { message: noChannel }));
    });

    const spans = container.querySelectorAll("span");
    const channelSpan = Array.from(spans).find((s) => s.getAttribute("title") === "Test Channel");
    expect(channelSpan).toBeUndefined();
  });

  it("calls onSelect when the row is clicked", () => {
    const onSelect = vi.fn();
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(MessageListItem, {
          message: makeMessage({ senderName: "Alice" }),
          onSelect,
        }),
      );
    });

    const row = container.querySelector('[aria-label="查看訊息詳情：Alice"]');
    expect(row).toBeTruthy();

    act(() => {
      row!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
