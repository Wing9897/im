/**
 * Render tests for SourceCardErrorLines — unified error display for source cards.
 */
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import i18n from "../../i18n";
import { setAppLocale } from "../../i18n/locale";

import { SourceCard, SourceCardErrorLines } from "./SourceCard";

let container: HTMLDivElement;
let root: Root | null = null;

function render(component: () => ReactElement) {
  act(() => {
    root = createRoot(container);
    root.render(createElement(I18nextProvider, { i18n }, createElement(component)));
  });
}

beforeEach(async () => {
  setAppLocale("zh-Hant");
  await i18n.changeLanguage("zh-Hant");
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
  }
  root = null;
  container.remove();
});

describe("SourceCardErrorLines", () => {
  it("renders lastError when status is error", () => {
    render(() =>
      createElement(SourceCardErrorLines, {
        status: "error",
        lastError: "Connection timed out",
      }),
    );

    expect(container.textContent).toContain("Connection timed out");
  });

  it("renders accountLastError when status is disconnected", () => {
    render(() =>
      createElement(SourceCardErrorLines, {
        status: "disconnected",
        accountLastError: "Session expired",
      }),
    );

    expect(container.textContent).toContain("Session expired");
  });

  it("falls back to localized unknown error when status is error with no message", () => {
    render(() =>
      createElement(SourceCardErrorLines, {
        status: "error",
      }),
    );

    expect(container.textContent).toContain("未知錯誤");
  });

  it("renders reconnectError below platform errors", () => {
    render(() =>
      createElement(SourceCardErrorLines, {
        status: "error",
        lastError: "Adapter error",
        reconnectError: "Reconnect failed",
      }),
    );

    expect(container.textContent).toContain("Adapter error");
    expect(container.textContent).toContain("Reconnect failed");
  });

  it("shows last success timestamp on error when enabled", () => {
    render(() =>
      createElement(SourceCardErrorLines, {
        status: "error",
        lastError: "Fetch failed",
        lastSuccessAt: "2026-01-15T08:00:00.000Z",
        showLastSuccessOnError: true,
      }),
    );

    expect(container.textContent).toContain("最後成功");
  });

  it("renders nothing when status is connected and no reconnect error", () => {
    render(() =>
      createElement(SourceCardErrorLines, {
        status: "connected",
        lastError: "Should not show",
      }),
    );

    expect(container.textContent).toBe("");
  });
});

describe("SourceCard", () => {
  it("opens detail when the card is clicked", () => {
    const onSelect = vi.fn();

    render(() =>
      createElement(SourceCard, {
        status: "connected",
        title: "demo-feed",
        subtitle: "https://example.com/rss",
        actions: createElement("button", { type: "button" }, "編輯"),
        onSelect,
      }),
    );

    const card = container.querySelector('[aria-label="查看詳情：demo-feed"]');
    expect(card).toBeTruthy();

    act(() => {
      card!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("does not open detail when action buttons are clicked", () => {
    const onSelect = vi.fn();

    render(() =>
      createElement(SourceCard, {
        status: "connected",
        title: "demo-feed",
        subtitle: "https://example.com/rss",
        actions: createElement(
          "button",
          { type: "button", onClick: () => undefined },
          "編輯",
        ),
        onSelect,
      }),
    );

    const editButton = container.querySelector("button");
    expect(editButton).toBeTruthy();

    act(() => {
      editButton!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(onSelect).not.toHaveBeenCalled();
  });
});
