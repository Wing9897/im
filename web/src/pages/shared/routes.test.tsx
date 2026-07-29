/**
 * Route rendering verification test.
 *
 * Verifies that all route components defined in App.tsx can be imported and
 * mounted without throwing uncaught exceptions. This validates Requirement 1.6:
 * "THE Frontend SHALL render all registered routes without runtime errors."
 *
 * Strategy:
 * 1. Verify all lazy-loaded page modules resolve without import errors
 * 2. Render representative routes (top-level + nested) to confirm mounting works
 * 3. Compilation verification is done separately via `tsc --noEmit` and `vite build`
 */
import React, { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSettingsSnapshot } from "../../test/settingsSnapshot";

/* ------------------------------------------------------------------ */
/* Mocks                                                               */
/* ------------------------------------------------------------------ */

vi.mock("../../context/AppRuntimeContext", () => ({
  AppRuntimeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("../../context/CollectorStatusContext", () => ({
  useCollectorStatus: () => ({
    collectorStatus: "stopped",
    aiEngineStatus: "unknown",
    requestAiStatusRefresh: vi.fn(),
  }),
}));

vi.mock("../../context/AnalysisStatusContext", () => ({
  useAnalysisStatus: () => ({
    queueStatus: null,
    analysisPaused: false,
    activeAnalysis: null,
    activeAnalyses: new Map(),
    lastAnalysisEvent: null,
    lastAccountStatusChange: null,
    lastMessagesUpdate: null,
    requestQueueStatusRefresh: vi.fn(),
  }),
}));

vi.mock("../../context/SimpleModeContext", () => ({
  SimpleModeProvider: ({ children }: { children: React.ReactNode }) => children,
  useSimpleMode: () => ({ simpleMode: false, setSimpleMode: vi.fn() }),
}));

vi.mock("../../hooks/useAssistantChat", () => ({
  AssistantChatProvider: ({ children }: { children: React.ReactNode }) => children,
  useAssistantChat: () => ({
    messages: [],
    draft: "",
    setDraft: vi.fn(),
    sending: false,
    liveToolSteps: [],
    listening: false,
    speaking: false,
    error: null,
    sttAvailable: false,
    ttsAvailable: false,
    ttsEnabled: false,
    spacePttMode: "hold" as const,
    sendDraft: vi.fn(),
    startListening: vi.fn(),
    stopListening: vi.fn(),
    stopSpeaking: vi.fn(),
    clearChat: vi.fn(),
  }),
}));

vi.mock("../../context/runtimeLogs/RuntimeLogsContext", () => ({
  useRuntimeLogs: () => ({
    logs: [],
    totalLogCount: 0,
    hasMoreLogs: false,
    logsLoading: false,
    logsLoadingMore: false,
    logLoadError: null,
    clearLogs: vi.fn(),
    refreshLogs: vi.fn(async () => {}),
    loadMoreLogs: vi.fn(async () => {}),
  }),
}));

vi.mock("../../api/config", () => ({
  fetchSystemSettings: vi.fn().mockResolvedValue(defaultSettingsSnapshot),
  saveSystemSettings: vi.fn(),
}));

import { SystemSettingsProvider } from "../../context/SystemSettingsContext";
import { fetchSystemSettings } from "../../api/config";

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock());

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

/* ------------------------------------------------------------------ */
/* Test: All lazy-loaded route modules can be imported                  */
/* ------------------------------------------------------------------ */

describe("Route module imports", () => {
  it("all lazy-loaded page modules resolve without import errors", async () => {
    const pageModules = [
      () => import("../monitor/MonitorPage"),
      () => import("../dashboard/DashboardViewer"),
      () => import("../tasks/chat-editor/ChatEditorPage"),
      () => import("../tasks/project/ProjectDetailPage"),
      () => import("../leaderboard/LeaderboardPage"),
      () => import("../intelligence/IntelligencePage"),
      () => import("../timeline/TimelinePage"),
      () => import("../sources/SourceManagementPage"),
      () => import("../actions/ActionsPage"),
      () => import("../logs/LogPage"),
      () => import("../ai/AiWorkspacePage"),
      () => import("../ai/assistant/AssistantPage"),
      () => import("../settings/SettingsShared"),
      () => import("../settings/SettingsThemePage"),
      () => import("../ai/SettingsAiProviderPage"),
      () => import("../ai/SettingsVoicePage"),
      () => import("../ai/SettingsAnalysisStrategyPage"),
      () => import("../settings/SettingsDataPage"),
    ];

    const results = await Promise.allSettled(pageModules.map((m) => m()));

    for (const result of results) {
      expect(result.status).toBe("fulfilled");
      if (result.status === "fulfilled") {
        expect(Object.values(result.value).length).toBeGreaterThan(0);
      }
    }
  }, 60000);
});

/* ------------------------------------------------------------------ */
/* Test: Representative routes render without runtime errors            */
/* ------------------------------------------------------------------ */

describe("Route rendering — representative routes mount without errors", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    window.localStorage.clear();
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

  it("renders /monitor (top-level route) without errors", async () => {
    const { MonitorPage } = await import("../monitor/MonitorPage");
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(MemoryRouter, {
          initialEntries: ["/monitor"],
          children: createElement(
            Routes,
            null,
            createElement(Route, { path: "/monitor", element: createElement(MonitorPage) }),
          ),
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });

  it("renders /tasks (top-level route) without errors", async () => {
    const { DashboardViewer } = await import("../dashboard/DashboardViewer");
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(MemoryRouter, {
          initialEntries: ["/tasks"],
          children: createElement(
            Routes,
            null,
            createElement(Route, { path: "/tasks", element: createElement(DashboardViewer) }),
          ),
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });

  it("renders /settings/logs (nested route) without errors", async () => {
    const { LogPage } = await import("../logs/LogPage");
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(MemoryRouter, {
          initialEntries: ["/settings/logs"],
          children: createElement(
            Routes,
            null,
            createElement(Route, { path: "/settings/logs", element: createElement(LogPage) }),
          ),
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });

  it("renders /ai/provider (nested route) without errors", async () => {
    const { AiWorkspacePage } = await import("../ai/AiWorkspacePage");
    const { SettingsAiProviderPage } = await import("../ai/SettingsAiProviderPage");
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(
          SystemSettingsProvider,
          null,
          createElement(MemoryRouter, {
            initialEntries: ["/ai/provider"],
            children: createElement(
              Routes,
              null,
              createElement(
                Route,
                { path: "/ai", element: createElement(AiWorkspacePage) },
                createElement(Route, { path: "provider", element: createElement(SettingsAiProviderPage) }),
              ),
            ),
          }),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });

  it("renders /assistant without errors", async () => {
    const { AssistantPage } = await import("../ai/assistant/AssistantPage");
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(MemoryRouter, {
          initialEntries: ["/assistant"],
          children: createElement(
            Routes,
            null,
            createElement(Route, { path: "/assistant", element: createElement(AssistantPage) }),
          ),
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector("[data-testid='assistant-page']")).toBeTruthy();
  });

  it("renders /ai/voice (nested route) without errors", async () => {
    const { AiWorkspacePage } = await import("../ai/AiWorkspacePage");
    const { SettingsVoicePage } = await import("../ai/SettingsVoicePage");
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(
          SystemSettingsProvider,
          null,
          createElement(MemoryRouter, {
            initialEntries: ["/ai/voice"],
            children: createElement(
              Routes,
              null,
              createElement(
                Route,
                { path: "/ai", element: createElement(AiWorkspacePage) },
                createElement(Route, { path: "voice", element: createElement(SettingsVoicePage) }),
              ),
            ),
          }),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.innerHTML.length).toBeGreaterThan(0);
    expect(container.textContent ?? "").toMatch(/語音|STT|TTS/);
  });

  it("renders /settings/theme (nested route) without errors", async () => {
    const { SettingsShellPage: SystemSettingsPage } = await import("../settings/SettingsShared");
    const { SettingsThemePage } = await import("../settings/SettingsThemePage");
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(
          SystemSettingsProvider,
          null,
          createElement(MemoryRouter, {
            initialEntries: ["/settings/theme"],
            children: createElement(
              Routes,
              null,
              createElement(
                Route,
                { path: "/settings", element: createElement(SystemSettingsPage) },
                createElement(Route, { path: "theme", element: createElement(SettingsThemePage) }),
              ),
            ),
          }),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* Test: SystemSettingsProvider scope                                       */
/* ------------------------------------------------------------------ */

describe("SystemSettingsProvider scope", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.mocked(fetchSystemSettings).mockClear();
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

  it("does not fetch settings when /monitor renders without provider", async () => {
    const { MonitorPage } = await import("../monitor/MonitorPage");
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(MemoryRouter, {
          initialEntries: ["/monitor"],
          children: createElement(
            Routes,
            null,
            createElement(Route, { path: "/monitor", element: createElement(MonitorPage) }),
          ),
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchSystemSettings).not.toHaveBeenCalled();
  });

  it("fetches settings once when provider wraps /ai", async () => {
    const { AiWorkspacePage } = await import("../ai/AiWorkspacePage");
    const { SettingsAiProviderPage } = await import("../ai/SettingsAiProviderPage");
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(
          SystemSettingsProvider,
          null,
          createElement(MemoryRouter, {
            initialEntries: ["/ai/provider"],
            children: createElement(
              Routes,
              null,
              createElement(
                Route,
                { path: "/ai", element: createElement(AiWorkspacePage) },
                createElement(Route, { path: "provider", element: createElement(SettingsAiProviderPage) }),
              ),
            ),
          }),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchSystemSettings).toHaveBeenCalledTimes(1);
  });
});
