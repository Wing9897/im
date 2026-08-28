/**
 * Right-sidebar event-card affiliation + generation provenance labels.
 *
 * Local rows surface workset ownership and provenance; subscribed rows use a
 * single calendar affiliation line (path + optional catalog description).
 */

import {
  lookupSubscribedCalendarDescription,
  type SubscribeDescriptionByKey,
  type SubscribeOwnerAvatarByHandle,
} from "../calendarShare/subscribedCatalogLookups";
import {
  isSubscribedTimelineSource,
  parseSubscribedTimelineSource,
} from "../calendarShare/subscribedCalendars";
import type { TimelineItem } from "../../types";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import {
  getGeneralWorksetLabel,
  isNullProvenanceTaskId,
  toUserEventFormWorksetId,
  type WorksetNameLookup,
} from "./userEvents";

export type EventListCardMetaLookups = {
  /** Localized builtin「一般」label. */
  generalWorksetLabel?: string;
  /** Catalog workset id → display name. */
  worksetNameById?: WorksetNameLookup;
  /** Catalog task id → ownership workset id. */
  taskWorksetById?: ReadonlyMap<string, string>;
  /** Subscribed calendar publisher handle → catalog owner avatar. */
  subscribeOwnerAvatarByHandle?: SubscribeOwnerAvatarByHandle;
  /** Subscribed calendar `handle/slug` → catalog description. */
  subscribeDescriptionByKey?: SubscribeDescriptionByKey;
};

function lookupWorksetName(
  worksetId: string,
  lookups: EventListCardMetaLookups,
): string {
  const general = lookups.generalWorksetLabel ?? getGeneralWorksetLabel();
  if (worksetId === SYSTEM_WORKSET_ID) return general;
  if (!lookups.worksetNameById) return worksetId;
  if (lookups.worksetNameById instanceof Map) {
    const named: unknown = (lookups.worksetNameById as ReadonlyMap<string, string>).get(
      worksetId,
    );
    return typeof named === "string" ? named : worksetId;
  }
  const named: unknown = (lookups.worksetNameById as Readonly<Record<string, string>>)[
    worksetId
  ];
  return typeof named === "string" ? named : worksetId;
}

/**
 * Ownership workset display name for a sidebar card.
 * Falls back to「一般」when ownership is missing (product default).
 */
export function resolveEventListWorksetName(
  event: TimelineItem,
  lookups: EventListCardMetaLookups = {},
): string {
  if (isSubscribedTimelineSource(event.source)) {
    return "";
  }

  const general = lookups.generalWorksetLabel ?? getGeneralWorksetLabel();

  const direct = typeof event.worksetId === "string" ? event.worksetId.trim() : "";
  if (direct) {
    return lookupWorksetName(toUserEventFormWorksetId(direct), lookups);
  }

  if (!isNullProvenanceTaskId(event.taskId) && lookups.taskWorksetById) {
    const viaTask = lookups.taskWorksetById.get(String(event.taskId));
    if (viaTask?.trim()) {
      return lookupWorksetName(toUserEventFormWorksetId(viaTask), lookups);
    }
  }

  // User rows without task provenance historically stash the workset name in taskName.
  if (
    event.source === "user" &&
    isNullProvenanceTaskId(event.taskId) &&
    event.taskName?.trim()
  ) {
    return event.taskName.trim();
  }

  return general;
}

export type EventListProvenanceKind =
  | "task"
  | "user"
  | "assistant"
  | "item"
  | "ics"
  | "a2a"
  | "agent"
  | "subscribed";

/**
 * Generation source for the card footer (任務 / 用戶 / 助手 / 物品 / …).
 * Distinct from ownership workset.
 */
export function resolveEventListProvenanceKind(
  event: TimelineItem,
): EventListProvenanceKind {
  if (isSubscribedTimelineSource(event.source)) {
    return "subscribed";
  }
  if (event.source === "item_remind") return "item";
  if (event.source === "user") {
    switch (event.origin) {
      case "assistant":
        return "assistant";
      case "ics":
        return "ics";
      case "a2a":
        return "a2a";
      case "agent":
        return "agent";
      case "manual":
      default:
        return "user";
    }
  }
  // analysis / recurring / legacy → 任務
  return "task";
}

/** Optional task display name when provenance is「任務」. */
export function resolveEventListTaskName(event: TimelineItem): string | null {
  if (resolveEventListProvenanceKind(event) !== "task") return null;
  const name = event.taskName?.trim();
  return name || null;
}

/** `handle/slug` path for subscribed timeline rows. */
export function resolveSubscribedCalendarPath(event: TimelineItem): string | null {
  return parseSubscribedTimelineSource(event.source);
}

/** Subscribed rows use calendar affiliation instead of local workset ownership. */
export function eventListShowsWorksetAffiliation(event: TimelineItem): boolean {
  return !isSubscribedTimelineSource(event.source);
}

/** Subscribed rows merge affiliation into the calendar line — no separate provenance. */
export function eventListShowsProvenance(event: TimelineItem): boolean {
  return !isSubscribedTimelineSource(event.source);
}

/** Optional catalog description subtitle for subscribed cards. */
export function resolveSubscribedCalendarDescription(
  event: TimelineItem,
  lookups: EventListCardMetaLookups = {},
): string {
  return lookupSubscribedCalendarDescription(event, lookups.subscribeDescriptionByKey);
}

/**
 * Footer / detail affiliation: workset ownership for local rows,
 * calendar path for subscribed rows.
 */
export function formatEventListAffiliationLabel(
  event: TimelineItem,
  t: (key: string, opts?: Record<string, string>) => string,
  lookups: EventListCardMetaLookups = {},
): string {
  const path = resolveSubscribedCalendarPath(event);
  if (path) {
    return t("eventList.affiliation.calendar", { path });
  }
  return t("sidebar.workset", {
    value: resolveEventListWorksetName(event, lookups),
  });
}

/**
 * Footer / detail「生成来源」label (任務／用戶／助手／物品／…).
 * Task provenance with a name uses `sidebar.task` (`任務：{name}`).
 */
export function formatEventListProvenanceLabel(
  event: TimelineItem,
  t: (key: string, opts?: Record<string, string>) => string,
): string {
  const kind = resolveEventListProvenanceKind(event);
  if (kind === "subscribed") {
    const path = parseSubscribedTimelineSource(event.source) ?? event.taskName ?? "";
    return t("eventList.provenance.subscribed", { path });
  }
  if (kind === "task") {
    const taskName = resolveEventListTaskName(event);
    return taskName
      ? t("sidebar.task", { value: taskName })
      : t("eventList.provenance.task");
  }
  return t(`eventList.provenance.${kind}`);
}

/**
 * Local dismiss is for owned timeline rows. Subscribed calendars are shown
 * or hidden via the source filter — the card must not offer「從時間軸拿掉」.
 */
export function eventListAllowsDismiss(
  event: Pick<TimelineItem, "source">,
): boolean {
  return !isSubscribedTimelineSource(event.source);
}
