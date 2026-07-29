import { useCallback, useEffect, useMemo, useState } from "react";

import { listTasks } from "../api/tasks";
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

interface TaskCatalogLoaderState {
  tasks: AnalysisTask[];
  tasksLoading: boolean;
  taskLoadError: string | null;
  refreshTasks: () => Promise<AnalysisTask[]>;
}

/**
 * Encapsulates the task catalog loading, retry, and refresh logic.
 * Extracted from TaskCatalogProvider to separate derived/async computations
 * from the context provider shell.
 *
 * IMPORTANT: always call `listTasks()` with **no** `topLevelOnly` /
 * `top_level_only`. Project detail needs child recurring rows (`parentTaskId`)
 * from this shared catalog; top-level filtering belongs on the dashboard via
 * `selectTopLevelTasks`, not here.
 */
export function useTaskCatalogLoader(): TaskCatalogLoaderState {
  const [tasks, setTasks] = useState<AnalysisTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [taskLoadError, setTaskLoadError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    // Do NOT pass topLevelOnly — see module comment above.
    const nextTasks = safeArray(await listTasks());
    setTasks(nextTasks);
    setTaskLoadError(null);
    return nextTasks;
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

  useEffect(() => {
    return subscribeResourceModified((detail) => {
      if (detail.resourceType !== "task") return;
      void refreshTasks().catch((error) => {
        logWarn("[TaskCatalog] refresh after resource_modified failed", error);
      });
    });
  }, [refreshTasks]);

  useEffect(() => {
    let cancelled = false;

    setTasksLoading(true);
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

    return () => {
      cancelled = true;
    };
  }, [loadTasks]);

  return useMemo(
    () => ({
      tasks,
      tasksLoading,
      taskLoadError,
      refreshTasks,
    }),
    [refreshTasks, taskLoadError, tasks, tasksLoading],
  );
}
