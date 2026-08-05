/**
 * Scan-step pure functions: fetch window, due detection, source filter, event adapters.
 */

import {
  isNullProvenanceTaskId,
  resolveUserEventTaskName,
  type TaskNameLookup,
  type WorksetNameLookup,
} from "../domain/timeline/userEvents";
import {
  expandWorksetIdsToTaskIds,
  isEmptySourceFilter,
  userEventMatchesSourceSelection,
  type SourceFilterSelection,
  type WorksetMemberTask,
} from "../domain/tasks/sourceFilterSelection";
import { SYSTEM_WORKSET_ID } from "../types/worksets";
import { buildDedupeKey } from "./scannerFiredLogic";
import { buildSpeakText } from "./scannerSpeak";
import {
  FETCH_BUFFER_MS,
  SCAN_GRACE_MS,
  SCAN_INTERVAL_MS,
  type DueReminder,
  type TimedKeyEvent,
  type TimedKeyEventKind,
} from "./scannerTypes";

export function getMaxLeadMinutes(leadOffsetsMinutes: readonly number[]): number {
  if (leadOffsetsMinutes.length === 0) {
    return 0;
  }
  return Math.max(...leadOffsetsMinutes);
}

/**
 * Filter timed events by hierarchical source selection (same model as
 * board/timeline). `null` selection means all sources.
 *
 * - `kind === "user"`: ownership via `userEventMatchesSourceSelection`
 *   (workset match only; explicit taskIds may match provenance; `__user__`
 *   fake taskId is null provenance — never via workset expansion).
 * - analysis / recurring: workset ownership or expanded member task ids.
 */
export function filterEventsBySourceFilter(
  events: readonly TimedKeyEvent[],
  selection: SourceFilterSelection,
  catalogTasks: readonly WorksetMemberTask[] = [],
): TimedKeyEvent[] {
  if (selection === null) {
    return [...events];
  }
  if (isEmptySourceFilter(selection)) {
    return [];
  }
  const allowExplicitTaskIds = new Set(selection.taskIds);
  const allowTasks = new Set<string>([
    ...selection.taskIds,
    ...expandWorksetIdsToTaskIds(selection.worksetIds, catalogTasks),
  ]);
  const allowWorksets = new Set(selection.worksetIds);
  return events.filter((event) => {
    if (event.kind === "user") {
      return userEventMatchesSourceSelection(event, allowWorksets, allowExplicitTaskIds);
    }
    if (event.worksetId && allowWorksets.has(event.worksetId)) return true;
    if (event.taskId != null && event.taskId !== "" && allowTasks.has(event.taskId)) {
      return true;
    }
    return false;
  });
}

/**
 * ISO date range for fetching timed events by event_time.
 * Includes a short look-back so grace can still catch a just-due remindAt.
 */
export function computeFetchRange(
  nowMs: number,
  maxLeadMinutes: number,
  bufferMs: number = FETCH_BUFFER_MS,
  lookBackMs: number = SCAN_GRACE_MS,
): { rangeStart: string; rangeEnd: string } {
  const rangeStart = new Date(nowMs - lookBackMs).toISOString();
  const rangeEnd = new Date(
    nowMs + Math.max(0, maxLeadMinutes) * 60_000 + bufferMs,
  ).toISOString();
  return { rangeStart, rangeEnd };
}

/**
 * True when remindAt falls in (now - interval - grace, now].
 */
export function isRemindAtDue(
  remindAtMs: number,
  nowMs: number,
  scanIntervalMs: number = SCAN_INTERVAL_MS,
  graceMs: number = SCAN_GRACE_MS,
): boolean {
  if (!Number.isFinite(remindAtMs)) {
    return false;
  }
  const windowStart = nowMs - scanIntervalMs - graceMs;
  return remindAtMs > windowStart && remindAtMs <= nowMs;
}

export function collectDueReminders(opts: {
  events: readonly TimedKeyEvent[];
  leadOffsetsMinutes: readonly number[];
  nowMs: number;
  firedKeys: ReadonlySet<string>;
  scanIntervalMs?: number;
  graceMs?: number;
}): DueReminder[] {
  const {
    events,
    leadOffsetsMinutes,
    nowMs,
    firedKeys,
    scanIntervalMs = SCAN_INTERVAL_MS,
    graceMs = SCAN_GRACE_MS,
  } = opts;

  if (leadOffsetsMinutes.length === 0) {
    return [];
  }

  const due: DueReminder[] = [];

  for (const event of events) {
    const startMs = Date.parse(event.startTime);
    if (!Number.isFinite(startMs)) {
      continue;
    }

    for (const lead of leadOffsetsMinutes) {
      if (!Number.isFinite(lead) || lead < 0) {
        continue;
      }
      const remindAtMs = startMs - lead * 60_000;
      if (!isRemindAtDue(remindAtMs, nowMs, scanIntervalMs, graceMs)) {
        continue;
      }
      const dedupeKey = buildDedupeKey(event.id, lead, event.startTime);
      if (firedKeys.has(dedupeKey)) {
        continue;
      }
      due.push({
        eventId: event.id,
        taskId: event.taskId,
        taskName: event.taskName,
        title: event.title,
        startTime: event.startTime,
        leadOffsetMinutes: lead,
        remindAtMs,
        dedupeKey,
        speakText: buildSpeakText(event.taskName, event.title, lead, event.kind),
      });
    }
  }

  due.sort((a, b) => a.remindAtMs - b.remindAtMs || a.dedupeKey.localeCompare(b.dedupeKey));
  return due;
}

/** Map analysis / timeline / calendar rows into TimedKeyEvent (drops rows without startTime). */
export function toTimedKeyEvents(
  rows: ReadonlyArray<{
    id: string;
    taskId?: string | null;
    worksetId?: string | null;
    taskName?: string | null;
    title: string;
    startTime?: string | null;
  }>,
  kind: TimedKeyEventKind = "event",
): TimedKeyEvent[] {
  const out: TimedKeyEvent[] = [];
  for (const row of rows) {
    if (!row.startTime) {
      continue;
    }
    out.push({
      id: row.id,
      taskId: row.taskId ?? null,
      worksetId: row.worksetId ?? null,
      taskName: row.taskName?.trim() || "",
      title: row.title,
      startTime: row.startTime,
      kind,
    });
  }
  return out;
}

/** Stable merge: first list wins on duplicate ids. */
export function mergeTimedKeyEventsById(
  ...lists: ReadonlyArray<readonly TimedKeyEvent[]>
): TimedKeyEvent[] {
  const out: TimedKeyEvent[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const event of list) {
      if (seen.has(event.id)) {
        continue;
      }
      seen.add(event.id);
      out.push(event);
    }
  }
  return out;
}

/**
 * Adapt user_events rows for reminder filtering (same ownership as timeline):
 * `taskId` = provenance only; `worksetId` = ownership (defaults to `__user__`).
 */
export function userEventsToTimedKeyEvents(
  rows: ReadonlyArray<{
    id: string;
    title: string;
    startTime: string;
    taskId?: string | null;
    worksetId?: string | null;
  }>,
  taskNameById?: TaskNameLookup,
  worksetNameById?: WorksetNameLookup,
): TimedKeyEvent[] {
  return toTimedKeyEvents(
    rows.map((row) => {
      const provenance = typeof row.taskId === "string" ? row.taskId.trim() : "";
      const worksetId = row.worksetId?.trim() || SYSTEM_WORKSET_ID;
      return {
        id: row.id,
        taskId: provenance && !isNullProvenanceTaskId(provenance) ? provenance : null,
        worksetId,
        taskName: resolveUserEventTaskName(
          row.taskId,
          taskNameById,
          undefined,
          worksetId,
          worksetNameById,
        ),
        title: row.title,
        startTime: row.startTime,
      };
    }),
    "user",
  );
}
