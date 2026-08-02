import type { components } from "../api/generated/schema";

type AnalysisEventResponse = components["schemas"]["AnalysisEventResponse"];

/**
 * Unified timeline/intelligence event. Most fields come from the generated
 * results response; the widened fields support local user/RRULE projections.
 */
export type AnalysisEvent = Omit<
  AnalysisEventResponse,
  "taskId" | "location" | "analysisTimeRange" | "taskName" | "dismissed"
> & {
  taskId: string | null;
  location: string | null;
  analysisTimeRange: string | null;
  taskName: string | null;
  /** Discriminator: "recurring" = RRULE; "user" = user_events; "item" = trackable item DATE */
  source?: "analysis" | "recurring" | "user" | "item";
  /** Frontend-only: indicates an all-day event */
  isAllDay?: boolean;
  /** Original calendar timezone identity when supplied by the wire contract. */
  timezone?: string | null;
  /** Present when source === "user": wire origin from user_events */
  origin?: "manual" | "assistant" | "a2a" | "project" | "ics";
  /** Ownership workset (user_events / items / board projections); builtin `__user__` when system. */
  worksetId?: string | null;
  /** Timeline soft-dismiss marker (older local fixtures may omit it). */
  dismissed?: boolean;
  /** Present when source === "item": purchased / expires / remind projection. */
  itemDateKind?: "purchased" | "expires" | "remind";
  /** Present when source === "item": backing inventory row id. */
  itemId?: string | null;
};

/** Generated envelope with domain-enriched item projections. */
export type AnalysisEventPage = Omit<
  components["schemas"]["AnalysisEventsPageResponse"],
  "items"
> & { items: AnalysisEvent[] };
