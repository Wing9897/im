import { act, createElement, Fragment } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { defaultSettingsSnapshot } from "../test/settingsSnapshot";
import { SystemSettingsProvider } from "./SystemSettingsContext";
import { SimpleModeProvider } from "./SimpleModeContext";
import { SettingsAiShellPage, SettingsShellPage } from "../pages/settings/SettingsShared";
import { SettingsAiProviderPage } from "../pages/settings/ai/SettingsAiProviderPage";
import { SettingsThemePage } from "../pages/settings/SettingsShared";
import { SettingsDataPage } from "../pages/settings/SettingsDataPage";

const { mockFetchSystemSettings } = vi.hoisted(() => ({
  mockFetchSystemSettings: vi.fn(),
}));

vi.mock("../api/config", () => ({
  fetchSystemSettings: mockFetchSystemSettings,
  saveSystemSettings: vi.fn(),
}));

vi.mock("./CollectorStatusContext", () => ({
  useCollectorStatus: () => ({
    collectorStatus: "stopped",
    aiEngineStatus: "unknown",
    requestAiStatusRefresh: vi.fn(),
  }),
}));

vi.mock("./ToastContext", async () =>
  (await import("../test/context-mocks")).toastContextModuleMock());


function SharedSettingsHarness() {
  const navigate = useNavigate();
  return createElement(
    Fragment,
    null,
    createElement(
      "button",
      { type: "button", onClick: () => navigate("/settings/theme") },
      "switch-theme",
    ),
    createElement(
      "button",
      { type: "button", onClick: () => navigate("/settings/data") },
      "switch-data",
    ),
    createElement(
      "button",
      { type: "button", onClick: () => navigate("/settings/ai/provider") },
      "switch-ai",
    ),
    createElement(
      Routes,
      null,
      createElement(
        Route,
        { path: "/settings/ai", element: createElement(SettingsAiShellPage) },
        createElement(Route, { path: "provider", element: createElement(SettingsAiProviderPage) }),
      ),
      createElement(
        Route,
        { path: "/settings", element: createElement(SettingsShellPage) },
        createElement(Route, { path: "theme", element: createElement(SettingsThemePage) }),
        createElement(Route, { path: "data", element: createElement(SettingsDataPage) }),
      ),
    ),
  );
}

function renderSharedSettingsApp() {
  return createElement(
    SimpleModeProvider,
    null,
    createElement(
      SystemSettingsProvider,
      null,
      createElement(
        MemoryRouter,
        { initialEntries: ["/settings/ai/provider"] },
        createElement(SharedSettingsHarness),
      ),
    ),
  );
}

describe("SystemSettingsProvider shared navigation", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    mockFetchSystemSettings.mockReset();
    mockFetchSystemSettings.mockResolvedValue({ ...defaultSettingsSnapshot });
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

  it("fetches settings only once when navigating between /settings/ai and /settings", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(renderSharedSettingsApp());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockFetchSystemSettings).toHaveBeenCalledTimes(1);

    const switchButton = container.querySelector("button");
    expect(switchButton).toBeTruthy();

    await act(async () => {
      switchButton!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockFetchSystemSettings).toHaveBeenCalledTimes(1);
  });

  // Provider page edits LLM profiles via a dialog with direct API saves and no
  // longer feeds the shared system-settings draft. Draft preservation across
  // the AI/system-settings boundary is covered below (/settings/data → /settings/ai).
  it("preserves unsaved retention draft when navigating from /settings/data to /settings/ai", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(
          SimpleModeProvider,
          null,
          createElement(
            SystemSettingsProvider,
            null,
            createElement(
              MemoryRouter,
              { initialEntries: ["/settings/data"] },
              createElement(SharedSettingsHarness),
            ),
          ),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const retentionInput = container.querySelector<HTMLInputElement>("input[type='number']");
    expect(retentionInput).toBeTruthy();

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(retentionInput!, "45");
      retentionInput!.dispatchEvent(new Event("input", { bubbles: true }));
      retentionInput!.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("未儲存變更");

    const aiButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "switch-ai",
    );
    expect(aiButton).toBeTruthy();

    await act(async () => {
      aiButton!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("未儲存變更");
  });
});
