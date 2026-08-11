import type { components } from "../api/generated/schema";

type AnalysisEventResponse = components["schemas"]["AnalysisEventResponse"];

/**
 * Unified timeline/intelligence event. Most fields come from the generated
 * results response; the widened fields support local user/RRULE projections.
 */
export type AnalysisEvent = Omit<
  AnalysisEventResponse,
  "taskId" | "location" | "analysisTimeRange" | "taskName" | "dismissed" | "important"
> & {
  taskId: string | null;
  location: string | null;
  analysisTimeRange: string | null;
  taskName: string | null;
  /**
   * Timeline source discriminator (not ``user_events.kind``):
   * - analysis | recurring → AI / task intel
   * - user (no itemId) → general calendar; user + itemId → item-linked calendar
   * - item → remind DATE projection only (≠ item-linked user_events)
   */
  source?: "analysis" | "recurring" | "user" | "item";
  /** Frontend-only: indicates an all-day event */
  isAllDay?: boolean;
  /** Original calendar timezone identity when supplied by the wire contract. */
  timezone?: string | null;
  /** Present when source === "user": wire origin from user_events */
  origin?: "manual" | "assistant" | "a2a" | "agent" | "ics";
  /** Ownership workset (user_events / items / board projections); builtin `__user__` when system. */
  worksetId?: string | null;
  /** Timeline soft-dismiss marker (older local fixtures may omit it). */
  dismissed?: boolean;
  /** User/agent 「重要事件」 marker — display with ❗. */
  important?: boolean;
  /** Present when source === "item": remind projection. */
  itemDateKind?: "remind";
  /**
   * Present when source === "recurring": true if this is the final occurrence
   * of a finite RRULE series (UNTIL / COUNT). Used for month-cell「+N 结束」.
   */
  isLastOccurrence?: boolean;
  /**
   * Parent trackable item id: inventory projections (`source === "item"`) or
   * child user calendars (`source === "user"` with item link).
   */
  itemId?: string | null;
  /** Optional remind-N-days-before-start (user events). */
  remindBeforeDays?: number | null;
};

/** Generated envelope with domain-enriched item projections. */
export type AnalysisEventPage = Omit<
  components["schemas"]["AnalysisEventsPageResponse"],
  "items"
> & { items: AnalysisEvent[] };
