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

const EMPTY_SUBSCRIBE_CALENDARS: readonly { key: string; cover?: string | null }[] = [];

type Args = {
  enabled: boolean;
  selectedSources: SourceFilterSelection;
  selectedSubscribeKeys: SubscribedCalendarSelection;
  subscribeCatalogKeys: readonly string[];
  /** Catalog rows with `cover` (DemoPub/Open etc.); omitted → empty cover. */
  subscribeCalendars?: readonly { key: string; cover?: string | null }[];
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
  subscribeCalendars = EMPTY_SUBSCRIBE_CALENDARS,
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
    const worksetCoverById = new Map(
      worksets.map((row) => [row.id, (row.cover ?? "").trim()]),
    );
    const subscribeCoverByKey = new Map(
      subscribeCalendars.map((row) => [row.key, (row.cover ?? "").trim()]),
    );
    return buildMonthCardModels({
      cards: list.cards,
      events,
      selectedSources,
      tasks: taskRows,
      worksetTitle: (worksetId) =>
        worksetId === SYSTEM_WORKSET_ID
          ? generalWorksetLabel
          : worksetNameById.get(worksetId) ?? worksetId,
      coverFor: (card) =>
        card.kind === "workset"
          ? (worksetCoverById.get(card.worksetId) ?? "")
          : (subscribeCoverByKey.get(card.key) ?? ""),
    });
  }, [
    enabled,
    list.cards,
    events,
    selectedSources,
    taskRows,
    generalWorksetLabel,
    worksetNameById,
    worksets,
    subscribeCalendars,
  ]);

  return { models, omitted: list.omitted, emptyReason: list.emptyReason };
}
