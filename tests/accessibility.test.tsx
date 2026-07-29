// NOTE: This test imports React components from web/src/ and requires
// web/node_modules to be installed (npm install in web/).
import { describe, it, expect } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";

/* ------------------------------------------------------------------ */
/*  Toast Accessibility (Requirements 7.1, 7.2)                        */
/* ------------------------------------------------------------------ */

describe("Toast accessibility attributes", () => {
  it('has role="alert" on the toast container', async () => {
    const { ToastProvider, ToastContext } = await import(
      "../web/src/context/ToastContext"
    );
    const { useContext } = await import("react");

    const container = document.createElement("div");
    let triggerToast: ((msg: string) => void) | null = null;

    function Trigger() {
      const ctx = useContext(ToastContext);
      triggerToast = ctx?.showToast ?? null;
      return null;
    }

    const root = createRoot(container);
    act(() => {
      root.render(
        createElement(ToastProvider, null, createElement(Trigger)),
      );
    });

    // Show a toast so the container renders
    act(() => {
      triggerToast!("Test notification");
    });

    const alertEl = container.querySelector('[role="alert"]');
    expect(alertEl).toBeTruthy();
    act(() => {
      root.unmount();
    });
  });

  it('has aria-live="polite" on the toast container', async () => {
    const { ToastProvider, ToastContext } = await import(
      "../web/src/context/ToastContext"
    );
    const { useContext } = await import("react");

    const container = document.createElement("div");
    let triggerToast: ((msg: string) => void) | null = null;

    function Trigger() {
      const ctx = useContext(ToastContext);
      triggerToast = ctx?.showToast ?? null;
      return null;
    }

    const root = createRoot(container);
    act(() => {
      root.render(
        createElement(ToastProvider, null, createElement(Trigger)),
      );
    });

    act(() => {
      triggerToast!("Test notification");
    });

    const alertEl = container.querySelector('[role="alert"]');
    expect(alertEl).toBeTruthy();
    expect(alertEl!.getAttribute("aria-live")).toBe("polite");
    act(() => {
      root.unmount();
    });
  });
});

/* ------------------------------------------------------------------ */
/*  MessageListItem Accessibility (Requirements 9.1, 9.2)              */
/* ------------------------------------------------------------------ */

describe("MessageListItem accessibility attributes", () => {
  async function renderMessageItem() {
    const MessageListItem = (
      await import("../web/src/pages/monitor/message/MessageListItem")
    ).MessageListItem;

    const msg = {
      id: "m1",
      accountId: "a1",
      platformId: "c1",
      channelName: "Test Channel",
      platform: "telegram",
      platformMessageId: "pm1",
      senderId: "u1",
      senderName: "Alice",
      content: "Test message",
      timestamp: "2024-06-01T12:00:00Z",
      rawData: null,
      media: null,
      createdAt: "2024-06-01T12:00:00Z",
    };

    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(MessageListItem, { message: msg }),
      );
    });

    return container;
  }

  it('has role="row" on the container element', async () => {
    const container = await renderMessageItem();
    const row = container.querySelector('[role="row"]');
    expect(row).toBeTruthy();
  });

  it('has role="cell" on child content elements', async () => {
    const container = await renderMessageItem();
    const cells = container.querySelectorAll('[role="cell"]');
    // Should have cells for: time, platform badge, channel, sender, content
    expect(cells.length).toBeGreaterThanOrEqual(4);
  });

  it('the time element has role="cell"', async () => {
    const container = await renderMessageItem();
    const time = container.querySelector("time");
    expect(time).toBeTruthy();
    expect(time!.getAttribute("role")).toBe("cell");
  });

  it('all direct children of the row have role="cell"', async () => {
    const container = await renderMessageItem();
    const row = container.querySelector('[role="row"]');
    expect(row).toBeTruthy();

    const children = Array.from(row!.children);
    for (const child of children) {
      expect(child.getAttribute("role")).toBe("cell");
    }
  });
});
