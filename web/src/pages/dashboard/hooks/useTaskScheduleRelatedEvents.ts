/**
 * Load RRULE occurrences and owned user events for recurring detail panels.
 */

import { useEffect, useState } from "react";

import { ApiRequestError } from "../../../api/client";
import { fetchCalendarOccurrences } from "../../../api/results";
import { fetchTaskSchedule } from "../../../api/taskSchedule";
import { listUserEvents, type UserEvent } from "../../../api/userEvents";
import type { CalendarOccurrence } from "../../../types/analysis";
import type { AnalysisMode } from "../../../types/common";
import { isScheduleOnlyAnalysisMode } from "../../../domain/tasks/analysisModeCapabilities";
import { toErrorMessage } from "../../../utils/errors";

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

function isScheduleNotFound(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 404;
}

export function useTaskScheduleRelatedEvents(
  taskId: string | undefined,
  analysisMode: AnalysisMode | undefined,
) {
  const enabled = Boolean(
    taskId && analysisMode && isScheduleOnlyAnalysisMode(analysisMode),
  );
  const [items, setItems] = useState<TaskScheduleRelatedItem[]>([]);
  const [eventLocation, setEventLocation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !taskId || !analysisMode) {
      setItems([]);
      setEventLocation(null);
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
        /** undefined = keep previous location (soft schedule failure). */
        let nextLocation: string | null | undefined = undefined;
        let scheduleError: string | null = null;
        if (analysisMode === "recurring") {
          const [occRows, scheduleOutcome] = await Promise.all([
            fetchCalendarOccurrences(start, end, { taskId }),
            fetchTaskSchedule(taskId).then(
              (schedule) => ({ kind: "ok" as const, schedule }),
              (err: unknown) => ({ kind: "error" as const, err }),
            ),
          ]);
          occurrences = occRows;
          if (scheduleOutcome.kind === "ok") {
            nextLocation = scheduleOutcome.schedule.eventLocation?.trim() || null;
          } else if (isScheduleNotFound(scheduleOutcome.err)) {
            nextLocation = null;
          } else {
            // Soft failure: keep related events / prior location; toast via `error`.
            scheduleError = toErrorMessage(scheduleOutcome.err);
          }
        }
        if (cancelled) return;
        if (nextLocation !== undefined) {
          setEventLocation(nextLocation);
        }
        setItems(
          sortByStart([
            ...occurrences.map(fromOccurrence),
            ...ownedEvents.map(fromUserEvent),
          ]),
        );
        setError(scheduleError);
      } catch (err) {
        if (cancelled) return;
        setItems([]);
        setEventLocation(null);
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

  return { items, eventLocation, loading, error, enabled };
}
