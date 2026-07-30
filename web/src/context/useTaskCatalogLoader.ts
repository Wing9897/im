import { useCallback, useEffect, useMemo, useState } from "react";

import { listTasks } from "../api/tasks";
import { listWorksets, type Workset } from "../api/worksets";
import { subscribeResourceModified } from "../domain/sse/resourceModified";
import type { AnalysisTask } from "../types";
import { toError } from "../utils/errors";
import { logWarn } from "../utils/logger";
import { safeArray } from "../utils/nullGuards";
import { withRetry } from "../utils/retry";

const INITIAL_TASK_LOAD_RETRY_DELAYS_MS = [1_000, 2_000];

interface RetryTaskLoadOptions {
  shouldAbort?: () => boolean;
}

async function retryTaskLoad(
  loadTasks: () => Promise<AnalysisTask[]>,
  setTaskLoadError: (value: string | null) => void,
  retryDelaysMs: readonly number[],
  options: RetryTaskLoadOptions = {},
): Promise<AnalysisTask[]> {
  return withRetry(loadTasks, {
    delays: retryDelaysMs,
    shouldAbort: options.shouldAbort,
    abortValue: options.shouldAbort ? () => [] : undefined,
    onError: (error) => {
      setTaskLoadError(error.message);
    },
    fallbackErrorMessage: "unknown task catalog error",
  });
}

export interface TaskCatalogLoaderState {
  tasks: AnalysisTask[];
  tasksLoading: boolean;
  taskLoadError: string | null;
  refreshTasks: () => Promise<AnalysisTask[]>;
  worksets: Workset[];
  worksetsLoading: boolean;
  refreshWorksets: () => Promise<Workset[]>;
}

/**
 * Encapsulates the task catalog loading, retry, and refresh logic.
 * Also loads worksets (ownership dimension) and refreshes on SSE.
 */
export function useTaskCatalogLoader(): TaskCatalogLoaderState {
  const [tasks, setTasks] = useState<AnalysisTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [taskLoadError, setTaskLoadError] = useState<string | null>(null);
  const [worksets, setWorksets] = useState<Workset[]>([]);
  const [worksetsLoading, setWorksetsLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    const nextTasks = safeArray(await listTasks());
    setTasks(nextTasks);
    setTaskLoadError(null);
    return nextTasks;
  }, []);

  const loadWorksets = useCallback(async () => {
    const next = safeArray(await listWorksets());
    setWorksets(next);
    return next;
  }, []);

  const refreshTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      return await retryTaskLoad(
        loadTasks,
        setTaskLoadError,
        INITIAL_TASK_LOAD_RETRY_DELAYS_MS,
      );
    } catch (error) {
      const normalizedError = toError(error);
      setTaskLoadError(normalizedError.message);
      throw normalizedError;
    } finally {
      setTasksLoading(false);
    }
  }, [loadTasks]);

  const refreshWorksets = useCallback(async () => {
    setWorksetsLoading(true);
    try {
      return await loadWorksets();
    } finally {
      setWorksetsLoading(false);
    }
  }, [loadWorksets]);

  useEffect(() => {
    return subscribeResourceModified((detail) => {
      if (detail.resourceType === "task") {
        void refreshTasks().catch((error) => {
          logWarn("[TaskCatalog] refresh after resource_modified failed", error);
        });
      }
      if (detail.resourceType === "workset") {
        void refreshWorksets().catch((error) => {
          logWarn("[TaskCatalog] workset refresh after resource_modified failed", error);
        });
      }
    });
  }, [refreshTasks, refreshWorksets]);

  useEffect(() => {
    let cancelled = false;

    setTasksLoading(true);
    setWorksetsLoading(true);
    void (async () => {
      try {
        await retryTaskLoad(
          loadTasks,
          setTaskLoadError,
          INITIAL_TASK_LOAD_RETRY_DELAYS_MS,
          { shouldAbort: () => cancelled },
        );
      } catch (error) {
        if (cancelled) {
          return;
        }
        const normalizedError = toError(error);
        setTaskLoadError(normalizedError.message);
      } finally {
        if (!cancelled) {
          setTasksLoading(false);
        }
      }
    })();
    void (async () => {
      try {
        await loadWorksets();
      } catch (error) {
        if (!cancelled) {
          logWarn("[TaskCatalog] initial workset load failed", error);
        }
      } finally {
        if (!cancelled) {
          setWorksetsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadTasks, loadWorksets]);

  return useMemo(
    () => ({
      tasks,
      tasksLoading,
      taskLoadError,
      refreshTasks,
      worksets,
      worksetsLoading,
      refreshWorksets,
    }),
    [
      refreshTasks,
      refreshWorksets,
      taskLoadError,
      tasks,
      tasksLoading,
      worksets,
      worksetsLoading,
    ],
  );
}
