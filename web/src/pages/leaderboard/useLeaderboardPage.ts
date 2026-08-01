import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchTopicMessages, fetchTrendingTopics } from "../../api/results";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { useChannelsWithAccounts } from "../../hooks/useChannelsWithAccounts";
import { usePersistedState } from "../../hooks/usePersistedState";
import { useRefreshOnAnalysisEvent } from "../../hooks/useRefreshOnAnalysisEvent";
import i18n from "../../i18n";
import { getDateTimeLocale } from "../../i18n/locale";
import type { Message, TrendingTopic } from "../../types";
import { logWarn } from "../../utils/logger";
import {
  LEADERBOARD_EXPANDED_TOPIC_ID_STORAGE_KEY,
  LEADERBOARD_SELECTED_TASK_ID_STORAGE_KEY,
} from "../../domain/prefs";

const EMPTY_TOPICS: TrendingTopic[] = [];

export function useLeaderboardPage() {
  const { tasks, taskLoadError, tasksLoading } = useTaskCatalog();
  const [expandedTopicIdRaw, setExpandedTopicIdRaw] = usePersistedState<string>(
    LEADERBOARD_EXPANDED_TOPIC_ID_STORAGE_KEY,
    "",
  );
  const expandedTopicId = expandedTopicIdRaw || null;
  const setExpandedTopicId = useCallback(
    (next: string | null | ((prev: string | null) => string | null)) => {
      setExpandedTopicIdRaw((prevRaw) => {
        const prev = prevRaw || null;
        const resolved = typeof next === "function" ? next(prev) : next;
        return resolved ?? "";
      });
    },
    [setExpandedTopicIdRaw],
  );
  const [topicMessages, setTopicMessages] = useState<Record<string, Message[]>>(
    {},
  );
  const [topicMessageErrors, setTopicMessageErrors] = useState<
    Record<string, string>
  >({});
  const [loadingTopicId, setLoadingTopicId] = useState<string | null>(null);
  const topicMessagesRef = useRef(topicMessages);
  useEffect(() => {
    topicMessagesRef.current = topicMessages;
  }, [topicMessages]);
  const { channels } = useChannelsWithAccounts();
  const [selectedTaskId, setSelectedTaskId] = usePersistedState<string>(
    LEADERBOARD_SELECTED_TASK_ID_STORAGE_KEY,
    "",
  );
  const leaderboardTasks = useMemo(
    () =>
      tasks.filter(
        (task) => task.analysisMode === "leaderboard",
      ),
    [tasks],
  );
  const selectedTask = leaderboardTasks.find(
    (task) => task.id === selectedTaskId,
  );

  const taskPlatformMap = useMemo(() => {
    const map = new Map<string, string[]>();
    const channelPlatformMap = new Map<string, string>();
    for (const ch of channels) {
      channelPlatformMap.set(ch.id, ch.platform);
    }
    for (const task of tasks) {
      const platforms = new Set<string>();
      for (const chId of task.channelIds ?? []) {
        const p = channelPlatformMap.get(chId.id);
        if (p) platforms.add(p);
      }
      if (platforms.size > 0) {
        map.set(task.id, Array.from(platforms));
      }
    }
    return map;
  }, [tasks, channels]);

  const fetcher = useCallback(
    (taskId: string | undefined) => fetchTrendingTopics(taskId),
    [],
  );
  const {
    data,
    initialLoading,
    isRefreshing,
    error,
    execute: fetchTopics,
  } = useAsyncResource(fetcher, { toastOnError: false });

  const topicMessagesFetcher = useCallback(
    (topicId: string) => fetchTopicMessages(topicId),
    [],
  );
  const {
    loading: topicMessagesLoading,
    error: topicMessagesError,
    execute: loadTopicMessages,
  } = useAsyncResource(topicMessagesFetcher, { toastOnError: false });

  useEffect(() => {
    if (tasksLoading) {
      return;
    }
    if (
      selectedTaskId &&
      !leaderboardTasks.some((task) => task.id === selectedTaskId)
    ) {
      setSelectedTaskId("");
    }
  }, [leaderboardTasks, selectedTaskId, setSelectedTaskId, tasksLoading]);

  useEffect(() => {
    void fetchTopics(selectedTaskId || undefined);
  }, [fetchTopics, selectedTaskId]);

  const refreshTopics = useCallback(
    async () => {
      await fetchTopics(selectedTaskId || undefined);
    },
    [fetchTopics, selectedTaskId],
  );

  useRefreshOnAnalysisEvent(refreshTopics, {
    taskId: selectedTaskId || null,
    analysisMode: "leaderboard",
  });

  // Persist per-topic error / empty cache when the active topic-messages fetch fails.
  useEffect(() => {
    if (!loadingTopicId || topicMessagesLoading || !topicMessagesError) return;
    logWarn("[leaderboard] failed to load topic messages", topicMessagesError);
    setTopicMessageErrors((prev) => ({
      ...prev,
      [loadingTopicId]: topicMessagesError,
    }));
    setTopicMessages((prev) =>
      prev[loadingTopicId] !== undefined
        ? prev
        : { ...prev, [loadingTopicId]: [] },
    );
    setLoadingTopicId(null);
  }, [loadingTopicId, topicMessagesError, topicMessagesLoading]);

  const resetTaskFilter = useCallback(() => {
    setSelectedTaskId("");
  }, [setSelectedTaskId]);

  const handleToggleTopic = useCallback(
    async (topicId: string) => {
      setExpandedTopicId((prev) => (prev === topicId ? null : topicId));

      if (!topicMessagesRef.current[topicId]) {
        setLoadingTopicId(topicId);
        setTopicMessageErrors((prev) => {
          if (!prev[topicId]) return prev;
          const next = { ...prev };
          delete next[topicId];
          return next;
        });
        const msgs = await loadTopicMessages(topicId);
        if (msgs) {
          setTopicMessages((prev) => ({ ...prev, [topicId]: msgs }));
          setLoadingTopicId((current) => (current === topicId ? null : current));
        }
        // Error path: effect above caches [] + error and clears loadingTopicId.
      }
    },
    [loadTopicMessages, setExpandedTopicId, setLoadingTopicId, setTopicMessageErrors, setTopicMessages],
  );

  const loadingMessages = useMemo(
    () =>
      loadingTopicId && topicMessagesLoading
        ? { [loadingTopicId]: true }
        : {},
    [loadingTopicId, topicMessagesLoading],
  );

  const topics = data ?? EMPTY_TOPICS;

  const groupedBoards = useMemo(() => {
    const taskNameMap = new Map(
      leaderboardTasks.map((task) => [task.id, task.name] as const),
    );
    const groups = new Map<
      string,
      {
        taskId: string;
        taskName: string;
        topics: typeof topics;
      }
    >();

    for (const topic of topics) {
      const taskId = topic.taskId ?? "unknown";
      const taskName =
        (topic.taskId ? taskNameMap.get(topic.taskId) : null) ??
        topic.taskName ??
        String(i18n.t("leaderboard.unnamed"));
      const existing = groups.get(taskId);
      if (existing) {
        existing.topics.push(topic);
        continue;
      }
      groups.set(taskId, {
        taskId,
        taskName,
        topics: [topic],
      });
    }

    // Ranked topics first (1..N), unranked (null) after, matching the server order.
    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        topics: [...group.topics].sort(
          (a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER),
        ),
      }))
      .sort((a, b) => a.taskName.localeCompare(b.taskName, getDateTimeLocale()));
  }, [topics, leaderboardTasks]);

  return {
    topics,
    initialLoading,
    isRefreshing,
    pageError: error ?? taskLoadError,
    expandedTopicId,
    topicMessages,
    loadingMessages,
    topicMessageErrors,
    selectedTaskId,
    setSelectedTaskId,
    leaderboardTasks,
    selectedTask,
    resetTaskFilter,
    handleToggleTopic,
    refreshTopics,
    taskPlatformMap,
    groupedBoards,
  };
}
