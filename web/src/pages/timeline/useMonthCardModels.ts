import { useMemo } from "react";

import type { SubscribedCalendarSelection } from "../../domain/calendarShare/subscribedCalendars";
import type { SourceFilterSelection } from "../../domain/tasks/sourceFilterSelection";
import {
  buildMonthCardModels,
  resolveMonthCardSources,
  type MonthCardEmptyReason,
  type MonthCardModel,
} from "../../domain/timeline/monthCardSources";
import { useGeneralWorksetLabel } from "../../domain/timeline/useGeneralWorksetLabel";
import { useTaskCatalog, useWorksetNameById } from "../../context/TaskCatalogContext";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import type { TimelineItem } from "../../types";

type Args = {
  enabled: boolean;
  selectedSources: SourceFilterSelection;
  selectedSubscribeKeys: SubscribedCalendarSelection;
  subscribeCatalogKeys: readonly string[];
  tasks: readonly { id: string; worksetId?: string | null }[];
  events: readonly TimelineItem[];
};

/**
 * Card list + event slices for split month. Catalog title lookups stay here
 * so the page container does not own month-card presentation.
 */
export function useMonthCardModels({
  enabled,
  selectedSources,
  selectedSubscribeKeys,
  subscribeCatalogKeys,
  tasks,
  events,
}: Args): { models: MonthCardModel[]; omitted: number; emptyReason: MonthCardEmptyReason | null } {
  const { worksets, tasks: catalogTasks } = useTaskCatalog();
  const worksetNameById = useWorksetNameById();
  const generalWorksetLabel = useGeneralWorksetLabel();
  const taskRows = catalogTasks.length > 0 ? catalogTasks : tasks;

  const list = useMemo(() => {
    if (!enabled) return { cards: [], omitted: 0, emptyReason: null };
    return resolveMonthCardSources({
      selectedSources,
      worksets,
      tasks: taskRows,
      selectedSubscribeKeys,
      subscribeCatalogKeys,
    });
  }, [enabled, selectedSources, worksets, taskRows, selectedSubscribeKeys, subscribeCatalogKeys]);

  const models = useMemo(() => {
    if (!enabled) return [];
    return buildMonthCardModels({
      cards: list.cards,
      events,
      selectedSources,
      tasks: taskRows,
      worksetTitle: (worksetId) =>
        worksetId === SYSTEM_WORKSET_ID
          ? generalWorksetLabel
          : worksetNameById.get(worksetId) ?? worksetId,
    });
  }, [
    enabled,
    list.cards,
    events,
    selectedSources,
    taskRows,
    generalWorksetLabel,
    worksetNameById,
  ]);

  return { models, omitted: list.omitted, emptyReason: list.emptyReason };
}
