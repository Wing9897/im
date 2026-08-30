import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import type { Workset } from "../api/worksets";
import type { AnalysisTask } from "../types";
import { buildTaskNameById } from "../domain/timeline/userEvents";
import { useContextWithFallback } from "./useContextWithFallback";
import { useTaskCatalogLoader } from "./useTaskCatalogLoader";

export interface TaskCatalogContextValue {
  tasks: AnalysisTask[];
  tasksLoading: boolean;
  taskLoadError: string | null;
  refreshTasks: () => Promise<AnalysisTask[]>;
  worksets: Workset[];
  worksetsLoading: boolean;
  refreshWorksets: () => Promise<Workset[]>;
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

/** Catalog worksets/tasks when a provider is mounted; `null` outside the tree. */
export function useOptionalTaskCatalog(): TaskCatalogContextValue | null {
  return useContext(TaskCatalogContext);
}

/**
 * Task display names from the shared catalog. Resolving names at render (rather
 * than inside a fetcher) keeps labels correct after a rename or locale change.
 */
export function useTaskNameById(): ReadonlyMap<string, string> {
  const { tasks } = useTaskCatalog();
  return useMemo(() => buildTaskNameById(tasks), [tasks]);
}

/** Workset display names from the shared catalog. */
export function useWorksetNameById(): ReadonlyMap<string, string> {
  const { worksets } = useTaskCatalog();
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const ws of worksets) {
      map.set(ws.id, ws.name);
    }
    return map;
  }, [worksets]);
}
