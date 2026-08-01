import type { TriggerConditions } from "../../types";

/** Parse action `triggerConditions` JSON; invalid / empty → `{}`. */
export function parseTriggerConditions(json: string | null): TriggerConditions {
  if (!json) return {};
  try {
    return JSON.parse(json) as TriggerConditions;
  } catch {
    return {};
  }
}
