/**
 * Loads project meta, child recurring, owned user_events, and last-tick summary.
 *
 * Catalog stays full-list (`listTasks()` without `top_level_only`) so child
 * recurring rows remain visible here via `parentTaskId` — do not switch the
 * shared catalog to top-level-only.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { listUserEvents, type UserEvent } from "../../../api/userEvents";
import { fetchProjectTickStatus, fetchTaskActivitySpans } from "../../../api/tasks";
import { buildChannelNameById, resolveChannelLabel } from "../../../components/detail";
import { mapActiveAnalysesToTasks } from "../../../components/analysis/analysisStatusModel";
import { useAnalysisStatus } from "../../../context/AnalysisStatusContext";
import { useTaskCatalog } from "../../../context/TaskCatalogContext";
import { pickLatestBatchAttention } from "../../../domain/analysis/batchAttention";
import { subscribeResourceModified } from "../../../domain/sse/resourceModified";
import { useChannelsWithAccounts } from "../../../hooks/useChannelsWithAccounts";
import { toErrorMessage } from "../../../utils/errors";
import { logWarn } from "../../../utils/logger";
import type { ProjectTickStatus, TaskActivitySpan } from "../../../types/analysis";
import type { AnalysisTask } from "../../../types/tasks";
import {
  findActivitySpan,
  isProjectTask,
  selectProjectChildren,
} from "./projectDetailModel";

export function useProjectDetail() {
  const navigate = useNavigate();
  const { taskId = "" } = useParams<{ taskId: string }>();
  const { tasks, tasksLoading, taskLoadError, refreshTasks } = useTaskCatalog();
  const { channels } = useChannelsWithAccounts();
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

  const [activitySpan, setActivitySpan] = useState<TaskActivitySpan | null>(null);
  const [tickStatus, setTickStatus] = useState<ProjectTickStatus | null>(null);
  const [spanLoading, setSpanLoading] = useState(false);

  const loadSideData = useCallback(async (id: string) => {
    setEventsLoading(true);
    setSpanLoading(true);
    setEventsError(null);
    try {
      const [ownedEvents, spans, status] = await Promise.all([
        listUserEvents({ taskId: id }),
        fetchTaskActivitySpans(),
        fetchProjectTickStatus(id, { limit: 20 }),
      ]);
      setEvents(ownedEvents);
      setActivitySpan(findActivitySpan(spans, id));
      setTickStatus(status);
    } catch (err) {
      setEventsError(toErrorMessage(err));
      setEvents([]);
      setActivitySpan(null);
      setTickStatus(null);
    } finally {
      setEventsLoading(false);
      setSpanLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!taskId) return;
    void loadSideData(taskId);
  }, [taskId, loadSideData]);

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
      void loadSideData(taskId).catch((error) => {
        logWarn("[projectDetail] side-data refresh after resource_modified failed", error);
      });
    });
  }, [taskId, refreshTasks, loadSideData]);

  const reload = useCallback(async () => {
    await Promise.all([
      refreshTasks().catch((error) => {
        logWarn("[projectDetail] manual catalog reload failed", error);
      }),
      taskId ? loadSideData(taskId) : Promise.resolve(),
    ]);
  }, [refreshTasks, loadSideData, taskId]);

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
    channelLabels,
    events,
    eventsLoading,
    eventsError,
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
    reloadSideData: () => (taskId ? loadSideData(taskId) : Promise.resolve()),
    goBack,
    goEdit,
    goEditChild,
    goTimeline,
  };
}
