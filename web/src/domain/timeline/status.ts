import type { TimelineEventTimeOverridePayload } from "../../api/uiPrefs";
import i18n from "../../i18n";

export type TimelineEventStatus = "pending" | "confirmed" | "completed";
export type EventStatus = TimelineEventStatus | "cancelled";
export type TimelineEventStatusMap = Record<string, TimelineEventStatus>;

/** OpenAPI ``TimelineEventTimeOverrideSchema`` (wire SoT). */
export type TimelineEventTimeOverride = TimelineEventTimeOverridePayload;

export type TimelineEventTimeOverrideMap = Record<string, TimelineEventTimeOverride>;

export const EVENT_STATUS_COLORS: Record<EventStatus, string> = {
  pending: "var(--warning)",
  confirmed: "var(--info)",
  completed: "var(--success)",
  cancelled: "var(--text-muted)",
};

const EVENT_STATUS_KEYS = ["pending", "confirmed", "completed", "cancelled"] as const;

export function getEventStatusLabel(status: EventStatus): string {
  const key =
    typeof status === "string" && (EVENT_STATUS_KEYS as readonly string[]).includes(status)
      ? status
      : "pending";
  return String(i18n.t(`timeline:status.${key}`));
}

export function getEventStatusColor(status: EventStatus): string {
  return EVENT_STATUS_COLORS[status] ?? EVENT_STATUS_COLORS.pending;
}
