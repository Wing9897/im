import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { listChannelsWithSources } from "../../api/channels";
import { listItems } from "../../api/items";
import { listSources } from "../../api/sources";
import { listUserEventsPage, type UserEvent } from "../../api/userEvents";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import type {
  PipelineChannelSourceInput,
  PipelineEventInput,
  PipelineGraphLabels,
  PipelineItemInput,
  PipelineSourceInput,
  PipelineTaskInput,
} from "../../domain/worksets/worksetPipelineGraph";

export type WorksetPipelineGraphData = {
  worksets: {
    id: string;
    name: string;
    notifyEnabled?: boolean | null;
    externalEnabled?: boolean | null;
  }[];
  tasks: PipelineTaskInput[];
  items: PipelineItemInput[];
  sources: PipelineSourceInput[];
  channels: PipelineChannelSourceInput[];
  events: PipelineEventInput[];
  labels: PipelineGraphLabels;
  reload: () => void;
};

/** Household graph inputs: catalog entities plus items / sources / calendar. */
export function useWorksetPipelineGraphData(): WorksetPipelineGraphData {
  const { t } = useTranslation("workset");
  const { worksets, tasks } = useTaskCatalog();
  const [items, setItems] = useState<PipelineItemInput[]>([]);
  const [sources, setSources] = useState<PipelineSourceInput[]>([]);
  const [channels, setChannels] = useState<PipelineChannelSourceInput[]>([]);
  const [events, setEvents] = useState<PipelineEventInput[]>([]);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listItems(), listSources(), listUserEventsPage(), listChannelsWithSources()])
      .then(([itemRows, sourceRows, eventPage, channelRows]) => {
        if (cancelled) return;
        setItems(
          itemRows.map((row) => ({
            id: row.id,
            title: row.title,
            worksetId: row.worksetId || SYSTEM_WORKSET_ID,
            status: row.status,
          })),
        );
        setSources(sourceRows.map((row) => ({ id: row.id, name: row.name })));
        setChannels(
          channelRows
            .filter((row) => Boolean(row.sourceId))
            .map((row) => ({
              channelId: row.id,
              sourceId: row.sourceId as string,
            })),
        );
        const rows: UserEvent[] = eventPage.items ?? [];
        setEvents(
          rows.map((row) => ({
            id: row.id,
            title: row.title,
            worksetId: row.worksetId || SYSTEM_WORKSET_ID,
            itemId: row.itemId ?? null,
            kind: row.kind ?? null,
            notifyPref: row.notifyPref ?? null,
          })),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setSources([]);
        setChannels([]);
        setEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const pipelineTasks = useMemo<PipelineTaskInput[]>(
    () =>
      tasks.map((task) => ({
        id: task.id,
        name: task.name,
        promptTemplate: task.promptTemplate,
        analysisMode: task.analysisMode,
        worksetId: task.worksetId || SYSTEM_WORKSET_ID,
        outputAnalysisEvents: task.outputAnalysisEvents,
        includeInTimeline: task.includeInTimeline,
        outputCalendar: task.outputCalendar,
        notifyPref: task.notifyPref,
        channelIds: task.channelIds,
      })),
    [tasks],
  );

  const labels = useMemo<PipelineGraphLabels>(
    () => ({
      generalName: t("generalName"),
      unassigned: t("generalName"),
      more: (count) => t("graphMore", { count }),
      calendar: t("graphBlockCalendar"),
      calendarPage: t("graphCalendarPage"),
      intel: t("graphBlockIntel"),
      timeline: t("graphBlockTimeline"),
      notify: t("graphBlockNotify"),
      mcp: t("graphBlockMcp"),
      a2a: t("graphBlockA2a"),
      assistant: t("graphBlockAssistant"),
    }),
    [t],
  );

  return {
    worksets,
    tasks: pipelineTasks,
    items,
    sources,
    channels,
    events,
    labels,
    reload,
  };
}
