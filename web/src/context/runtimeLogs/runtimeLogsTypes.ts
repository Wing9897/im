import type { AppLogEntry, AppLogInput } from "../appRuntimeShared";

export interface RuntimeLogsState {
  logs: AppLogEntry[];
  totalLogCount: number;
  hasMoreLogs: boolean;
  logsLoading: boolean;
  logsLoadingMore: boolean;
  logLoadError: string | null;
  addLog: (entry: AppLogInput) => void;
  clearLogs: () => void;
  refreshStoredLogs: () => Promise<void>;
  resetStoredLogs: () => Promise<void>;
  loadMoreStoredLogs: () => Promise<void>;
  warnNonFatal: (key: string, message: string, error: unknown) => void;
}
