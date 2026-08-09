import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n, wrapWithI18n } from "../../../test/i18nHarness";
import { setAppLocale } from "../../../i18n/locale";

vi.mock("./useWebhookPanel", () => ({
  useWebhookPanel: () => ({
    keys: [{ id: "k1", label: "Webhook", preview: "abcd…wxyz", createdAt: "" }],
    keyCount: 2,
    servicePort: "18820",
    serviceBaseUrl: "http://127.0.0.1:18820",
    error: null,
    isConfigured: true,
  }),
}));

vi.mock("../../../hooks/useErrorToast", () => ({
  useErrorToast: () => {},
}));

import { WebhookPanel } from "./WebhookPanel";

describe("WebhookPanel", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    setAppLocale("en");
    await i18n.changeLanguage("en");
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

  it("points to Settings API docs for the ingest example", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        wrapWithI18n(createElement(MemoryRouter, null, createElement(WebhookPanel))),
      );
    });

    const link = container.querySelector('[data-testid="webhook-api-docs-link"]');
    expect(link?.getAttribute("href")).toBe("/settings/api");
    expect(container.querySelector("pre")).toBeNull();
  });

  it("shows configured key count in the notice", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        wrapWithI18n(createElement(MemoryRouter, null, createElement(WebhookPanel))),
      );
    });

    expect(container.querySelector('[data-testid="webhook-keys-status"]')?.textContent).toBe(
      "Configured (2 full keys)",
    );
  });
});
