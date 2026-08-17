import { fetchCalendarOccurrences, fetchTimelineEvents } from "../../../api/results";
import { listRecurringSeries } from "../../../api/recurringSeries";
import { listUserEventsPage } from "../../../api/userEvents";
import { SYSTEM_WORKSET_ID } from "../../../types/worksets";
import type { AnalysisTask } from "../../../types/tasks";
import { logWarn } from "../../../utils/logger";
import { normalizeNotifyPref } from "../notifyPref";
import type {
  NotifyRowPrefs,
  NotifySeriesLookup,
  NotifyTaskLookup,
} from "../resolveNotify";
import {
  filterEventsByNotify,
  mergeTimedKeyEventsById,
  toTimedKeyEvents,
  userEventsToTimedKeyEvents,
  type TimedKeyEvent,
} from "./scanner";

type CalendarScanRow = {
  id: string;
  seriesId?: string | null;
  worksetId?: string | null;
  taskName?: string | null;
  title: string;
  startTime?: string | null;
  source?: string | null;
  notifyPref?: string | null;
};

export function worksetNotifyMap(
  worksets: readonly { id: string; notifyEnabled?: boolean | null }[],
): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const ws of worksets) {
    map.set(ws.id, ws.notifyEnabled !== false);
  }
  if (!map.has(SYSTEM_WORKSET_ID)) {
    map.set(SYSTEM_WORKSET_ID, true);
  }
  return map;
}

export function taskNotifyMap(catalogTasks: readonly AnalysisTask[]): NotifyTaskLookup {
  const map = new Map<string, NotifyRowPrefs>();
  for (const task of catalogTasks) {
    map.set(task.id, {
      notifyPref: normalizeNotifyPref(task.notifyPref),
      worksetId: task.worksetId ?? null,
    });
  }
  return map;
}

export async function seriesNotifyMap(): Promise<NotifySeriesLookup> {
  const map = new Map<string, NotifyRowPrefs>();
  try {
    const page = await listRecurringSeries();
    for (const series of page.items ?? []) {
      map.set(series.id, {
        notifyPref: normalizeNotifyPref(series.notifyPref),
        worksetId: series.worksetId ?? SYSTEM_WORKSET_ID,
      });
    }
  } catch (error) {
    logWarn("[voiceReminder] failed to fetch recurring series prefs", error);
  }
  return map;
}

export function splitCalendarRows(
  rows: ReadonlyArray<CalendarScanRow>,
): { recurring: TimedKeyEvent[]; items: TimedKeyEvent[] } {
  const recurringRows = [];
  const itemRows = [];
  for (const row of rows) {
    if (row.source === "item_remind") {
      itemRows.push(row);
    } else {
      recurringRows.push(row);
    }
  }
  return {
    recurring: toTimedKeyEvents(recurringRows, "recurring"),
    items: toTimedKeyEvents(itemRows, "user"),
  };
}

export async function fetchReminderSourceRows(
  rangeStart: string,
  rangeEnd: string,
): Promise<{
  analysisRows: Awaited<ReturnType<typeof fetchTimelineEvents>>;
  userRows: Awaited<ReturnType<typeof listUserEventsPage>>["items"];
  calendarRows: Awaited<ReturnType<typeof fetchCalendarOccurrences>>;
} | null> {
  try {
    const [analysisRows, userRows, calendarRows] = await Promise.all([
      fetchTimelineEvents({
        startDate: rangeStart,
        endDate: rangeEnd,
      }),
      listUserEventsPage({ start: rangeStart, end: rangeEnd }).then((page) => page.items),
      fetchCalendarOccurrences(rangeStart, rangeEnd),
    ]);
    return { analysisRows, userRows, calendarRows };
  } catch (error) {
    logWarn("[voiceReminder] failed to fetch reminder sources", error);
    return null;
  }
}

export function mergeCatalogTaskNames(
  catalogTaskNames: ReadonlyMap<string, string>,
  analysisRows: ReadonlyArray<{ taskId?: string | null; taskName?: string | null }>,
  calendarRows: ReadonlyArray<{ seriesId?: string | null; taskName?: string | null }>,
): Map<string, string> {
  const taskNameById = new Map<string, string>(catalogTaskNames);
  for (const row of analysisRows) {
    if (row.taskId && row.taskName) {
      taskNameById.set(row.taskId, row.taskName);
    }
  }
  for (const row of calendarRows) {
    if (row.seriesId && row.taskName) {
      taskNameById.set(row.seriesId, row.taskName);
    }
  }
  return taskNameById;
}

export function buildFilteredReminderEvents(opts: {
  analysisRows: Parameters<typeof toTimedKeyEvents>[0];
  userRows: Parameters<typeof userEventsToTimedKeyEvents>[0];
  calendarRows: ReadonlyArray<CalendarScanRow>;
  taskNameById: Map<string, string>;
  globalEnabled: boolean;
  quietHoursActive: boolean;
  worksets: readonly { id: string; notifyEnabled?: boolean | null }[];
  catalogTasks: readonly AnalysisTask[];
  seriesById: NotifySeriesLookup;
}): TimedKeyEvent[] {
  const calendarSplit = splitCalendarRows(opts.calendarRows);
  return filterEventsByNotify(
    mergeTimedKeyEventsById(
      toTimedKeyEvents(opts.analysisRows, "event"),
      userEventsToTimedKeyEvents(opts.userRows, opts.taskNameById),
      calendarSplit.recurring,
      calendarSplit.items,
    ),
    {
      globalEnabled: opts.globalEnabled,
      quietHoursActive: opts.quietHoursActive,
      worksetNotifyById: worksetNotifyMap(opts.worksets),
      tasksById: taskNotifyMap(opts.catalogTasks),
      seriesById: opts.seriesById,
    },
  );
}
