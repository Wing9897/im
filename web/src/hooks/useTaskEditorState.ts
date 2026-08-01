/**
 * Task editor state layer — session-persisted fields + save validation.
 * Pair with `useTaskPersistence` (save / hydrate).
 */
import { useCallback } from "react";
import { useParams } from "react-router-dom";
import i18n from "../i18n";
import { localizeTaskPreset } from "../domain/tasks/localizeTaskPreset";
import { chatEditorFormStorageKey } from "../domain/prefs";
import { DEFAULT_PROJECT_WAVE_INTERVAL_SECONDS } from "../domain/tasks/scheduleDefaults";
import type { AnalysisMode, TaskFormState, TaskTemplatePreset } from "../types";
import { usePersistedState } from "./usePersistedState";

export type { ScheduleType, TaskFormState } from "../types";
export type EditorFormFields = TaskFormState;

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

export const DEFAULT_FORM_STATE: TaskFormState = INITIAL_EDITOR_FIELDS;

function computeCanSave(
  fields: {
    name: string;
    promptTemplate: string;
    channelIds: string[];
    rrule: string;
    analysisMode: AnalysisMode;
  },
  isSaving: boolean,
): boolean {
  if (fields.analysisMode === "recurring") {
    return Boolean(fields.name.trim() && fields.rrule.trim() && !isSaving);
  }
  return Boolean(
    fields.name.trim() &&
      fields.promptTemplate.trim() &&
      fields.channelIds.length > 0 &&
      !isSaving,
  );
}

export interface UseTaskEditorStateReturn {
  formState: TaskFormState;
  setFormState: React.Dispatch<React.SetStateAction<TaskFormState>>;
  updateField: <K extends keyof TaskFormState>(field: K, value: TaskFormState[K]) => void;
  applyPreset: (preset: TaskTemplatePreset) => void;
  canSave: boolean;
}

interface UseTaskEditorStateOptions {
  isSaving?: boolean;
}

/** Session-persisted editor fields + `canSave` for Chat Editor create/edit. */
export function useTaskEditorState(
  options: UseTaskEditorStateOptions = {},
): UseTaskEditorStateReturn {
  const { isSaving = false } = options;
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

  const applyPreset = useCallback(
    (preset: TaskTemplatePreset) => {
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
    },
    [setFormState],
  );

  const canSave = computeCanSave(
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
