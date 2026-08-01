import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { listTasks } from "../api/tasks";
import { listWorksets, type Workset } from "../api/worksets";
import { subscribeResourceModified } from "../domain/sse/resourceModified";
import type { AnalysisTask } from "../types";
import { toError } from "../utils/errors";
import { logWarn } from "../utils/logger";
import { safeArray } from "../utils/nullGuards";
import { withRetry } from "../utils/retry";

const INITIAL_TASK_LOAD_RETRY_DELAYS_MS = [1_000, 2_000];
/** Serve cached catalog for this window; SSE triggers background revalidation. */
export const TASK_CATALOG_TTL_MS = 30_000;

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
 *
 * TTL + stale-while-revalidate: within TASK_CATALOG_TTL_MS, SSE-driven refresh
 * keeps showing the last good catalog while a background revalidate runs
 * (no loading flash). Explicit `refreshTasks()` always revalidates.
 */
export function useTaskCatalogLoader(): TaskCatalogLoaderState {
  const [tasks, setTasks] = useState<AnalysisTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [taskLoadError, setTaskLoadError] = useState<string | null>(null);
  const [worksets, setWorksets] = useState<Workset[]>([]);
  const [worksetsLoading, setWorksetsLoading] = useState(true);

  const tasksFetchedAtRef = useRef(0);
  const worksetsFetchedAtRef = useRef(0);
  const tasksInflightRef = useRef<Promise<AnalysisTask[]> | null>(null);
  const worksetsInflightRef = useRef<Promise<Workset[]> | null>(null);

  const loadTasks = useCallback(async () => {
    const nextTasks = safeArray(await listTasks());
    setTasks(nextTasks);
    setTaskLoadError(null);
    tasksFetchedAtRef.current = Date.now();
    return nextTasks;
  }, []);

  const loadWorksets = useCallback(async () => {
    const next = safeArray(await listWorksets());
    setWorksets(next);
    worksetsFetchedAtRef.current = Date.now();
    return next;
  }, []);

  const refreshTasks = useCallback(
    async (opts?: { background?: boolean }) => {
      if (tasksInflightRef.current) {
        return tasksInflightRef.current;
      }
      const background = opts?.background === true;
      if (!background) {
        setTasksLoading(true);
      }
      const promise = (async () => {
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
          if (!background) {
            setTasksLoading(false);
          }
          tasksInflightRef.current = null;
        }
      })();
      tasksInflightRef.current = promise;
      return promise;
    },
    [loadTasks],
  );

  const refreshWorksets = useCallback(
    async (opts?: { background?: boolean }) => {
      if (worksetsInflightRef.current) {
        return worksetsInflightRef.current;
      }
      const background = opts?.background === true;
      if (!background) {
        setWorksetsLoading(true);
      }
      const promise = (async () => {
        try {
          return await loadWorksets();
        } finally {
          if (!background) {
            setWorksetsLoading(false);
          }
          worksetsInflightRef.current = null;
        }
      })();
      worksetsInflightRef.current = promise;
      return promise;
    },
    [loadWorksets],
  );

  useEffect(() => {
    return subscribeResourceModified((detail) => {
      if (detail.resourceType === "task") {
        const fresh = Date.now() - tasksFetchedAtRef.current < TASK_CATALOG_TTL_MS;
        void refreshTasks({ background: fresh || tasks.length > 0 }).catch((error) => {
          logWarn("[TaskCatalog] refresh after resource_modified failed", error);
        });
      }
      if (detail.resourceType === "workset") {
        const fresh = Date.now() - worksetsFetchedAtRef.current < TASK_CATALOG_TTL_MS;
        void refreshWorksets({ background: fresh || worksets.length > 0 }).catch((error) => {
          logWarn("[TaskCatalog] workset refresh after resource_modified failed", error);
        });
      }
    });
  }, [refreshTasks, refreshWorksets, tasks.length, worksets.length]);

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
      refreshTasks: () => refreshTasks(),
      worksets,
      worksetsLoading,
      refreshWorksets: () => refreshWorksets(),
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
