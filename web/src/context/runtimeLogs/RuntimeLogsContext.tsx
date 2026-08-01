import { createContext } from "react";

import type { AppLogEntry } from "../appRuntimeShared";
import { useContextWithFallback } from "../useContextWithFallback";

export interface RuntimeLogsContextValue {
  logs: AppLogEntry[];
  totalLogCount: number;
  hasMoreLogs: boolean;
  logsLoading: boolean;
  logsLoadingMore: boolean;
  logLoadError: string | null;
  clearLogs: () => void;
  refreshLogs: () => Promise<void>;
  loadMoreLogs: () => Promise<void>;
}

export const RuntimeLogsContext =
  createContext<RuntimeLogsContextValue | null>(null);

export function useRuntimeLogs(): RuntimeLogsContextValue {
  return useContextWithFallback(
    RuntimeLogsContext,
    "useRuntimeLogs",
    "RuntimeLogsProvider",
  );
}
