import {
  isNullProvenanceTaskId,
  resolveUserEventTaskName,
  type TaskNameLookup,
  type WorksetNameLookup,
} from "../domain/timeline/userEvents";
import {
  expandWorksetIdsToTaskIds,
  isEmptySourceFilter,
  type SourceFilterSelection,
  type WorksetMemberTask,
} from "../domain/tasks/sourceFilterSelection";
import { SYSTEM_WORKSET_ID } from "../types/worksets";
import { formatMessage } from "../i18n/formatMessage";
import i18n from "../i18n";
import {
  MSG_SPEAK_WITHOUT_TASK,
  MSG_SPEAK_WITH_TASK,
  MSG_SPEAK_WITH_WORKSET,
} from "../i18n/messageKeys";
import type { LeadOffsetMinutes } from "./settings";
import {
  FETCH_BUFFER_MS,
  FIRED_RETAIN_AFTER_START_MS,
  SCAN_GRACE_MS,
  SCAN_INTERVAL_MS,
  type DueReminder,
  type TimedKeyEvent,
  type TimedKeyEventKind,
} from "./scannerTypes";

/**
 * Dedupe key: ``eventId::lead::startTime`` (matches server prune).
 * ``startTime`` may contain ``:``; always split on the first two ``::``.
 */
export function buildDedupeKey(
  eventId: string,
  leadOffsetMinutes: number,
  startTime: string,
): string {
  return `${eventId}::${leadOffsetMinutes}::${startTime}`;
}

/** Phrase fragment for speak text / tests (follows UI locale). */
export function formatLeadSpeakPhrase(leadOffsetMinutes: number): string {
  switch (leadOffsetMinutes) {
    case 15:
      return String(i18n.t("messages.speakLead15"));
    case 60:
      return String(i18n.t("messages.speakLead60"));
    case 240:
      return String(i18n.t("messages.speakLead240"));
    case 1440:
      return String(i18n.t("messages.speakLead1440"));
    default:
      return String(i18n.t("messages.speakLeadMinutes", { minutes: leadOffsetMinutes }));
  }
}

function speakKindLabel(kind: TimedKeyEventKind | undefined): string {
  switch (kind) {
    case "recurring":
      return String(i18n.t("messages.speakKindRecurring"));
    case "user":
      return String(i18n.t("messages.speakKindUser"));
    default:
      return String(i18n.t("messages.speakKindEvent"));
  }
}

/** Spoken reminder line — not gated by assistant ttsEnabled. */
export function buildSpeakText(
  taskName: string,
  title: string,
  leadOffsetMinutes: number,
  kind: TimedKeyEventKind = "event",
): string {
  const kindLabel = speakKindLabel(kind);
  const eventTitle = title.trim() || kindLabel;
  const task = taskName.trim();
  const lead = formatLeadSpeakPhrase(leadOffsetMinutes);
  if (task) {
    if (kind === "user") {
      return formatMessage(MSG_SPEAK_WITH_WORKSET, { workset: task, kindLabel, eventTitle, lead });
    }
    return formatMessage(MSG_SPEAK_WITH_TASK, { task, kindLabel, eventTitle, lead });
  }
  return formatMessage(MSG_SPEAK_WITHOUT_TASK, { kindLabel, eventTitle, lead });
}

/**
 * Filter timed events by hierarchical source selection (same model as
 * board/timeline). `null` selection means all sources. Workset selection
 * matches `event.worksetId` directly and also expands to member task ids
 * from `catalogTasks` (for analysis/calendar rows without ownership fields).
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
  const allowTasks = new Set<string>([
    ...selection.taskIds,
    ...expandWorksetIdsToTaskIds(selection.worksetIds, catalogTasks),
  ]);
  const allowWorksets = new Set(selection.worksetIds);
  return events.filter((event) => {
    if (event.worksetId && allowWorksets.has(event.worksetId)) return true;
    if (event.taskId != null && event.taskId !== "" && allowTasks.has(event.taskId)) {
      return true;
    }
    return false;
  });
}

export function getMaxLeadMinutes(leadOffsetsMinutes: readonly number[]): number {
  if (leadOffsetsMinutes.length === 0) {
    return 0;
  }
  return Math.max(...leadOffsetsMinutes);
}

/** True when a local clock time falls inside an overnight-aware quiet period. */
export function isWithinQuietHours(
  now: Date,
  quietHours: { start: string; end: string },
): boolean {
  const toMinutes = (value: string): number | null => {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null;
  };
  const start = toMinutes(quietHours.start);
  const end = toMinutes(quietHours.end);
  if (start === null || end === null || start === end) {
    return false;
  }
  const current = now.getHours() * 60 + now.getMinutes();
  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
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

/** Parse startTime ISO from a dedupe key; null if malformed. */
export function parseStartTimeFromDedupeKey(key: string): string | null {
  const firstSep = key.indexOf("::");
  if (firstSep < 0) {
    return null;
  }
  const secondSep = key.indexOf("::", firstSep + 2);
  if (secondSep < 0) {
    return null;
  }
  const startTime = key.slice(secondSep + 2);
  return startTime || null;
}

/** Drop fired keys whose event start is older than retain window. */
export function pruneFiredKeys(
  firedKeys: ReadonlySet<string>,
  nowMs: number,
  retainAfterStartMs: number = FIRED_RETAIN_AFTER_START_MS,
): Set<string> {
  const next = new Set<string>();
  for (const key of firedKeys) {
    const startTime = parseStartTimeFromDedupeKey(key);
    if (!startTime) {
      continue;
    }
    const startMs = Date.parse(startTime);
    if (!Number.isFinite(startMs)) {
      continue;
    }
    if (startMs + retainAfterStartMs >= nowMs) {
      next.add(key);
    }
  }
  return next;
}

/** Sample line for the panel「試播」button. */
export function buildPreviewSpeakText(
  _leadOffsetMinutes: LeadOffsetMinutes = 60,
): string {
  void _leadOffsetMinutes;
  return String(i18n.t("messages.speakPreview"));
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
