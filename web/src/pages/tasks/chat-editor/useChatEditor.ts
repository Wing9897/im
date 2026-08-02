import { useCallback, useEffect, useRef, useState } from "react";
import type { ChannelWithAccount, TaskTemplatePreset } from "../../../types";
import { useChannelsWithAccounts } from "../../../hooks/useChannelsWithAccounts";
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
  scheduleHydrating: boolean;
  scheduleHydrateError: string | null;
  retryScheduleHydrate: () => void;
  applyPreset: (preset: TaskTemplatePreset) => void;
  channels: ChannelWithAccount[];
}

/**
 * Task create/edit orchestration — form + persistence + system-assistant draft bridge.
 * Page-local advisor chat was removed; fill-form goes through the system bar assistant.
 */
export function useChatEditor(): UseChatEditorReturn {
  const {
    channels,
    error: channelsError,
  } = useChannelsWithAccounts({ toastOnError: false });

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

  const {
    save,
    isSaving,
    scheduleHydrating,
    scheduleHydrateError,
    retryScheduleHydrate,
  } = useTaskPersistence({
    formState,
    setFormState,
    isMountedRef,
    onError: onPersistenceError,
  });

  useEffect(() => {
    setIsSavingState(isSaving || scheduleHydrating);
  }, [isSaving, scheduleHydrating]);

  useEffect(() => {
    if (channelsError) {
      setError(String(i18n.t("tasks.editor.channelsLoadError")));
    }
  }, [channelsError]);

  return {
    formState,
    updateField,
    error,
    save,
    canSave: canSave && !scheduleHydrating,
    saveBlockReason,
    isSaving,
    scheduleHydrating,
    scheduleHydrateError,
    retryScheduleHydrate,
    applyPreset,
    channels,
  };
}
