/**
 * Month-cards (split month layout): one card per workset or subscribe slug.
 * Axis is source, not consecutive months. Tasks never become cards.
 * A `null` filter (dialog “select all”) expands to catalog ids only when the
 * merged card count stays ≤ 12; otherwise the side stays empty (anti-lag).
 */

import {
  parseSubscribedTimelineSource,
  type SubscribedCalendarSelection,
} from "../calendarShare/subscribedCalendars";
import {
  type SourceFilterSelection,
  type WorksetMemberTask,
} from "../tasks/sourceFilterSelection";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import type { TimelineItem } from "../../types";
import type { TimelineScale } from "./dateUtils";

export const MONTH_CARD_SOFT_CAP = 12;

/** Split-card day cells: at most this many event dots (no +N overflow text). */
export const SPLIT_MONTH_DOT_LIMIT = 3;

export type TimelineMonthLayout = "unified" | "split";

/** Calendar toolbar pills: existing scales plus month-cards (not a TimelineScale). */
export type CalendarScalePill = TimelineScale | "cards";

type CalendarOrGantt = "calendar" | "gantt";

export function parseTimelineMonthLayout(raw: unknown): TimelineMonthLayout {
  return raw === "split" ? "split" : "unified";
}

export function isMonthCardsMode(
  viewMode: CalendarOrGantt,
  timeScale: TimelineScale,
  monthLayout: TimelineMonthLayout,
): boolean {
  return viewMode === "calendar" && timeScale === "month" && monthLayout === "split";
}

/** Unified month dual-number watermark only — Block/split cards do not use it. */
export function showMonthDatesRevealChrome(
  viewMode: CalendarOrGantt,
  timeScale: TimelineScale,
  monthLayout: TimelineMonthLayout,
): boolean {
  return viewMode === "calendar" && timeScale === "month" && monthLayout === "unified";
}

export function calendarScalePills(viewMode: CalendarOrGantt): readonly CalendarScalePill[] {
  return viewMode === "gantt"
    ? (["day", "week", "month", "quarter", "year"] as const)
    : (["day", "week", "month", "cards"] as const);
}

export function isCalendarScalePillActive(
  pill: CalendarScalePill,
  input: {
    viewMode: CalendarOrGantt;
    timeScale: TimelineScale;
    monthLayout: TimelineMonthLayout;
  },
): boolean {
  if (pill === "cards") {
    return isMonthCardsMode(input.viewMode, input.timeScale, input.monthLayout);
  }
  if (pill === "month" && input.viewMode === "calendar") {
    return input.timeScale === "month" && input.monthLayout !== "split";
  }
  return input.timeScale === pill;
}

/** Scale + optional layout for a toolbar pill. Gantt month does not touch layout. */
export function applyCalendarScalePill(
  pill: CalendarScalePill,
  viewMode: CalendarOrGantt,
): { timeScale: TimelineScale; monthLayout?: TimelineMonthLayout } {
  if (pill === "cards") return { timeScale: "month", monthLayout: "split" };
  if (pill === "month" && viewMode === "calendar") {
    return { timeScale: "month", monthLayout: "unified" };
  }
  return { timeScale: pill };
}

export type MonthCardSource =
  | { kind: "workset"; worksetId: string }
  | { kind: "subscribe"; key: string };

export type MonthCardEmptyReason = "select_all" | "need_selection";

export type MonthCardListResult = {
  cards: MonthCardSource[];
  omitted: number;
  emptyReason: MonthCardEmptyReason | null;
};

type MonthCardCatalogs = {
  worksets?: readonly { id: string }[];
  tasks?: readonly WorksetMemberTask[];
  subscribeCatalogKeys?: readonly string[];
};

export function monthCardKey(card: MonthCardSource): string {
  return card.kind === "workset" ? `workset:${card.worksetId}` : `subscribe:${card.key}`;
}

/**
 * Both filters mean "all". Skip the whole library only when expanding that
 * catalog would exceed the soft cap (anti-lag). A small catalog may expand.
 */
export function isMonthCardsLibrarySkip(
  selectedSources: SourceFilterSelection,
  selectedSubscribeKeys: SubscribedCalendarSelection,
  catalogs: MonthCardCatalogs = {},
): boolean {
  if (selectedSources !== null || selectedSubscribeKeys !== null) return false;
  return (
    resolveMonthCardSources({
      selectedSources,
      selectedSubscribeKeys,
      worksets: catalogs.worksets,
      tasks: catalogs.tasks,
      subscribeCatalogKeys: catalogs.subscribeCatalogKeys,
    }).cards.length === 0
  );
}

/**
 * Per-side fetch gates for split month. A `null` side is fetched only when
 * {@link resolveMonthCardSources} expanded it (merged count ≤ 12).
 * Unified month still fetches as before (`monthCardsMode=false`).
 */
export function monthCardsFetchSkip(
  monthCardsMode: boolean,
  selectedSources: SourceFilterSelection,
  selectedSubscribeKeys: SubscribedCalendarSelection,
  catalogs: MonthCardCatalogs = {},
): { skipLocal: boolean; skipSubscribe: boolean } {
  if (!monthCardsMode) return { skipLocal: false, skipSubscribe: false };
  const { cards } = resolveMonthCardSources({
    selectedSources,
    selectedSubscribeKeys,
    worksets: catalogs.worksets,
    tasks: catalogs.tasks,
    subscribeCatalogKeys: catalogs.subscribeCatalogKeys,
  });
  return {
    skipLocal: !cards.some((card) => card.kind === "workset"),
    skipSubscribe: !cards.some((card) => card.kind === "subscribe"),
  };
}

function worksetIdForTask(task: WorksetMemberTask): string {
  const raw = typeof task.worksetId === "string" ? task.worksetId.trim() : "";
  return raw || SYSTEM_WORKSET_ID;
}

function allowedWorksetIds(worksets: readonly { id: string }[]): Set<string> | null {
  if (worksets.length === 0) return null;
  return new Set(worksets.map((row) => row.id));
}

function collectWorksetCards(
  selectedSources: SourceFilterSelection,
  worksets: readonly { id: string }[],
  tasks: readonly WorksetMemberTask[],
): MonthCardSource[] {
  if (selectedSources === null) return [];
  const allowed = allowedWorksetIds(worksets);
  const seen = new Set<string>();
  const cards: MonthCardSource[] = [];

  const push = (worksetId: string) => {
    if (!worksetId || seen.has(worksetId)) return;
    if (allowed && !allowed.has(worksetId)) return;
    seen.add(worksetId);
    cards.push({ kind: "workset", worksetId });
  };

  for (const worksetId of selectedSources.worksetIds) {
    push(worksetId);
  }

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  for (const taskId of selectedSources.taskIds) {
    const task = taskById.get(taskId);
    if (!task) continue;
    push(worksetIdForTask(task));
  }

  return cards;
}

function collectSubscribeCards(
  selectedSubscribeKeys: SubscribedCalendarSelection,
  subscribeCatalogKeys: readonly string[],
): MonthCardSource[] {
  if (selectedSubscribeKeys === null) return [];
  const allowed = new Set(subscribeCatalogKeys);
  const cards: MonthCardSource[] = [];
  const seen = new Set<string>();
  for (const key of selectedSubscribeKeys) {
    const trimmed = key.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    if (subscribeCatalogKeys.length > 0 && !allowed.has(trimmed)) continue;
    seen.add(trimmed);
    cards.push({ kind: "subscribe", key: trimmed });
  }
  return cards;
}

function catalogWorksetCards(worksets: readonly { id: string }[]): MonthCardSource[] {
  const seen = new Set<string>();
  const cards: MonthCardSource[] = [];
  for (const row of worksets) {
    const worksetId = row.id.trim();
    if (!worksetId || seen.has(worksetId)) continue;
    seen.add(worksetId);
    cards.push({ kind: "workset", worksetId });
  }
  return cards;
}

function catalogSubscribeCards(subscribeCatalogKeys: readonly string[]): MonthCardSource[] {
  const seen = new Set<string>();
  const cards: MonthCardSource[] = [];
  for (const key of subscribeCatalogKeys) {
    const trimmed = key.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    cards.push({ kind: "subscribe", key: trimmed });
  }
  return cards;
}

function capCards(cards: MonthCardSource[]): MonthCardListResult {
  if (cards.length <= MONTH_CARD_SOFT_CAP) {
    return {
      cards,
      omitted: 0,
      emptyReason: cards.length === 0 ? "need_selection" : null,
    };
  }
  return {
    cards: cards.slice(0, MONTH_CARD_SOFT_CAP),
    omitted: cards.length - MONTH_CARD_SOFT_CAP,
    emptyReason: null,
  };
}

export function resolveMonthCardSources(input: {
  selectedSources: SourceFilterSelection;
  worksets?: readonly { id: string }[];
  tasks?: readonly WorksetMemberTask[];
  selectedSubscribeKeys: SubscribedCalendarSelection;
  subscribeCatalogKeys?: readonly string[];
}): MonthCardListResult {
  const worksets = input.worksets ?? [];
  const tasks = input.tasks ?? [];
  const subscribeCatalogKeys = input.subscribeCatalogKeys ?? [];
  const localNull = input.selectedSources === null;
  const subscribeNull = input.selectedSubscribeKeys === null;

  const localCards = localNull
    ? catalogWorksetCards(worksets)
    : collectWorksetCards(input.selectedSources, worksets, tasks);
  const subscribeCards = subscribeNull
    ? catalogSubscribeCards(subscribeCatalogKeys)
    : collectSubscribeCards(input.selectedSubscribeKeys, subscribeCatalogKeys);

  const merged = [...localCards, ...subscribeCards];
  const expandedANullSide = localNull || subscribeNull;

  if (merged.length > MONTH_CARD_SOFT_CAP && expandedANullSide) {
    const kept = [
      ...(localNull ? [] : localCards),
      ...(subscribeNull ? [] : subscribeCards),
    ];
    if (kept.length === 0) {
      return { cards: [], omitted: 0, emptyReason: "select_all" };
    }
    return capCards(kept);
  }

  return capCards(merged);
}

function taskWorksetIndex(
  tasks: readonly WorksetMemberTask[],
): ReadonlyMap<string, string> {
  return new Map(tasks.map((task) => [task.id, worksetIdForTask(task)]));
}

function eventOwnershipWorksetId(
  event: TimelineItem,
  taskWorksetById: ReadonlyMap<string, string>,
): string {
  const raw = typeof event.worksetId === "string" ? event.worksetId.trim() : "";
  if (raw) return raw;
  const taskId = typeof event.taskId === "string" ? event.taskId.trim() : "";
  if (taskId && taskWorksetById.has(taskId)) {
    return taskWorksetById.get(taskId) ?? SYSTEM_WORKSET_ID;
  }
  return SYSTEM_WORKSET_ID;
}

/**
 * Client-side partition of one window fetch. Subscribed rows never land on a
 * workset card; local rows never land on a subscribe card.
 */
export function sliceEventsForMonthCard(
  events: readonly TimelineItem[],
  card: MonthCardSource,
  selectedSources: SourceFilterSelection,
  tasks: readonly WorksetMemberTask[] = [],
): TimelineItem[] {
  if (card.kind === "subscribe") {
    return events.filter((event) => parseSubscribedTimelineSource(event.source) === card.key);
  }

  const taskWorksetById = taskWorksetIndex(tasks);
  const worksetFullySelected =
    selectedSources === null || selectedSources.worksetIds.includes(card.worksetId);
  const explicitTaskIds = new Set(selectedSources?.taskIds ?? []);

  return events.filter((event) => {
    if (parseSubscribedTimelineSource(event.source)) return false;
    if (eventOwnershipWorksetId(event, taskWorksetById) !== card.worksetId) return false;
    if (worksetFullySelected) return true;
    const taskId = typeof event.taskId === "string" ? event.taskId.trim() : "";
    return Boolean(taskId) && explicitTaskIds.has(taskId);
  });
}

export type MonthCardModel = MonthCardSource & {
  title: string;
  events: TimelineItem[];
};

export function buildMonthCardModels(input: {
  cards: readonly MonthCardSource[];
  events: readonly TimelineItem[];
  selectedSources: SourceFilterSelection;
  tasks?: readonly WorksetMemberTask[];
  worksetTitle: (worksetId: string) => string;
}): MonthCardModel[] {
  return input.cards.map((card) => ({
    ...card,
    title:
      card.kind === "workset" ? input.worksetTitle(card.worksetId) : card.key,
    events: sliceEventsForMonthCard(
      input.events,
      card,
      input.selectedSources,
      input.tasks,
    ),
  }));
}
