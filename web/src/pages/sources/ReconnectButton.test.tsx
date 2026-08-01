/**
 * Render + property tests for the shared ReconnectButton extracted from
 * RssFeedCard / MqttBrokerCard / DiscordBotCard.
 *
 * Validates: Requirement F2.2 (確認重連按鈕行為不變).
 *
 * ReconnectButton is a pure structural extraction of the reconnect control
 * previously inlined (identically) in the `actions` slot of each source card:
 *   - renders nothing unless `show` is true (the per-card `showError` guard)
 *   - secondary button styling with padding/fontSize overrides
 *   - while `reconnecting`: label is "重連中…", button is disabled, opacity 0.5
 *   - otherwise: label is "重新連線", button is enabled, opacity 1
 *   - click fires the provided `onReconnect` handler
 */
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import i18n from "../../i18n";
import { setAppLocale } from "../../i18n/locale";

import { ReconnectButton } from "./ReconnectButton";

/* ------------------------------------------------------------------ */
/*  Render harness                                                     */
/* ------------------------------------------------------------------ */

let container: HTMLDivElement;
let root: Root | null = null;

function render(component: () => ReactElement) {
  act(() => {
    root = createRoot(container);
    root.render(createElement(I18nextProvider, { i18n }, createElement(component)));
  });
}

function queryButton(): HTMLButtonElement | null {
  return container.querySelector("button");
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

/* ------------------------------------------------------------------ */
/*  Example-based tests                                                */
/* ------------------------------------------------------------------ */

describe("ReconnectButton", () => {
  it("renders nothing when show is false", () => {
    render(() =>
      createElement(ReconnectButton, {
        show: false,
        reconnecting: false,
        onReconnect: vi.fn(),
      }),
    );
    expect(queryButton()).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("renders an enabled reconnect button when idle", () => {
    render(() =>
      createElement(ReconnectButton, {
        show: true,
        reconnecting: false,
        onReconnect: vi.fn(),
      }),
    );
    const btn = queryButton();
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toBe("重新連線");
    expect(btn!.disabled).toBe(false);
    expect(btn!.className).toContain("disabled:opacity-50");
  });

  it("shows the in-flight label and disables the button while reconnecting", () => {
    render(() =>
      createElement(ReconnectButton, {
        show: true,
        reconnecting: true,
        onReconnect: vi.fn(),
      }),
    );
    const btn = queryButton();
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toBe("重連中…");
    expect(btn!.disabled).toBe(true);
    expect(btn!.className).toContain("disabled:opacity-50");
  });

  it("invokes onReconnect when clicked", () => {
    const onReconnect = vi.fn();
    render(() =>
      createElement(ReconnectButton, {
        show: true,
        reconnecting: false,
        onReconnect,
      }),
    );
    act(() => {
      queryButton()!.click();
    });
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  /* ---------------------------------------------------------------- */
  /*  Property test                                                   */
  /* ---------------------------------------------------------------- */

  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ] as const)(
    "renders button iff show=%s with label/disabled/opacity driven by reconnecting=%s",
    (show, reconnecting) => {
      const localContainer = document.createElement("div");
      document.body.appendChild(localContainer);
      let localRoot: Root | null = null;

      act(() => {
        localRoot = createRoot(localContainer);
        localRoot.render(
          createElement(
            I18nextProvider,
            { i18n },
            createElement(ReconnectButton, {
              show,
              reconnecting,
              onReconnect: vi.fn(),
            }),
          ),
        );
      });

      const btn = localContainer.querySelector("button");
      if (!show) {
        expect(btn).toBeNull();
      } else {
        expect(btn).not.toBeNull();
        expect(btn!.disabled).toBe(reconnecting);
        expect(btn!.textContent).toBe(reconnecting ? "重連中…" : "重新連線");
        expect(btn!.className).toContain("disabled:opacity-50");
      }

      act(() => localRoot!.unmount());
      localContainer.remove();
    },
  );
});
