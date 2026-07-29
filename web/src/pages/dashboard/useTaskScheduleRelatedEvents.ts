/**
 * Load related timed items for recurring / calendar_task detail panels.
 * Recurring: RRULE occurrences in a forward window + owned user_events.
 * calendar_task: owned user_events only (filter bucket, no RRULE).
 */

import { useEffect, useState } from "react";

import { fetchCalendarOccurrences } from "../../api/results";
import { listUserEvents, type UserEvent } from "../../api/userEvents";
import type { CalendarOccurrence } from "../../types/analysis";
import type { AnalysisMode } from "../../types/common";
import { isScheduleOnlyAnalysisMode } from "../../domain/tasks/analysisModeCapabilities";
import { toErrorMessage } from "../../utils/errors";

const WINDOW_DAYS = 14;
/** Preview cap for the task detail dialog — full schedule lives on Timeline. */
const MAX_ITEMS = 5;

export type TaskScheduleRelatedItem = {
  id: string;
  kind: "occurrence" | "user_event";
  title: string;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
};

export { isScheduleOnlyAnalysisMode };

function toIso(date: Date): string {
  return date.toISOString();
}

function windowRange(now = new Date()): { start: string; end: string } {
  const start = new Date(now);
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + WINDOW_DAYS);
  return { start: toIso(start), end: toIso(end) };
}

function fromOccurrence(row: CalendarOccurrence): TaskScheduleRelatedItem {
  return {
    id: row.id,
    kind: "occurrence",
    title: row.title,
    startTime: row.startTime,
    endTime: row.endTime ?? null,
    location: row.location ?? null,
  };
}

function fromUserEvent(row: UserEvent): TaskScheduleRelatedItem {
  return {
    id: row.id,
    kind: "user_event",
    title: row.title,
    startTime: row.startTime,
    endTime: row.endTime ?? null,
    location: row.location ?? null,
  };
}

function sortByStart(items: TaskScheduleRelatedItem[]): TaskScheduleRelatedItem[] {
  return [...items].sort((a, b) => a.startTime.localeCompare(b.startTime)).slice(0, MAX_ITEMS);
}

export function useTaskScheduleRelatedEvents(
  taskId: string | undefined,
  analysisMode: AnalysisMode | undefined,
) {
  const enabled = Boolean(
    taskId && analysisMode && isScheduleOnlyAnalysisMode(analysisMode),
  );
  const [items, setItems] = useState<TaskScheduleRelatedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !taskId || !analysisMode) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const { start, end } = windowRange();
    const load = async () => {
      try {
        const ownedEvents = await listUserEvents({ taskId, start, end });
        let occurrences: CalendarOccurrence[] = [];
        if (analysisMode === "recurring") {
          occurrences = await fetchCalendarOccurrences(start, end, { taskId });
        }
        if (cancelled) return;
        setItems(
          sortByStart([
            ...occurrences.map(fromOccurrence),
            ...ownedEvents.map(fromUserEvent),
          ]),
        );
      } catch (err) {
        if (cancelled) return;
        setItems([]);
        setError(toErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, taskId, analysisMode]);

  return { items, loading, error, enabled };
}
