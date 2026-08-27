import type { components } from "../api/generated/schema";

type AnalysisEventResponse = components["schemas"]["AnalysisEventResponse"];
/** Wire origin from ``user_events`` (OpenAPI SoT — includes ``mcp``). */
type UserEventOrigin = components["schemas"]["UserEventResponse"]["origin"];

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
   * - analysis → AI / task intel
   * - recurring → calendar RRULE series (``seriesId``; not an analysis task)
   * - user (no itemId) → general calendar; user + itemId → item-linked calendar
   * - item_remind → remind DATE projection only (≠ item-linked user_events)
   * - subscribed:{handle}/{slug} → read-only public calendar; recurring rows also carry ``seriesId``
   */
  source?: "analysis" | "recurring" | "user" | "item_remind" | `subscribed:${string}`;
  /**
   * Owning RRULE series id when ``source === "recurring"`` (local series) or
   * ``source`` is ``subscribed:{handle}/{slug}`` (remote uid on expanded occurrences).
   * One-offs omit it or set null — Gantt must not fake-group those rows.
   */
  seriesId?: string | null;
  /** Frontend-only: indicates an all-day event */
  isAllDay?: boolean;
  /** Original calendar timezone identity when supplied by the wire contract. */
  timezone?: string | null;
  /** Present when source === "user": wire origin from user_events (OpenAPI). */
  origin?: UserEventOrigin;
  /** Ownership workset (user_events / items / board projections); builtin `__general__` when system. */
  worksetId?: string | null;
  /** Timeline soft-dismiss marker (older local fixtures may omit it). */
  dismissed?: boolean;
  /** User/agent 「重要事件」 marker — display with ❗. */
  important?: boolean;
  /** Present when source === "item_remind": remind projection. */
  itemDateKind?: "remind";
  /**
   * Present when this is the final occurrence of a finite RRULE series
   * (UNTIL / COUNT): local ``source === "recurring"`` or subscribed series.
   * Used for month-cell「+N 结束」.
   */
  isLastOccurrence?: boolean;
  /**
   * Parent trackable item id: inventory projections (`source === "item_remind"`) or
   * child user calendars (`source === "user"` with item link).
   */
  itemId?: string | null;
  /** Optional remind-N-days-before-start (user events). */
  remindBeforeDays?: number | null;
  /** Per-row reminder override when source === user or item_remind. */
  notifyPref?: "inherit" | "off" | null;
  /** Entity card glyph (NULL = product logo). */
  emoji?: string | null;
};

/** Generated envelope with domain-enriched item projections. */
export type AnalysisEventPage = Omit<
  components["schemas"]["AnalysisEventsPageResponse"],
  "items"
> & { items: AnalysisEvent[] };
