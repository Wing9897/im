import type { RecurrenceConfig, RecurrenceFreq } from "../types/calendar";
import { buildRRule } from "./rrule";
import i18n from "../i18n";

export interface RRuleValidationErrors {
  freq?: string;
  byDay?: string;
  byMonthDay?: string;
}

interface RRuleValidationResult {
  valid: boolean;
  errors: RRuleValidationErrors;
  rruleString: string | null;
}

const VALID_FREQS: RecurrenceFreq[] = ["daily", "weekly", "monthly"];

/** Validates recurrence editor config and produces an RRULE string when valid. */
export function validateRRuleConfig(config: RecurrenceConfig): RRuleValidationResult {
  const errors: RRuleValidationErrors = {};

  if (!VALID_FREQS.includes(config.freq)) {
    errors.freq = String(i18n.t("tasks.recurrence.errors.freq"));
  }

  if (config.freq === "weekly" && config.byDay.length === 0) {
    errors.byDay = String(i18n.t("tasks.recurrence.errors.byDay"));
  }

  if (config.freq === "monthly" && config.byMonthDay.length === 0) {
    errors.byMonthDay = String(i18n.t("tasks.recurrence.errors.byMonthDay"));
  }

  const valid = Object.keys(errors).length === 0;
  return { valid, errors, rruleString: valid ? buildRRule(config) : null };
}
