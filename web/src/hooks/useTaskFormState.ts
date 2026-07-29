/**
 * Composition hook — editor field state + save validation.
 */
import type { TaskTemplatePreset } from "../types";
import type { EditorFormFields } from "./useTaskFormFields";
import { useEditorFields } from "./useTaskFormFields";
import { useTaskFormValidationEditor } from "./useTaskFormValidation";

interface UseTaskFormStateOptions {
  isSaving?: boolean;
}

interface UseTaskFormStateReturn {
  formState: EditorFormFields;
  setFormState: React.Dispatch<React.SetStateAction<EditorFormFields>>;
  updateField: <K extends keyof EditorFormFields>(field: K, value: EditorFormFields[K]) => void;
  applyPreset: (preset: TaskTemplatePreset) => void;
  canSave: boolean;
}

export function useTaskFormState(options: UseTaskFormStateOptions = {}): UseTaskFormStateReturn {
  const { isSaving = false } = options;
  const { formState, setFormState, updateField, applyPreset } = useEditorFields();
  const { canSave } = useTaskFormValidationEditor(
    {
      name: formState.name,
      promptTemplate: formState.promptTemplate,
      channelIds: formState.channelIds,
      rrule: formState.rrule,
      analysisMode: formState.analysisMode,
    },
    isSaving,
  );
  return { formState, setFormState, updateField, applyPreset, canSave };
}
