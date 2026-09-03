/**
 * Loads project meta, child recurring, owned user_events, and last-tick summary.
 *
 * Child recurring series are loaded via ``/calendar/recurring?parentTaskId=``;
 * the shared task catalog is analysis-only.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { listRecurringSeries } from "../../../api/recurringSeries";
import { listUserEventsPage, type UserEvent } from "../../../api/userEvents";
import { fetchAgentTickStatus, fetchTaskActivitySpans } from "../../../api/tasks";
import { buildChannelNameById, resolveChannelLabel } from "../../../components/detail";
import { isTaskActivelyAnalyzing } from "../../../domain/analysis/analysisStatusModel";
import { useAnalysisStatus } from "../../../context/AnalysisStatusContext";
import { useTaskCatalog } from "../../../context/TaskCatalogContext";
import { pickLatestBatchAttention } from "../../../domain/analysis/batchAttention";
import { subscribeResourceModified } from "../../../domain/sse/resourceModified";
import { useChannelsWithSources } from "../../../hooks/useChannelsWithSources";
import { logWarn } from "../../../utils/logger";
import type { AgentTickStatus, TaskActivitySpan } from "../../../types/analysis";
import type { RecurringSeries } from "../../../types/recurring";
import {
  findActivitySpan,
  isAgentCalendarTask,
} from "../../../domain/tasks/agentTaskSelectors";

export function useAgentDetail() {
  const navigate = useNavigate();
  const { taskId = "" } = useParams<{ taskId: string }>();
  const { tasks, tasksLoading, taskLoadError, refreshTasks } = useTaskCatalog();
  const { channels } = useChannelsWithSources();
  const { activeAnalyses, queueStatus, analysisPaused } = useAnalysisStatus();

  const project = useMemo(
    () => tasks.find((task) => task.id === taskId) ?? null,
    [tasks, taskId],
  );

  const channelNameById = useMemo(() => buildChannelNameById(channels), [channels]);

  const channelLabels = useMemo(() => {
    if (!project) return [];
    return (project.channelIds ?? []).map((ref) => resolveChannelLabel(ref, channelNameById));
  }, [project, channelNameById]);

  const [events, setEvents] = useState<UserEvent[]>([]);
  const [children, setChildren] = useState<RecurringSeries[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [activitySpan, setActivitySpan] = useState<TaskActivitySpan | null>(null);
  const [tickStatus, setTickStatus] = useState<AgentTickStatus | null>(null);
  const [spanLoading, setSpanLoading] = useState(false);

  const loadSideData = useCallback(async (id: string) => {
    setEventsLoading(true);
    setSpanLoading(true);
    setEventsError(null);
    try {
      const [ownedEvents, recurringPage, spans, status] = await Promise.all([
        listUserEventsPage({ taskId: id }).then((page) => page.items),
        listRecurringSeries({ parentTaskId: id }),
        fetchTaskActivitySpans(),
        fetchAgentTickStatus(id, { limit: 20 }),
      ]);
      setEvents(ownedEvents);
      setChildren(recurringPage.items);
      setActivitySpan(findActivitySpan(spans, id));
      setTickStatus(status);
    } catch (err) {
      setEventsError(err instanceof Error ? err.message : String(err));
      setEvents([]);
      setChildren([]);
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
      if (
        detail.resourceType !== "task" &&
        detail.resourceType !== "user_event" &&
        detail.resourceType !== "recurring"
      ) {
        return;
      }
      if (detail.resourceType === "task") {
        void refreshTasks().catch((error) => {
          logWarn("[agentDetail] catalog refresh after resource_modified failed", error);
        });
      }
      void loadSideData(taskId).catch((error) => {
        logWarn("[agentDetail] side-data refresh after resource_modified failed", error);
      });
    });
  }, [taskId, refreshTasks, loadSideData]);

  const reload = useCallback(async () => {
    await Promise.all([
      refreshTasks().catch((error) => {
        logWarn("[agentDetail] manual catalog reload failed", error);
      }),
      taskId ? loadSideData(taskId) : Promise.resolve(),
    ]);
  }, [refreshTasks, loadSideData, taskId]);

  const isRunning = useMemo(
    () => (taskId ? isTaskActivelyAnalyzing(activeAnalyses, taskId) : false),
    [activeAnalyses, taskId],
  );

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
    !tasksLoading && Boolean(taskId) && (!project || !isAgentCalendarTask(project));

  const goBack = useCallback(() => {
    navigate("/tasks");
  }, [navigate]);

  const goEdit = useCallback(() => {
    if (!taskId) return;
    navigate(`/tasks/${taskId}/edit`);
  }, [navigate, taskId]);

  const goEditChild = useCallback(
    (child: RecurringSeries) => {
      navigate(`/schedule/recurring/${child.id}/edit`);
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
    reloadSideData: () =>
      taskId
        ? loadSideData(taskId)
        : Promise.resolve(),
    goBack,
    goEdit,
    goEditChild,
    goTimeline,
  };
}
