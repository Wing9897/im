import { createContext, useMemo } from "react";
import type { ReactNode } from "react";
import type { AiEngineStatus, CollectorStatus } from "../types";
import { useContextWithFallback } from "./useContextWithFallback";

export interface CollectorStatusContextValue {
  collectorStatus: CollectorStatus;
  aiEngineStatus: AiEngineStatus;
  requestAiStatusRefresh: (logOnChange?: boolean) => void;
}

export const CollectorStatusContext =
  createContext<CollectorStatusContextValue | null>(null);

export interface CollectorStatusProviderProps {
  children?: ReactNode;
  collectorStatus: CollectorStatus;
  aiEngineStatus: AiEngineStatus;
  requestAiStatusRefresh: (logOnChange?: boolean) => void;
}

export function CollectorStatusProvider({
  children,
  collectorStatus,
  aiEngineStatus,
  requestAiStatusRefresh,
}: CollectorStatusProviderProps) {
  const value = useMemo<CollectorStatusContextValue>(
    () => ({
      collectorStatus,
      aiEngineStatus,
      requestAiStatusRefresh,
    }),
    [collectorStatus, aiEngineStatus, requestAiStatusRefresh],
  );

  return (
    <CollectorStatusContext.Provider value={value}>
      {children}
    </CollectorStatusContext.Provider>
  );
}

export function useCollectorStatus(): CollectorStatusContextValue {
  return useContextWithFallback(
    CollectorStatusContext,
    "useCollectorStatus",
    "CollectorStatusProvider",
  );
}
