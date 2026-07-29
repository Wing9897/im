import type { AnalysisMode } from "../types";

interface EditorValidationInput {
  name: string;
  promptTemplate: string;
  channelIds: string[];
  rrule: string;
  analysisMode: AnalysisMode;
}

interface EditorValidationResult {
  canSave: boolean;
}

function computeCanSave(fields: EditorValidationInput, isSaving: boolean): boolean {
  if (fields.analysisMode === "recurring") {
    return Boolean(fields.name.trim() && fields.rrule.trim() && !isSaving);
  }
  if (fields.analysisMode === "calendar_task") {
    return Boolean(fields.name.trim() && !isSaving);
  }
  return Boolean(
    fields.name.trim() &&
      fields.promptTemplate.trim() &&
      fields.channelIds.length > 0 &&
      !isSaving,
  );
}

/** Validates whether the ChatEditor form can be saved. */
export function useTaskFormValidationEditor(
  fields: EditorValidationInput,
  isSaving: boolean,
): EditorValidationResult {
  return { canSave: computeCanSave(fields, isSaving) };
}
