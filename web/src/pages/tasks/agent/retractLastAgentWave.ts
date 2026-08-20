import { fetchCalendarWindow } from "../../../api/calendarWindow";
import { dismissTimelineEvent } from "../../../api/timelineDismissals";
import type { UserEvent } from "../../../api/userEvents";
import type { AgentTickLogEntry } from "../../../types/analysis";
import type { RecurringSeries } from "../../../types/recurring";
import {
  lastCompletedBatchWindow,
  selectAgentWaveRecurringSeries,
  selectAgentWaveUserEvents,
} from "../../../domain/pipeline/agentWaveRetract";

export type RetractLastAgentWaveResult =
  | { status: "no_batch"; count: 0 }
  | { status: "none"; count: 0 }
  | { status: "ok"; count: number };

async function dismissRecurringOccurrences(
  series: readonly RecurringSeries[],
  startMs: number,
): Promise<number> {
  if (series.length === 0) return 0;
  const seriesIds = new Set(series.map((row) => row.id));
  const rangeEnd = new Date();
  rangeEnd.setFullYear(rangeEnd.getFullYear() + 2);
  const items = await fetchCalendarWindow({
    start: new Date(startMs).toISOString(),
    end: rangeEnd.toISOString(),
    includeAnalysis: false,
    includeUser: false,
    includeRecurring: true,
    includeItems: false,
  });
  let count = 0;
  await Promise.all(
    items.map(async (item) => {
      if (item.source !== "recurring") return;
      if (!item.seriesId || !seriesIds.has(item.seriesId)) return;
      if (item.dismissed) return;
      await dismissTimelineEvent("recurring", item.id);
      count += 1;
    }),
  );
  return count;
}

/** Soft-dismiss last completed agent-tick window (zero schema; uses timeline_dismissals). */
export async function retractLastAgentWave(args: {
  taskId: string;
  ticks: readonly AgentTickLogEntry[] | null | undefined;
  events: readonly UserEvent[];
  children: readonly RecurringSeries[];
}): Promise<RetractLastAgentWaveResult> {
  const window = lastCompletedBatchWindow(args.ticks);
  if (!window) return { status: "no_batch", count: 0 };

  const userTargets = selectAgentWaveUserEvents(args.events, args.taskId, window);
  const seriesTargets = selectAgentWaveRecurringSeries(
    args.children,
    args.taskId,
    window,
  );
  if (userTargets.length === 0 && seriesTargets.length === 0) {
    return { status: "none", count: 0 };
  }

  await Promise.all(
    userTargets.map((event) => dismissTimelineEvent("user", event.id)),
  );
  const recurringCount = await dismissRecurringOccurrences(
    seriesTargets,
    window.startMs,
  );
  return { status: "ok", count: userTargets.length + recurringCount };
}
