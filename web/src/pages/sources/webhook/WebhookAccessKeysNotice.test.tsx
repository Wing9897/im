import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebhookAccessKeysNotice } from "./WebhookAccessKeysNotice";
import { i18n, wrapWithI18n } from "../../../test/i18nHarness";
import { setAppLocale } from "../../../i18n/locale";

describe("WebhookAccessKeysNotice", () => {
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

  function renderNotice(props: { keyCount: number; isConfigured: boolean }) {
    act(() => {
      root = createRoot(container);
      root.render(
        wrapWithI18n(createElement(
            MemoryRouter,
            null,
            createElement(WebhookAccessKeysNotice, props),
          )),
      );
    });
  }

  it("shows full-key count when configured (not a single-key preview)", () => {
    renderNotice({ keyCount: 3, isConfigured: true });
    const status = container.querySelector('[data-testid="webhook-keys-status"]');
    expect(status?.textContent).toBe("Configured (3 full keys)");
    expect(container.textContent).toContain("full key");
    expect(container.textContent).toContain("Account-manager-only keys cannot ingest");
  });

  it("shows unset copy when no full (*) keys (a2a-only only)", () => {
    renderNotice({ keyCount: 0, isConfigured: false });
    const status = container.querySelector('[data-testid="webhook-keys-status"]');
    expect(status?.textContent).toContain("Not set");
    expect(status?.textContent).toContain("Account-manager-only keys do not count");
  });

  it("links to Account access keys, not a retired source-keys path", () => {
    renderNotice({ keyCount: 0, isConfigured: false });
    const link = Array.from(container.querySelectorAll("a")).find((el) =>
      el.textContent?.includes("Account → Access keys"),
    );
    expect(link?.getAttribute("href")).toBe("/account/keys");
  });
});

