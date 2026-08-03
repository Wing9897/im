import type {
  AnalysisMode,
  AnalysisTimeRange,
  TaskFormState,
} from "../../types";
import i18n from "../../i18n";
import { ANALYSIS_MODE_ORDER } from "./analysisModeCapabilities";

// ============================================================
// Types
// ============================================================

interface ParsedTaskAssistantResponse {
  message: string;
  taskConfig: Partial<TaskFormState>;
}

type ParseResult =
  | { ok: true; data: ParsedTaskAssistantResponse }
  | { ok: false; error: string };

// ============================================================
// Validation constants
// ============================================================

/** Keep in lockstep with ANALYSIS_MODE_ORDER (includes web_intel). */
const VALID_ANALYSIS_MODES: readonly string[] = ANALYSIS_MODE_ORDER;

const VALID_ANALYSIS_TIME_RANGES: readonly AnalysisTimeRange[] = [
  "all",
  "today",
  "1h",
  "6h",
  "12h",
  "24h",
  "48h",
  "1d",
  "7d",
  "30d",
];

// ============================================================
// Parser
// ============================================================

/**
 * Parses and validates the raw response from the task advisor (``tasks.consult_advisor``).
 *
 * Multi-turn conversation semantics (graceful incremental parsing):
 * - The AI may return a conversational reply without a complete task config
 *   (e.g., asking the user for clarification before filling all fields).
 * - If taskConfig is entirely empty or all required fields are missing/empty,
 *   the parser returns success with an empty taskConfig (conversation-only turn).
 * - If taskConfig has at least some populated fields, those fields are validated
 *   and returned as a partial config. Only fields with *wrong types* (not simply
 *   missing) produce a hard error.
 * - This enables incremental form population: each AI reply fills in whatever
 *   fields it can, and the form state accumulates progressively.
 *
 * Hard errors are only returned for structurally invalid responses (non-object,
 * non-string message, wrong types for present fields).
 *
 * Returns:
 *   - `{ ok: true, data: { message, taskConfig } }` on success
 *   - `{ ok: false, error: string }` on structural validation failure
 */
export function parseTaskAssistantResponse(raw: unknown): ParseResult {
  // 1. Check that raw is an object
  if (raw === null || raw === undefined || typeof raw !== "object") {
    return { ok: false, error: String(i18n.t("assistant:parse.notObject")) };
  }

  const response = raw as Record<string, unknown>;

  // 2. Validate message field
  if (response.message === undefined || response.message === null) {
    return { ok: false, error: String(i18n.t("assistant:parse.missingMessage")) };
  }
  if (typeof response.message !== "string") {
    return { ok: false, error: String(i18n.t("assistant:parse.messageNotString")) };
  }
  const message = response.message;

  // 3. Validate taskConfig exists and is an object
  if (response.taskConfig === undefined || response.taskConfig === null) {
    // Conversation-only turn: AI replied without any config change.
    return { ok: true, data: { message, taskConfig: {} } };
  }
  if (typeof response.taskConfig !== "object" || Array.isArray(response.taskConfig)) {
    return { ok: false, error: String(i18n.t("assistant:parse.taskConfigNotObject")) };
  }

  const config = response.taskConfig as Record<string, unknown>;

  // 4. Build the taskConfig incrementally — only include fields that are
  //    present and have valid values. Wrong types produce hard errors;
  //    missing/empty fields are simply omitted (not errors).
  const taskConfig: Partial<TaskFormState> = {};

  // name (string, non-empty)
  if (config.name !== undefined && config.name !== null) {
    if (typeof config.name !== "string") {
      return { ok: false, error: String(i18n.t("assistant:parse.nameNotString")) };
    }
    const trimmed = config.name.trim();
    if (trimmed) {
      taskConfig.name = trimmed;
    }
    // If name is present but empty string after trim → skip silently
    // (AI may be signalling "I haven't decided yet").
  }

  // promptTemplate (string, non-empty)
  if (config.promptTemplate !== undefined && config.promptTemplate !== null) {
    if (typeof config.promptTemplate !== "string") {
      return { ok: false, error: String(i18n.t("assistant:parse.promptNotString")) };
    }
    const trimmed = config.promptTemplate.trim();
    if (trimmed) {
      taskConfig.promptTemplate = trimmed;
    }
  }

  // scheduleRrule (canonical trigger RRULE string)
  if (config.scheduleRrule !== undefined && config.scheduleRrule !== null) {
    if (typeof config.scheduleRrule !== "string") {
      return {
        ok: false,
        error: String(i18n.t("assistant:parse.scheduleRruleNotString")),
      };
    }
    const trimmed = config.scheduleRrule.trim();
    if (trimmed) {
      taskConfig.scheduleRrule = trimmed;
    }
  }

  // analysisMode (enum)
  if (config.analysisMode !== undefined && config.analysisMode !== null) {
    if (typeof config.analysisMode !== "string") {
      return {
        ok: false,
        error: String(
          i18n.t("assistant:parse.analysisModeInvalid", {
            values: VALID_ANALYSIS_MODES.join(", "),
          }),
        ),
      };
    }
    if (VALID_ANALYSIS_MODES.includes(config.analysisMode)) {
      taskConfig.analysisMode = config.analysisMode as AnalysisMode;
    }
  }

  // channelIds (string array)
  if (config.channelIds !== undefined && config.channelIds !== null) {
    if (!Array.isArray(config.channelIds)) {
      return { ok: false, error: String(i18n.t("assistant:parse.channelIdsNotArray")) };
    }
    const validIds = config.channelIds.filter((id): id is string => typeof id === "string" && id.trim() !== "");
    if (validIds.length > 0) {
      taskConfig.channelIds = validIds;
    }
  }

  // description (optional string)
  if (config.description !== undefined && config.description !== null) {
    if (typeof config.description === "string") {
      taskConfig.description = config.description;
    }
  }

  // analysisTimeRange (optional canonical task range)
  if (config.analysisTimeRange !== undefined && config.analysisTimeRange !== null) {
    if (
      typeof config.analysisTimeRange === "string"
      && VALID_ANALYSIS_TIME_RANGES.includes(config.analysisTimeRange as AnalysisTimeRange)
    ) {
      taskConfig.analysisTimeRange = config.analysisTimeRange as AnalysisTimeRange;
    }
  }

  // includeInTimeline (optional bool; event-mode time-planning visibility)
  if (config.includeInTimeline !== undefined && config.includeInTimeline !== null) {
    if (typeof config.includeInTimeline !== "boolean") {
      return {
        ok: false,
        error: String(i18n.t("assistant:parse.includeInTimelineNotBoolean")),
      };
    }
    taskConfig.includeInTimeline = config.includeInTimeline;
  }

  return {
    ok: true,
    data: { message, taskConfig },
  };
}
