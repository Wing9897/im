/**
 * Shared runtime-log mocks for LogPage integration tests.
 *
 * ```ts
 * vi.mock("../../context/runtimeLogs/RuntimeLogsContext", async () =>
 *   (await import("../../test/logPageMocks")).runtimeLogsModuleMock());
 * import { runtimeLogPageState, MockIntersectionObserver } from "../../test/logPageMocks";
 * ```
 */
import { vi } from "vitest";

export interface MockLogEntry {
  id: string;
  time: string;
  level: string;
  category: string;
  message: string;
  details?: string;
}

export interface MockRuntimeLogPageState {
  logs: MockLogEntry[];
  totalLogCount: number;
  hasMoreLogs: boolean;
  logsLoading: boolean;
  logsLoadingMore: boolean;
  logLoadError: string | null;
  activeAnalysis: null;
  lastMessagesUpdate: null;
  clearLogs: ReturnType<typeof vi.fn>;
  refreshLogs: ReturnType<typeof vi.fn>;
  loadMoreLogs: ReturnType<typeof vi.fn>;
}

export const LONG_LOG_TEXT = "A".repeat(500) + " " + "B".repeat(500);

export const runtimeLogPageState: MockRuntimeLogPageState = {
  logs: [
    {
      id: "log-1",
      time: "2026-04-17T03:00:00.000Z",
      level: "info",
      category: "system",
      message: "Persisted log entry",
    },
  ],
  totalLogCount: 1,
  hasMoreLogs: false,
  logsLoading: false,
  logsLoadingMore: false,
  logLoadError: null,
  activeAnalysis: null,
  lastMessagesUpdate: null,
  clearLogs: vi.fn(),
  refreshLogs: vi.fn(async () => {}),
  loadMoreLogs: vi.fn(async () => {}),
};

export class MockIntersectionObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

export function runtimeLogsModuleMock() {
  return {
    useRuntimeLogs: () => ({
      logs: runtimeLogPageState.logs,
      totalLogCount: runtimeLogPageState.totalLogCount,
      hasMoreLogs: runtimeLogPageState.hasMoreLogs,
      logsLoading: runtimeLogPageState.logsLoading,
      logsLoadingMore: runtimeLogPageState.logsLoadingMore,
      logLoadError: runtimeLogPageState.logLoadError,
      clearLogs: runtimeLogPageState.clearLogs,
      refreshLogs: runtimeLogPageState.refreshLogs,
      loadMoreLogs: runtimeLogPageState.loadMoreLogs,
    }),
  };
}

export function analysisStatusLogPageModuleMock() {
  return {
    useAnalysisStatus: () => ({
      activeAnalysis: runtimeLogPageState.activeAnalysis,
      lastMessagesUpdate: runtimeLogPageState.lastMessagesUpdate,
    }),
  };
}

export function workspaceShellLogPageModuleMock() {
  return {
    SettingsTopTabs: () => null,
    settingsTabItems: [],
  };
}
