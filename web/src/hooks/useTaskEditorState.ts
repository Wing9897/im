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
import {
  isUnmappedTriggerSchedule,
  presetToTriggerRrule,
} from "../domain/tasks/triggerSchedule";
import type { AnalysisMode, TaskFormState, TaskTemplatePreset } from "../types";
import { usePersistedState } from "./usePersistedState";

export type { ScheduleType, TaskFormState } from "../types";
export type EditorFormFields = TaskFormState;

export const INITIAL_EDITOR_FIELDS: EditorFormFields = {
  name: "",
  description: "",
  promptTemplate: "",
  webSearchQuery: "",
  analysisMode: "recurring",
  analysisTimeRange: "1d",
  channelIds: [],
  scheduleType: "seconds_10",
  scheduleValue: null,
  scheduleRrule: "FREQ=SECONDLY;INTERVAL=10",
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
  triggerMode: "message_cursor",
  capCalendarRead: true,
  capCalendarWrites: true,
  capWebSearch: false,
  capForceWebSearch: false,
  capReadAnalysisEvents: true,
  capReadItems: true,
  outputCalendar: true,
  outputAnalysisEvents: false,
};

export const DEFAULT_FORM_STATE: TaskFormState = INITIAL_EDITOR_FIELDS;

type SaveGateFields = {
  name: string;
  promptTemplate: string;
  webSearchQuery: string;
  channelIds: string[];
  rrule: string;
  analysisMode: AnalysisMode;
  eventIsAllDay: boolean;
  eventStartTime: string;
  triggerMode?: string;
  outputCalendar?: boolean;
  outputAnalysisEvents?: boolean;
};

function computeCanSave(fields: SaveGateFields, isSaving: boolean): boolean {
  return getTaskSaveBlockReason(fields, isSaving) == null;
}

/** Localized reason the save button stays disabled; null when save is allowed. */
export function getTaskSaveBlockReason(
  fields: SaveGateFields,
  isSaving = false,
): string | null {
  if (isSaving) return String(i18n.t("tasks.editor.saveNeeds.saving"));
  if (!fields.name.trim()) return String(i18n.t("tasks.editor.saveNeeds.name"));

  if (fields.analysisMode === "recurring") {
    if (!fields.rrule.trim()) return String(i18n.t("tasks.editor.saveNeeds.rrule"));
    const hasStart =
      fields.eventIsAllDay || Boolean(fields.eventStartTime.trim());
    if (!hasStart) return String(i18n.t("tasks.editor.saveNeeds.eventStart"));
    return null;
  }

  if (fields.analysisMode === "agent") {
    if (!fields.promptTemplate.trim()) {
      return String(i18n.t("tasks.editor.saveNeeds.prompt"));
    }
    if (!fields.outputCalendar && !fields.outputAnalysisEvents) {
      return String(i18n.t("tasks.editor.saveNeeds.agentOutput"));
    }
    if (fields.triggerMode === "message_cursor" && fields.channelIds.length === 0) {
      return String(i18n.t("tasks.editor.saveNeeds.channels"));
    }
    return null;
  }

  if (!fields.promptTemplate.trim()) {
    return String(i18n.t("tasks.editor.saveNeeds.prompt"));
  }
  if (fields.channelIds.length === 0) {
    return String(i18n.t("tasks.editor.saveNeeds.channels"));
  }
  return null;
}

export interface UseTaskEditorStateReturn {
  formState: TaskFormState;
  setFormState: React.Dispatch<React.SetStateAction<TaskFormState>>;
  updateField: <K extends keyof TaskFormState>(field: K, value: TaskFormState[K]) => void;
  applyPreset: (preset: TaskTemplatePreset) => void;
  canSave: boolean;
  /** Why save is blocked (for disabled button title / inline hint). */
  saveBlockReason: string | null;
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
      setFormState((prev) => {
        const next = { ...prev, [field]: value };
        if (field === "scheduleType" || field === "scheduleValue") {
          next.scheduleRrule = presetToTriggerRrule(
            next.scheduleType,
            next.scheduleValue,
          );
        }
        return next;
      });
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
          webSearchQuery: "",
        };
        if (
          nextMode === "agent" &&
          prev.scheduleType === "seconds_10" &&
          !isUnmappedTriggerSchedule(prev.scheduleType, prev.scheduleValue, prev.scheduleRrule)
        ) {
          next.scheduleType = "hourly";
          next.scheduleRrule = presetToTriggerRrule("hourly", next.scheduleValue);
        }
        if (nextMode === "agent" && next.projectWaveIntervalSeconds == null) {
          next.projectWaveIntervalSeconds = DEFAULT_PROJECT_WAVE_INTERVAL_SECONDS;
        }
        return next;
      });
    },
    [setFormState],
  );

  const saveGateFields = {
    name: formState.name,
    promptTemplate: formState.promptTemplate,
    webSearchQuery: formState.webSearchQuery,
    channelIds: formState.channelIds,
    rrule: formState.rrule,
    analysisMode: formState.analysisMode,
    eventIsAllDay: formState.eventIsAllDay,
    eventStartTime: formState.eventStartTime,
    triggerMode: formState.triggerMode,
    outputCalendar: formState.outputCalendar,
    outputAnalysisEvents: formState.outputAnalysisEvents,
  };
  const saveBlockReason = getTaskSaveBlockReason(saveGateFields, isSaving);
  const canSave = computeCanSave(saveGateFields, isSaving);

  return {
    formState,
    setFormState,
    updateField,
    applyPreset,
    canSave,
    saveBlockReason,
  };
}
