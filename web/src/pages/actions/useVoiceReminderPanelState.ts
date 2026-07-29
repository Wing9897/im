import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../context/ToastContext";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import {
  USER_EVENTS_FILTER_ID,
  filterAssignableTimelineTasks,
} from "../../domain/timeline/userEvents";
import { useUserEventsFilterLabel } from "../../domain/timeline/useUserEventsFilterLabel";
import { createSpeechPorts, loadVoiceSettings, ttsSpeakOptionsFromVoiceSettings } from "../../speech";
import { logWarn } from "../../utils/logger";
import { buildPreviewSpeakText } from "../../voiceReminder/scanner";
import { announceVoiceReminder } from "../../voiceReminder/announce";
import {
  LEAD_OFFSET_OPTIONS,
  hydrateVoiceReminderSettings,
  loadVoiceReminderSettings,
  saveVoiceReminderSettings,
  type LeadOffsetMinutes,
  type VoiceReminderSettings,
} from "../../voiceReminder/settings";

function sameTaskIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

export interface ReminderSourceTask {
  id: string;
  name: string;
  source: "event" | "recurring" | "calendar_task" | "user";
}

/** State + handlers for the Actions → Voice reminder panel. */
export function useVoiceReminderPanelState() {
  const { t } = useTranslation("actions");
  const toast = useToast();
  const [settings, setSettings] = useState<VoiceReminderSettings>(() =>
    loadVoiceReminderSettings(),
  );
  const [draftTaskIds, setDraftTaskIds] = useState<string[]>(() => [
    ...loadVoiceReminderSettings().taskIds,
  ]);
  const { tasks, tasksLoading, taskLoadError } = useTaskCatalog();
  const userEventsLabel = useUserEventsFilterLabel();
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (taskLoadError) {
      logWarn("[VoiceReminderPanel] failed to load tasks", taskLoadError);
    }
  }, [taskLoadError]);

  useEffect(() => {
    let cancelled = false;
    void hydrateVoiceReminderSettings().then((loaded) => {
      if (!cancelled) {
        setSettings(loaded);
        setDraftTaskIds([...loaded.taskIds]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setDraftTaskIds([...settings.taskIds]);
  }, [settings.taskIds]);

  /** Timed sources: active event / recurring / calendar_task tasks, plus manual / assistant. */
  const sourceTasks = useMemo((): ReminderSourceTask[] => {
    const fromTasks = filterAssignableTimelineTasks(tasks, { activeOnly: true }).map(
      (task): ReminderSourceTask => ({
        id: task.id,
        name: task.name,
        source:
          task.analysisMode === "recurring"
            ? "recurring"
            : task.analysisMode === "calendar_task"
              ? "calendar_task"
              : "event",
      }),
    );
    return [
      ...fromTasks,
      {
        id: USER_EVENTS_FILTER_ID,
        name: userEventsLabel,
        source: "user",
      },
    ];
  }, [tasks, userEventsLabel]);

  const draftListenAll = draftTaskIds.length === 0;
  const draftSelectedCount = draftTaskIds.filter((id) =>
    sourceTasks.some((task) => task.id === id),
  ).length;
  const taskSelectionDirty = !sameTaskIds(draftTaskIds, settings.taskIds);

  const update = (patch: Partial<VoiceReminderSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void saveVoiceReminderSettings(next).then((ok) => {
        if (!ok) {
          toast?.showToast(t("voice.saveFailed"), "error");
          setSettings(prev);
          return;
        }
        setSettings(loadVoiceReminderSettings());
      });
      return next;
    });
  };

  const toggleLead = (offset: LeadOffsetMinutes) => {
    const has = settings.leadOffsetsMinutes.includes(offset);
    const next = has
      ? settings.leadOffsetsMinutes.filter((item) => item !== offset)
      : LEAD_OFFSET_OPTIONS.filter(
          (item) => item === offset || settings.leadOffsetsMinutes.includes(item),
        );
    update({ leadOffsetsMinutes: next });
  };

  const toggleDraftTask = (taskId: string) => {
    setDraftTaskIds((prev) => {
      const has = prev.includes(taskId);
      return has ? prev.filter((id) => id !== taskId) : [...prev, taskId];
    });
  };

  const selectAllDraftTasks = () => {
    setDraftTaskIds(sourceTasks.map((task) => task.id));
  };

  const clearDraftTaskFilter = () => {
    setDraftTaskIds([]);
  };

  const confirmTaskSelection = () => {
    if (!taskSelectionDirty) return;
    update({ taskIds: draftTaskIds });
  };

  const resetDraftTaskSelection = () => {
    setDraftTaskIds([...settings.taskIds]);
  };

  const handlePreview = () => {
    if (previewing) {
      return;
    }
    setPreviewing(true);
    const voice = loadVoiceSettings();
    const { tts } = createSpeechPorts();
    const lead = settings.leadOffsetsMinutes[0] ?? 60;
    void announceVoiceReminder(tts, buildPreviewSpeakText(lead), {
      ...ttsSpeakOptionsFromVoiceSettings(voice),
    })
      .catch(() => {})
      .finally(() => setPreviewing(false));
  };

  return {
    settings,
    update,
    toggleLead,
    previewing,
    handlePreview,
    tasksLoading,
    sourceTasks,
    draftTaskIds,
    draftListenAll,
    draftSelectedCount,
    taskSelectionDirty,
    toggleDraftTask,
    selectAllDraftTasks,
    clearDraftTaskFilter,
    confirmTaskSelection,
    resetDraftTaskSelection,
  };
}
