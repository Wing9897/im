import { createContext, type ReactNode } from "react";
import {
  useSystemSettingsPage,
  type SystemSettingsPageState,
} from "../hooks/useSystemSettingsPage";
import { useContextWithFallback } from "./useContextWithFallback";

export const SystemSettingsContext =
  createContext<SystemSettingsPageState | null>(null);

export function SystemSettingsProvider({ children }: { children?: ReactNode }) {
  const pageState = useSystemSettingsPage();

  return (
    <SystemSettingsContext.Provider value={pageState}>
      {children}
    </SystemSettingsContext.Provider>
  );
}

export function useSystemSettingsContext(): SystemSettingsPageState {
  return useContextWithFallback(
    SystemSettingsContext,
    "useSystemSettingsContext",
    "SystemSettingsProvider",
  );
}
