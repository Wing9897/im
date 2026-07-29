/**
 * Editor-mode facade over useTaskFormState (keeps DEFAULT_FORM_STATE + UseTaskFormReturn).
 */
import type { TaskFormState, TaskTemplatePreset } from "../types";
import { INITIAL_EDITOR_FIELDS } from "./useTaskFormFields";
import { useTaskFormState } from "./useTaskFormState";

export type { ScheduleType, TaskFormState } from "../types";

export interface UseTaskFormReturn {
  formState: TaskFormState;
  setFormState: React.Dispatch<React.SetStateAction<TaskFormState>>;
  updateField: <K extends keyof TaskFormState>(field: K, value: TaskFormState[K]) => void;
  applyPreset: (preset: TaskTemplatePreset) => void;
  canSave: boolean;
}

export const DEFAULT_FORM_STATE: TaskFormState = INITIAL_EDITOR_FIELDS;

interface UseTaskFormOptions {
  isSaving?: boolean;
}

export function useTaskForm(options: UseTaskFormOptions = {}): UseTaskFormReturn {
  return useTaskFormState({ isSaving: options.isSaving ?? false });
}
