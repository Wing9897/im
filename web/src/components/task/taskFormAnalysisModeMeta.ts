import type { AnalysisMode } from "../../types";
import i18n from "../../i18n";
import {
  ANALYSIS_MODE_ORDER,
  analysisModeHidesPromptAndChannel,
  analysisModeShowsRruleFields,
  getAnalysisModeCapabilities,
} from "../../domain/tasks/analysisModeCapabilities";

type TaskFormAnalysisModeMeta = {
  displayLabel: string;
  modeOptionLabel: string;
  modeDescription: string;
  promptLabel: string;
  promptPlaceholder: string;
  promptHint: string;
  /** When true, the mode uses recurring-task fields instead of analysis fields */
  isRecurringMode?: boolean;
  /** Filter-only bucket (no AI, no RRULE); still hides prompt/channel fields. */
  isCalendarTaskMode?: boolean;
  /** Whether this mode hides prompt/channel fields (e.g., recurring / calendar_task) */
  hidesPromptAndChannel?: boolean;
};

export const taskFormAnalysisModeOrder: AnalysisMode[] = [...ANALYSIS_MODE_ORDER];

export function getTaskFormAnalysisModeMeta(
  analysisMode: AnalysisMode,
): TaskFormAnalysisModeMeta {
  const prefix = `tasks.modes.${analysisMode}`;
  const caps = getAnalysisModeCapabilities(analysisMode)!;
  return {
    displayLabel: String(i18n.t(`${prefix}.displayLabel`)),
    modeOptionLabel: String(i18n.t(`${prefix}.modeOptionLabel`)),
    modeDescription: String(i18n.t(`${prefix}.modeDescription`)),
    promptLabel: String(i18n.t(`${prefix}.promptLabel`)),
    promptPlaceholder: String(i18n.t(`${prefix}.promptPlaceholder`)),
    promptHint: String(i18n.t(`${prefix}.promptHint`)),
    isRecurringMode: analysisModeShowsRruleFields(analysisMode) || undefined,
    isCalendarTaskMode: caps.pipeline === "filter_bucket" || undefined,
    hidesPromptAndChannel: analysisModeHidesPromptAndChannel(analysisMode) || undefined,
  };
}
