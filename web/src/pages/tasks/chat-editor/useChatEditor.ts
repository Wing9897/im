import { useCallback, useEffect, useRef, useState } from "react";
import type { ChannelWithSource, TaskTemplatePreset } from "../../../types";
import { useChannelsWithSources } from "../../../hooks/useChannelsWithSources";
import {
  useTaskEditorState,
  type TaskFormState,
} from "../../../hooks/useTaskEditorState";
import { useTaskPersistence } from "../../../hooks/useTaskPersistence";
import {
  applyConfigToFormState,
  buildCurrentTaskPayload,
} from "../../../domain/tasks/taskFormUtils";
import { registerTaskEditorDraftBridge } from "../../../domain/tasks/taskEditorDraftBridge";
import i18n from "../../../i18n";

export type { TaskFormState, ScheduleType } from "../../../hooks/useTaskEditorState";

export interface UseChatEditorReturn {
  formState: TaskFormState;
  updateField: <K extends keyof TaskFormState>(field: K, value: TaskFormState[K]) => void;
  error: string | null;
  save: () => Promise<void>;
  canSave: boolean;
  saveBlockReason: string | null;
  isSaving: boolean;
  applyPreset: (preset: TaskTemplatePreset) => void;
  channels: ChannelWithSource[];
}

/**
 * Task create/edit orchestration — form + persistence + system-assistant draft bridge.
 * Page-local advisor chat was removed; fill-form goes through the system bar assistant.
 */
export function useChatEditor(): UseChatEditorReturn {
  const {
    channels,
    error: channelsError,
  } = useChannelsWithSources({ toastOnError: false });

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [isSavingState, setIsSavingState] = useState(false);
  const {
    formState,
    setFormState,
    updateField,
    applyPreset,
    canSave,
    saveBlockReason,
  } = useTaskEditorState({
    isSaving: isSavingState,
  });
  const formStateRef = useRef(formState);
  formStateRef.current = formState;

  const [error, setError] = useState<string | null>(null);

  const onTaskConfig = useCallback(
    (config: Partial<TaskFormState>) => {
      setFormState((prev) => applyConfigToFormState(prev, config));
    },
    [setFormState],
  );

  // Global assistant (system bar) may consult the task advisor while this editor is mounted.
  useEffect(() => {
    return registerTaskEditorDraftBridge({
      getCurrentTask: () => buildCurrentTaskPayload(formStateRef.current),
      applyTaskConfig: onTaskConfig,
    });
  }, [onTaskConfig]);

  const onPersistenceError = useCallback((message: string) => {
    setError(message);
  }, []);

  const { save, isSaving } = useTaskPersistence({
    formState,
    setFormState,
    isMountedRef,
    onError: onPersistenceError,
  });

  useEffect(() => {
    setIsSavingState(isSaving);
  }, [isSaving]);

  useEffect(() => {
    if (channelsError) {
      setError(String(i18n.t("tasks:editor.channelsLoadError")));
    }
  }, [channelsError]);

  return {
    formState,
    updateField,
    error,
    save,
    canSave,
    saveBlockReason,
    isSaving,
    applyPreset,
    channels,
  };
}
