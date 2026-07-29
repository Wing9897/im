import { createContext, useMemo } from "react";
import type { ReactNode } from "react";
import type { AnalysisTask } from "../types";
import { buildTaskNameById } from "../domain/timeline/userEvents";
import { useContextWithFallback } from "./useContextWithFallback";
import { useTaskCatalogLoader } from "./useTaskCatalogLoader";

interface TaskCatalogContextValue {
  tasks: AnalysisTask[];
  tasksLoading: boolean;
  taskLoadError: string | null;
  refreshTasks: () => Promise<AnalysisTask[]>;
}

const TaskCatalogContext = createContext<TaskCatalogContextValue | null>(null);

interface TaskCatalogProviderProps {
  children: ReactNode;
}

export function TaskCatalogProvider({ children }: TaskCatalogProviderProps) {
  const value = useTaskCatalogLoader();

  return (
    <TaskCatalogContext.Provider value={value}>
      {children}
    </TaskCatalogContext.Provider>
  );
}

export function useTaskCatalog(): TaskCatalogContextValue {
  return useContextWithFallback(
    TaskCatalogContext,
    "useTaskCatalog",
    "TaskCatalogProvider",
  );
}

/**
 * Task display names from the shared catalog. Resolving names at render (rather
 * than inside a fetcher) keeps labels correct after a rename or locale change.
 */
export function useTaskNameById(): ReadonlyMap<string, string> {
  const { tasks } = useTaskCatalog();
  return useMemo(() => buildTaskNameById(tasks), [tasks]);
}
