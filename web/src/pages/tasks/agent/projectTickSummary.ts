/**
 * Pure helpers for project detail tick summary (completed log + in-flight drain).
 */

import type {
  AgentTickInFlight,
  AgentTickLogEntry,
  AgentTickStatus,
  TaskActivitySpan,
} from "../../../types/analysis";
import type { BadgeTone } from "../../../components/ui/Badge";

export type TickOutcome = "success" | "skipped" | "error" | "running";

export function deriveTickOutcome(
  entry: Pick<AgentTickLogEntry, "outcome" | "errorMessage" | "agentMessage"> | null | undefined,
): Exclude<TickOutcome, "running"> | null {
  if (!entry) return null;
  if (entry.outcome === "success" || entry.outcome === "skipped" || entry.outcome === "error") {
    return entry.outcome;
  }
  if (entry.errorMessage?.trim()) return "error";
  const message = entry.agentMessage?.trim();
  if (!message) return null;
  if (message.toLowerCase().startsWith("skipped:")) return "skipped";
  return "success";
}

export function tickOutcomeTone(outcome: TickOutcome): BadgeTone {
  if (outcome === "success") return "success";
  if (outcome === "skipped") return "warning";
  if (outcome === "running") return "info";
  return "danger";
}

export interface AgentTickSummaryView {
  latestTick: AgentTickLogEntry | null;
  inFlight: AgentTickInFlight | null;
  outcome: TickOutcome | null;
  errorMessage: string | null;
  messageCount: number | null;
  pendingSinceCursor: number | null;
  tickLog: AgentTickLogEntry[];
  toolCalls: NonNullable<AgentTickLogEntry["toolCalls"]>;
  agentMessage: string;
}

export function buildAgentTickSummaryView(
  tickStatus: AgentTickStatus | null,
  activitySpan: TaskActivitySpan | null,
): AgentTickSummaryView {
  const latestTick = tickStatus?.ticks?.[0] ?? null;
  const inFlight = tickStatus?.inFlight ?? null;
  const outcome = inFlight
    ? "running"
    : (deriveTickOutcome(latestTick) ??
      deriveTickOutcome({
        outcome: "",
        errorMessage: activitySpan?.lastErrorMessage,
        agentMessage: activitySpan?.lastAgentMessage,
      }));

  return {
    latestTick,
    inFlight,
    outcome,
    errorMessage:
      latestTick?.errorMessage?.trim() ||
      activitySpan?.lastErrorMessage?.trim() ||
      null,
    messageCount:
      inFlight?.messageCount ??
      latestTick?.messageCount ??
      activitySpan?.lastMessageCount ??
      null,
    pendingSinceCursor: tickStatus?.pendingSinceCursor ?? null,
    tickLog: tickStatus?.ticks ?? [],
    toolCalls: latestTick?.toolCalls ?? activitySpan?.lastToolCalls ?? [],
    agentMessage:
      (latestTick?.agentMessage ?? activitySpan?.lastAgentMessage)?.trim() || "",
  };
}
