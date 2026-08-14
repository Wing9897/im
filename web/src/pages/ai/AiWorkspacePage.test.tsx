import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { SystemSettingsSnapshot } from "../../types";
import { defaultSettingsSnapshot } from "../../test/settingsSnapshot";

const { mockFetchSystemSettings, mockSaveSystemSettings } = vi.hoisted(() => ({
  mockFetchSystemSettings: vi.fn(),
  mockSaveSystemSettings: vi.fn(),
}));

vi.mock("../../api/config", () => ({
  fetchSystemSettings: mockFetchSystemSettings,
  saveSystemSettings: mockSaveSystemSettings,
}));

vi.mock("../../context/CollectorStatusContext", () => ({
  useCollectorStatus: () => ({
    collectorStatus: "stopped",
    aiEngineStatus: "unknown",
    requestAiStatusRefresh: vi.fn(),
  }),
}));

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

import { SystemSettingsProvider } from "../../context/SystemSettingsContext";
import { SimpleModeProvider } from "../../context/SimpleModeContext";
import { AiWorkspacePage } from "./AiWorkspacePage";
import { SettingsAiProviderPage } from "./SettingsAiProviderPage";

function setupInvokeMock(overrides?: Partial<SystemSettingsSnapshot>) {
  const snapshot = { ...defaultSettingsSnapshot, ...overrides };
  mockFetchSystemSettings.mockResolvedValue({ ...snapshot });
  mockSaveSystemSettings.mockImplementation((settings: SystemSettingsSnapshot) =>
    Promise.resolve({ ...settings }),
  );
}

function renderSettingsRoute() {
  return createElement(
    SimpleModeProvider,
    null,
    createElement(
      SystemSettingsProvider,
      null,
      createElement(
        MemoryRouter,
        { initialEntries: ["/ai/provider"] },
        createElement(
          Routes,
          null,
          createElement(
            Route,
            { path: "/ai", element: createElement(AiWorkspacePage) },
            createElement(Route, {
              path: "provider",
              element: createElement(SettingsAiProviderPage),
            }),
          ),
        ),
      ),
    ),
  );
}

function renderAiWorkspaceRoute() {
  return createElement(
    SimpleModeProvider,
    null,
    createElement(
      SystemSettingsProvider,
      null,
      createElement(
        MemoryRouter,
        { initialEntries: ["/ai"] },
        createElement(
          Routes,
          null,
          createElement(Route, {
            path: "/ai",
            element: createElement(AiWorkspacePage),
          }),
        ),
      ),
    ),
  );
}

// NOTE: the /ai/provider page now edits LLM profiles via a dialog with direct
// API saves (see SettingsAiProviderPage.test.tsx) and no longer feeds the
// shared system-settings draft, so the old unsaved-changes-indicator tests
// against provider inputs were retired.
describe("AiWorkspacePage provider route", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    mockFetchSystemSettings.mockReset();
    mockSaveSystemSettings.mockReset();
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

  it("renders the provider sub-route inside the workspace shell", async () => {
    setupInvokeMock();

    await act(async () => {
      root = createRoot(container);
      root.render(renderSettingsRoute());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("未儲存變更");
    expect(container.querySelector('nav[aria-label="設定分頁"]')).toBeTruthy();
  });
});

describe("AiWorkspacePage layout", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    mockFetchSystemSettings.mockReset();
    mockSaveSystemSettings.mockReset();
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

  it("does not render a workspace page header", async () => {
    setupInvokeMock();

    await act(async () => {
      root = createRoot(container);
      root.render(renderAiWorkspaceRoute());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector("h1")).toBeNull();
    expect(container.textContent).not.toContain("設定 LLM 供應商與分析調度");
  });

  it("renders segmented workspace sub-navigation without 助手 tab", async () => {
    setupInvokeMock();

    await act(async () => {
      root = createRoot(container);
      root.render(renderAiWorkspaceRoute());
      await Promise.resolve();
      await Promise.resolve();
    });

    const nav = container.querySelector('nav[aria-label="設定分頁"]');
    expect(nav).toBeTruthy();
    expect(container.textContent).not.toContain("助手");
    // Provider tab was renamed to "AI 設定檔" with the profile-based editor.
    expect(container.textContent).toContain("AI 設定檔");
    expect(container.querySelector('[data-testid="segmented-indicator"]')).toBeTruthy();
    expect(container.querySelector(".relative.flex.w-full.overflow-hidden.rounded-md")).toBeTruthy();
  });

  it("renders loading state text when settings are not yet loaded", async () => {
    mockFetchSystemSettings.mockReturnValue(new Promise(() => {}));

    await act(async () => {
      root = createRoot(container);
      root.render(renderAiWorkspaceRoute());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("正在載入設定");
  });
});
