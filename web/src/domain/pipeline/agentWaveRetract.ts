import type { UserEvent } from "../../api/userEvents";
import type { AgentTickLogEntry } from "../../types/analysis";
import type { RecurringSeries } from "../../types/recurring";

export interface AgentWaveWindow {
  batchId: string;
  startMs: number;
  endMs: number;
}

function parseIsoMs(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** Last completed `analysis_batches` row from newest-first agent ticks. */
export function lastCompletedBatchWindow(
  ticks: readonly AgentTickLogEntry[] | null | undefined,
): AgentWaveWindow | null {
  if (!ticks || ticks.length === 0) return null;
  const last = ticks.find((tick) => tick.status === "completed");
  if (!last) return null;
  const startMs = parseIsoMs(last.createdAt);
  if (startMs == null) return null;
  const endMs = parseIsoMs(last.completedAt) ?? startMs;
  return {
    batchId: last.batchId,
    startMs,
    endMs: Math.max(startMs, endMs),
  };
}

export function isTimestampInAgentWaveWindow(
  iso: string | null | undefined,
  window: AgentWaveWindow,
): boolean {
  const ms = parseIsoMs(iso);
  if (ms == null) return false;
  return ms >= window.startMs && ms <= window.endMs;
}

/** Soft-hide targets: agent-origin user_events created in the last completed batch window. */
export function selectAgentWaveUserEvents(
  events: readonly UserEvent[],
  taskId: string,
  window: AgentWaveWindow,
): UserEvent[] {
  return events.filter((event) => {
    if (event.dismissed) return false;
    if (event.origin !== "agent") return false;
    if (event.taskId !== taskId) return false;
    return isTimestampInAgentWaveWindow(event.createdAt, window);
  });
}

/** Child recurring series created in the same completed-batch window. */
export function selectAgentWaveRecurringSeries(
  series: readonly RecurringSeries[],
  taskId: string,
  window: AgentWaveWindow,
): RecurringSeries[] {
  return series.filter((child) => {
    if (child.parentTaskId !== taskId) return false;
    return isTimestampInAgentWaveWindow(child.createdAt, window);
  });
}
