import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { SettingsApiPage } from "./SettingsApiPage";
import { _resetConnectionStoreForTests } from "../../domain/connection/connectionStore";
import { wrapWithI18n } from "../../test/i18nHarness";

vi.mock("../../api/baseUrl", () => ({
  resolveBaseUrl: () => "http://127.0.0.1:18820",
}));

describe("SettingsApiPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    _resetConnectionStoreForTests();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
  });

  it("shows the resolved API base URL", () => {
    act(() => {
      root.render(wrapWithI18n(createElement(MemoryRouter, null, createElement(SettingsApiPage))));
    });
    const el = container.querySelector('[data-testid="api-docs-base-url"]');
    expect(el?.textContent).toBe("http://127.0.0.1:18820");
  });
});
