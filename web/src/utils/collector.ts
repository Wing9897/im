import type { CollectorStatus } from "../types";
import i18n from "../i18n";

const TRANSITION_STATUSES = new Set<CollectorStatus>([
  "starting",
  "stopping",
  "restarting",
]);
const STABLE_STATUSES = new Set<CollectorStatus>(["running", "stopped", "error"]);

const COLLECTOR_STATUSES: CollectorStatus[] = [
  "starting",
  "running",
  "stopping",
  "stopped",
  "restarting",
  "error",
];

/** Top-bar tooltip labels (long form with collector prefix). */
export function getCollectorStatusLabelsLong(): Record<CollectorStatus, string> {
  return Object.fromEntries(
    COLLECTOR_STATUSES.map((status) => [
      status,
      String(i18n.t(`topBar.collector.${status}`)),
    ]),
  ) as Record<CollectorStatus, string>;
}

/** Compact labels for constrained top-bar space. */
export function getCollectorStatusLabelsShort(): Record<CollectorStatus, string> {
  return Object.fromEntries(
    COLLECTOR_STATUSES.map((status) => [
      status,
      String(i18n.t(`topBar.collectorShort.${status}`)),
    ]),
  ) as Record<CollectorStatus, string>;
}

const ALL_STATUSES = new Set<CollectorStatus>([
  ...TRANSITION_STATUSES,
  ...STABLE_STATUSES,
]);

/** Per-adapter connection wire values on collector_status_changed (not aggregate). */
const WIRE_ADAPTER_STATUSES = new Set(["connected", "disconnected", "connecting"]);

/** True when SSE payload.status is an adapter-level wire token, not running/stopped/…. */
export function isWireAdapterCollectorEvent(status: string): boolean {
  return WIRE_ADAPTER_STATUSES.has(status.trim().toLowerCase());
}

/** True when status is an aggregate CollectorManager value. */
export function isAggregateCollectorStatus(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return ALL_STATUSES.has(normalized as CollectorStatus);
}

/** Whether collector SSE should refetch REST instead of normalizing payload.status. */
export function shouldRefetchCollectorStatus(payload: {
  status: string;
  adapter_name?: string;
}): boolean {
  if (isWireAdapterCollectorEvent(payload.status)) {
    return true;
  }
  return Boolean(payload.adapter_name) && !isAggregateCollectorStatus(payload.status);
}

/** Normalizes a raw collector status string to a known CollectorStatus enum value. */
export function normalizeCollectorStatus(
  value: string,
  fallback: CollectorStatus = "stopped",
): CollectorStatus {
  const normalized = value.trim().toLowerCase();
  if (ALL_STATUSES.has(normalized as CollectorStatus)) {
    return normalized as CollectorStatus;
  }
  return fallback;
}
