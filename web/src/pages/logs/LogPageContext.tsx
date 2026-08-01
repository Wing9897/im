import { createContext, useContext, type ReactNode } from "react";

import { useLogPage } from "./useLogPage";

type LogPageContextValue = ReturnType<typeof useLogPage>;

const LogPageContext = createContext<LogPageContextValue | null>(null);

export function LogPageProvider({ children }: { children: ReactNode }) {
  const value = useLogPage();
  return (
    <LogPageContext.Provider value={value}>{children}</LogPageContext.Provider>
  );
}

export function useLogPageContext(): LogPageContextValue {
  const ctx = useContext(LogPageContext);
  if (!ctx) {
    throw new Error("useLogPageContext must be used within LogPageProvider");
  }
  return ctx;
}
