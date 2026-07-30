import { useCallback } from "react";
import { useParams } from "react-router-dom";
import i18n from "../i18n";
import { localizeTaskPreset } from "../domain/tasks/localizeTaskPreset";
import type { TaskFormState, TaskTemplatePreset } from "../types";
import { usePersistedState } from "./usePersistedState";
import { chatEditorFormStorageKey } from "../domain/tasks/chatEditorPersistedKeys";
import { DEFAULT_PROJECT_WAVE_INTERVAL_SECONDS } from "../domain/tasks/scheduleDefaults";

/** Local alias of `TaskFormState` (SoT in `types/taskFormFields`). */
export type EditorFormFields = TaskFormState;

/** Shared default for ChatEditor fields and `DEFAULT_FORM_STATE`. */
export const INITIAL_EDITOR_FIELDS: EditorFormFields = {
  name: "",
  description: "",
  promptTemplate: "",
  analysisMode: "leaderboard",
  analysisTimeRange: "1d",
  channelIds: [],
  scheduleType: "seconds_10",
  scheduleValue: null,
  rrule: "",
  eventStartTime: "",
  eventEndTime: "",
  eventIsAllDay: false,
  eventLocation: "",
  eventDescription: "",
  includeInTimeline: true,
  projectWaveIntervalSeconds: null,
  batchOverlapCount: null,
  analysisTriggerThreshold: null,
  analysisBatchMessageLimit: null,
  analysisStrategyMode: null,
  worksetId: null,
};

interface UseEditorFieldsReturn {
  formState: EditorFormFields;
  setFormState: React.Dispatch<React.SetStateAction<EditorFormFields>>;
  updateField: <K extends keyof EditorFormFields>(field: K, value: EditorFormFields[K]) => void;
  applyPreset: (preset: TaskTemplatePreset) => void;
}

/** Manages field state for the ChatEditor task form. */
export function useEditorFields(): UseEditorFieldsReturn {
  const { taskId } = useParams<{ taskId: string }>();
  const [formState, setFormState] = usePersistedState<EditorFormFields>(
    chatEditorFormStorageKey(taskId),
    INITIAL_EDITOR_FIELDS,
    { storage: "session", persistDebounceMs: 400 },
  );
  const updateField = useCallback(
    <K extends keyof EditorFormFields>(field: K, value: EditorFormFields[K]) => {
      setFormState((prev) => ({ ...prev, [field]: value }));
    },
    [setFormState],
  );
  const applyPreset = useCallback((preset: TaskTemplatePreset) => {
    const localized = localizeTaskPreset(preset, i18n.t.bind(i18n));
    setFormState((prev) => {
      const nextMode = localized.analysisMode;
      const next: EditorFormFields = {
        ...prev,
        name: localized.name,
        description: localized.description,
        promptTemplate: localized.promptTemplate,
        analysisMode: nextMode,
        analysisTimeRange: localized.defaultAnalysisTimeRange,
      };
      if (nextMode === "project" && prev.scheduleType === "seconds_10") {
        next.scheduleType = "hourly";
      }
      if (nextMode === "project" && next.projectWaveIntervalSeconds == null) {
        next.projectWaveIntervalSeconds = DEFAULT_PROJECT_WAVE_INTERVAL_SECONDS;
      }
      return next;
    });
  }, [setFormState]);
  return { formState, setFormState, updateField, applyPreset };
}
