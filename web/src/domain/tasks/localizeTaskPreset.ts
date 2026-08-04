import type { TFunction } from "i18next";
import type { TaskTemplatePreset } from "../../types";
import {
  isTaskAnalysisTimeRange,
  type TaskAnalysisTimeRange,
} from "./taskAnalysisTimeRange";

/**
 * Map preset windows onto task editor vocabulary (full DB allowlist).
 * Monitor query-only tokens (`12h`／`24h`) are not analysis windows — fall back to `1d`.
 */
export function normalizePresetTimeRange(
  value: string | null | undefined,
): TaskAnalysisTimeRange {
  if (isTaskAnalysisTimeRange(value)) {
    return value;
  }
  return "1d";
}

/** Localize builtin preset display + prompt fields by stable id (API strings are fallback). */
export function localizeTaskPreset(
  preset: TaskTemplatePreset,
  t: TFunction,
): TaskTemplatePreset {
  const base = `tasks.presets.${preset.id}`;
  return {
    ...preset,
    name: String(t(`${base}.name`, { defaultValue: preset.name })),
    description: String(t(`${base}.description`, { defaultValue: preset.description })),
    promptTemplate: String(
      t(`${base}.promptTemplate`, { defaultValue: preset.promptTemplate }),
    ),
    defaultAnalysisTimeRange: normalizePresetTimeRange(preset.defaultAnalysisTimeRange),
  };
}
