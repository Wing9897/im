/**
 * Loads project meta, child recurring, owned user_events, and last-tick summary.
 *
 * Catalog stays full-list (`listTasks()` without `top_level_only`) so child
 * recurring rows remain visible here via `parentTaskId` — do not switch the
 * shared catalog to top-level-only.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ApiRequestError } from "../../../api/client";
import { fetchTaskSchedule } from "../../../api/taskSchedule";
import { listUserEvents, type UserEvent } from "../../../api/userEvents";
import { fetchProjectTickStatus, fetchTaskActivitySpans } from "../../../api/tasks";
import { buildChannelNameById, resolveChannelLabel } from "../../../components/detail";
import { mapActiveAnalysesToTasks } from "../../../components/analysis/analysisStatusModel";
import { useAnalysisStatus } from "../../../context/AnalysisStatusContext";
import { useTaskCatalog } from "../../../context/TaskCatalogContext";
import { pickLatestBatchAttention } from "../../../domain/analysis/batchAttention";
import { subscribeResourceModified } from "../../../domain/sse/resourceModified";
import { useChannelsWithSources } from "../../../hooks/useChannelsWithSources";
import { toErrorMessage } from "../../../utils/errors";
import { logWarn } from "../../../utils/logger";
import type { ProjectTickStatus, TaskActivitySpan } from "../../../types/analysis";
import type { AnalysisTask } from "../../../types/tasks";
import {
  findActivitySpan,
  isProjectTask,
  mergeChildRrules,
  selectProjectChildren,
  type ChildScheduleFetchResult,
} from "./projectDetailModel";

export function useProjectDetail() {
  const navigate = useNavigate();
  const { taskId = "" } = useParams<{ taskId: string }>();
  const { tasks, tasksLoading, taskLoadError, refreshTasks } = useTaskCatalog();
  const { channels } = useChannelsWithSources();
  const { activeAnalyses, queueStatus, analysisPaused } = useAnalysisStatus();

  const project = useMemo(
    () => tasks.find((task) => task.id === taskId) ?? null,
    [tasks, taskId],
  );

  const children = useMemo(
    () => (taskId ? selectProjectChildren(tasks, taskId) : []),
    [tasks, taskId],
  );

  const channelNameById = useMemo(() => buildChannelNameById(channels), [channels]);

  const channelLabels = useMemo(() => {
    if (!project) return [];
    return project.channelIds.map((ref) => resolveChannelLabel(ref, channelNameById));
  }, [project, channelNameById]);

  const [events, setEvents] = useState<UserEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [childSchedulesError, setChildSchedulesError] = useState<string | null>(null);

  const [activitySpan, setActivitySpan] = useState<TaskActivitySpan | null>(null);
  const [tickStatus, setTickStatus] = useState<ProjectTickStatus | null>(null);
  const [spanLoading, setSpanLoading] = useState(false);
  const [childRrules, setChildRrules] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );
  const childRrulesRef = useRef(childRrules);
  childRrulesRef.current = childRrules;

  const loadSideData = useCallback(async (id: string, childIds: readonly string[] = []) => {
    setEventsLoading(true);
    setSpanLoading(true);
    setEventsError(null);
    setChildSchedulesError(null);
    try {
      const [ownedEvents, spans, status, scheduleResults] = await Promise.all([
        listUserEvents({ taskId: id }),
        fetchTaskActivitySpans(),
        fetchProjectTickStatus(id, { limit: 20 }),
        Promise.all(
          childIds.map(async (childId): Promise<ChildScheduleFetchResult> => {
            try {
              const schedule = await fetchTaskSchedule(childId);
              return {
                childId,
                kind: "ok",
                rrule: schedule.rrule?.trim() || "",
              };
            } catch (err) {
              if (err instanceof ApiRequestError && err.status === 404) {
                return { childId, kind: "missing" };
              }
              return { childId, kind: "error", message: toErrorMessage(err) };
            }
          }),
        ),
      ]);
      setEvents(ownedEvents);
      setActivitySpan(findActivitySpan(spans, id));
      setTickStatus(status);
      const merged = mergeChildRrules(childRrulesRef.current, scheduleResults);
      setChildRrules(merged.rrules);
      setChildSchedulesError(merged.error);
    } catch (err) {
      setEventsError(toErrorMessage(err));
      setEvents([]);
      setActivitySpan(null);
      setTickStatus(null);
      setChildRrules(new Map());
      setChildSchedulesError(null);
    } finally {
      setEventsLoading(false);
      setSpanLoading(false);
    }
  }, []);

  const childIdsKey = children.map((child) => child.id).join(",");

  useEffect(() => {
    if (!taskId) return;
    void loadSideData(
      taskId,
      childIdsKey ? childIdsKey.split(",") : [],
    );
  }, [taskId, childIdsKey, loadSideData]);

  // Refresh catalog + side data when tasks / owned user_events change via SSE.
  useEffect(() => {
    if (!taskId) return;
    return subscribeResourceModified((detail) => {
      if (detail.resourceType !== "task" && detail.resourceType !== "user_event") {
        return;
      }
      void refreshTasks().catch((error) => {
        logWarn("[projectDetail] catalog refresh after resource_modified failed", error);
      });
      const ids = childIdsKey ? childIdsKey.split(",") : [];
      void loadSideData(taskId, ids).catch((error) => {
        logWarn("[projectDetail] side-data refresh after resource_modified failed", error);
      });
    });
  }, [taskId, childIdsKey, refreshTasks, loadSideData]);

  const reload = useCallback(async () => {
    const ids = childIdsKey ? childIdsKey.split(",") : [];
    await Promise.all([
      refreshTasks().catch((error) => {
        logWarn("[projectDetail] manual catalog reload failed", error);
      }),
      taskId ? loadSideData(taskId, ids) : Promise.resolve(),
    ]);
  }, [refreshTasks, loadSideData, taskId, childIdsKey]);

  const isRunning = useMemo(() => {
    if (!taskId) return false;
    return mapActiveAnalysesToTasks(activeAnalyses).has(taskId);
  }, [activeAnalyses, taskId]);

  const batchAttention = useMemo(() => {
    if (!taskId) return null;
    return pickLatestBatchAttention(queueStatus, taskId);
  }, [queueStatus, taskId]);

  const lastErrorMessage =
    activitySpan?.lastErrorMessage?.trim() ||
    batchAttention?.errorMessage ||
    null;
  const batchRetryCount = batchAttention?.retryCount ?? 0;
  const showAnalysisPaused =
    Boolean(batchAttention) &&
    (analysisPaused || Boolean(queueStatus?.analysisPaused));

  const notFound =
    !tasksLoading && Boolean(taskId) && (!project || !isProjectTask(project));

  const goBack = useCallback(() => {
    navigate("/tasks");
  }, [navigate]);

  const goEdit = useCallback(() => {
    if (!taskId) return;
    navigate(`/tasks/${taskId}/edit`);
  }, [navigate, taskId]);

  const goEditChild = useCallback(
    (child: AnalysisTask) => {
      navigate(`/tasks/${child.id}/edit`);
    },
    [navigate],
  );

  const goTimeline = useCallback(() => {
    navigate("/timeline");
  }, [navigate]);

  return {
    taskId,
    project,
    children,
    childRrules,
    channelLabels,
    events,
    eventsLoading,
    eventsError,
    childSchedulesError,
    activitySpan,
    tickStatus,
    spanLoading,
    isRunning,
    lastErrorMessage,
    batchRetryCount,
    showAnalysisPaused,
    loading: tasksLoading && !project,
    catalogError: taskLoadError,
    notFound,
    refreshTasks,
    reload,
    reloadSideData: () =>
      taskId
        ? loadSideData(taskId, childIdsKey ? childIdsKey.split(",") : [])
        : Promise.resolve(),
    goBack,
    goEdit,
    goEditChild,
    goTimeline,
  };
}
