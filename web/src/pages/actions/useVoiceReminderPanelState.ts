import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../context/ToastContext";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import { filterAssignableTimelineTasks } from "../../domain/timeline/userEvents";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { useGeneralWorksetLabel } from "../../domain/timeline/useGeneralWorksetLabel";
import { type SourceFilterSelection } from "../../domain/tasks/sourceFilterSelection";
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

/** State + handlers for the Actions → Voice reminder panel. */
export function useVoiceReminderPanelState() {
  const { t } = useTranslation("actions");
  const toast = useToast();
  const [settings, setSettings] = useState<VoiceReminderSettings>(() =>
    loadVoiceReminderSettings(),
  );
  const { tasks, tasksLoading, taskLoadError, worksets } = useTaskCatalog();
  const generalWorksetLabel = useGeneralWorksetLabel();
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
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filterTasks = useMemo(
    () =>
      filterAssignableTimelineTasks(tasks, { activeOnly: true }).map((task) => ({
        id: task.id,
        name: task.name,
      })),
    [tasks],
  );

  const filterWorksets = useMemo(
    () =>
      worksets.map((ws) => ({
        id: ws.id,
        name: ws.id === SYSTEM_WORKSET_ID ? generalWorksetLabel : ws.name,
        isSystem: ws.isSystem,
      })),
    [worksets, generalWorksetLabel],
  );

  const expandTasks = useMemo(
    () =>
      tasks.map((task) => ({
        id: task.id,
        name: task.name,
        worksetId: task.worksetId ?? null,
        analysisMode: task.analysisMode ?? null,
      })),
    [tasks],
  );

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

  const setSourceFilter = (next: SourceFilterSelection) => {
    update({ sourceFilter: next });
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
    filterTasks,
    filterWorksets,
    expandTasks,
    setSourceFilter,
  };
}
