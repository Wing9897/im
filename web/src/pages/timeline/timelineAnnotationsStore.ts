/**
 * Timeline client annotations (event statuses + eventTimeOverrides) backed by
 * `/api/v1/ui-prefs/timeline/annotations`. Soft-dismiss stays on dedicated
 * dismissals API — never conflate the two.
 *
 * INVARIANTS:
 * - Server is SoT after hydrate; empty server → empty maps (no LS migrate).
 */

import {
  fetchTimelineAnnotations,
  putTimelineAnnotations,
  type TimelineAnnotationsPayload,
} from "../../api/uiPrefs";
import { hydrateServerBackedPref } from "../../utils/createServerBackedPrefStore";
import { logWarn } from "../../utils/logger";
import type {
  TimelineEventStatus,
  TimelineEventStatusMap,
  TimelineEventTimeOverrideMap,
} from "../../domain/timeline/status";

const STATUS_VALUES = new Set<TimelineEventStatus>(["pending", "confirmed", "completed"]);

export type TimelineAnnotations = {
  eventStatuses: TimelineEventStatusMap;
  eventTimeOverrides: TimelineEventTimeOverrideMap;
};

let cached: TimelineAnnotations | null = null;
let hydratePromise: Promise<TimelineAnnotations> | null = null;

function isStatus(value: unknown): value is TimelineEventStatus {
  return typeof value === "string" && STATUS_VALUES.has(value as TimelineEventStatus);
}

function normalizeStatuses(raw: unknown): TimelineEventStatusMap {
  if (!raw || typeof raw !== "object") return {};
  const out: TimelineEventStatusMap = {};
  for (const [id, status] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof id === "string" && id && isStatus(status)) {
      out[id] = status;
    }
  }
  return out;
}

function normalizeOverrides(raw: unknown): TimelineEventTimeOverrideMap {
  if (!raw || typeof raw !== "object") return {};
  const out: TimelineEventTimeOverrideMap = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof id !== "string" || !id || !value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    const startTime = row.startTime;
    const endTime = row.endTime;
    if (typeof startTime !== "string" || !startTime.trim()) continue;
    if (endTime != null && typeof endTime !== "string") continue;
    out[id] = {
      startTime: startTime.trim(),
      endTime: typeof endTime === "string" && endTime.trim() ? endTime.trim() : null,
    };
  }
  return out;
}

function normalizeAnnotations(raw: Partial<TimelineAnnotations> | null | undefined): TimelineAnnotations {
  return {
    eventStatuses: normalizeStatuses(raw?.eventStatuses),
    eventTimeOverrides: normalizeOverrides(raw?.eventTimeOverrides),
  };
}

function toPayload(data: TimelineAnnotations): TimelineAnnotationsPayload {
  return {
    eventStatuses: data.eventStatuses,
    eventTimeOverrides: data.eventTimeOverrides,
  };
}

function setCache(data: TimelineAnnotations): void {
  cached = {
    eventStatuses: { ...data.eventStatuses },
    eventTimeOverrides: { ...data.eventTimeOverrides },
  };
}

/** Sync read from memory (empty maps before hydrate). */
export function loadTimelineAnnotations(): TimelineAnnotations {
  if (cached) {
    return {
      eventStatuses: { ...cached.eventStatuses },
      eventTimeOverrides: { ...cached.eventTimeOverrides },
    };
  }
  return { eventStatuses: {}, eventTimeOverrides: {} };
}

/** Hydrate from SQLite. Empty server → empty maps (no localStorage migrate). */
export async function hydrateTimelineAnnotations(): Promise<TimelineAnnotations> {
  if (!hydratePromise) {
    hydratePromise = hydrateServerBackedPref<TimelineAnnotations>({
      fetchRemote: async () => {
        const response = await fetchTimelineAnnotations();
        if (!response.configured) {
          return { configured: false, data: null };
        }
        return {
          configured: true,
          data: {
            eventStatuses: response.eventStatuses ?? {},
            eventTimeOverrides: response.eventTimeOverrides ?? {},
          },
        };
      },
      normalize: normalizeAnnotations,
      defaults: () => ({ eventStatuses: {}, eventTimeOverrides: {} }),
      setCache,
      logLabel: "timelineAnnotations",
    }).then((normalized) => ({
      eventStatuses: { ...normalized.eventStatuses },
      eventTimeOverrides: { ...normalized.eventTimeOverrides },
    })).finally(() => {
      hydratePromise = null;
    });
  }
  return hydratePromise;
}

/** Persist annotations to SQLite (debounced callers OK). */
export async function saveTimelineAnnotations(
  data: TimelineAnnotations,
): Promise<boolean> {
  const normalized = normalizeAnnotations(data);
  setCache(normalized);
  try {
    await putTimelineAnnotations(toPayload(normalized));
    return true;
  } catch (error) {
    logWarn("[timelineAnnotations] failed to save", error);
    return false;
  }
}

export function resetTimelineAnnotationsCacheForTests(): void {
  cached = null;
  hydratePromise = null;
}
