/**
 * Smoke tests for HttpPlatformTab poll/webhook sub-mode routing.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { setAppLocale } from "../../../i18n/locale";

vi.mock("./HttpTab", () => ({
  HttpTab: ({ modeToggle }: { modeToggle?: React.ReactNode }) =>
    createElement(
      "div",
      { "data-testid": "http-poll-panel" },
      modeToggle,
      "定時抓取面板",
    ),
}));

vi.mock("../webhook/WebhookPanel", () => ({
  WebhookPanel: ({ modeToggle }: { modeToggle?: React.ReactNode }) =>
    createElement(
      "div",
      { "data-testid": "http-webhook-panel" },
      modeToggle,
      "Webhook 接入",
    ),
}));

import { HttpPlatformTab } from "./HttpPlatformTab";

function SearchParamsProbe({ onParams }: { onParams: (params: URLSearchParams) => void }) {
  const [searchParams] = useSearchParams();
  onParams(searchParams);
  return null;
}

describe("HttpPlatformTab", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
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

  it("defaults to poll mode copy and panel", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(
          I18nextProvider,
          { i18n },
          createElement(
            MemoryRouter,
            { initialEntries: ["/accounts?tab=http"] },
            createElement(HttpPlatformTab),
          ),
        ),
      );
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="http-poll-panel"]')).toBeTruthy();
    expect(container.textContent).toContain("定時抓取面板");
    expect(container.textContent).toContain("抓取");
    expect(container.textContent).toContain("Webhook");
    expect(container.querySelector('[data-testid="http-webhook-panel"]')).toBeNull();
  });

  it("opens Webhook panel when mode=webhook", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(
          I18nextProvider,
          { i18n },
          createElement(
            MemoryRouter,
            { initialEntries: ["/accounts?tab=http&mode=webhook"] },
            createElement(HttpPlatformTab),
          ),
        ),
      );
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="http-webhook-panel"]')).toBeTruthy();
    expect(container.textContent).toContain("Webhook 接入");
    expect(container.querySelector('[data-testid="http-poll-panel"]')).toBeNull();
  });

  it("clears mode query when switching to poll and writes mode when switching to webhook", async () => {
    let latestParams = new URLSearchParams();

    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(
          I18nextProvider,
          { i18n },
          createElement(
            MemoryRouter,
            { initialEntries: ["/accounts?tab=http&mode=webhook"] },
            createElement(
              "div",
              null,
              createElement(SearchParamsProbe, {
                onParams: (params) => {
                  latestParams = params;
                },
              }),
              createElement(HttpPlatformTab),
            ),
          ),
        ),
      );
      await Promise.resolve();
    });

    expect(latestParams.get("mode")).toBe("webhook");

    const pollButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "抓取",
    );
    expect(pollButton).toBeTruthy();

    await act(async () => {
      pollButton!.click();
      await Promise.resolve();
    });

    expect(latestParams.get("mode")).toBeNull();
    expect(latestParams.get("tab")).toBe("http");
    expect(container.querySelector('[data-testid="http-poll-panel"]')).toBeTruthy();

    const webhookButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Webhook",
    );
    expect(webhookButton).toBeTruthy();

    await act(async () => {
      webhookButton!.click();
      await Promise.resolve();
    });

    expect(latestParams.get("mode")).toBe("webhook");
    expect(latestParams.get("tab")).toBe("http");
    expect(container.querySelector('[data-testid="http-webhook-panel"]')).toBeTruthy();
  });
});
