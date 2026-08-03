import type { TFunction } from "i18next";
import type { AnalysisTimeRange, TaskTemplatePreset } from "../../types";

/** Map preset windows onto editor vocabulary (`1d` | `7d` | `30d` | `all`). */
export function normalizePresetTimeRange(
  value: string | null | undefined,
): AnalysisTimeRange {
  if (value === "7d" || value === "30d" || value === "all" || value === "1d") {
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
