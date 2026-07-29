import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { validateScheduleValue } from "../ScheduleInput";
import { ChatEditorForm } from "./ChatEditorForm";
import { ChatEditorToolbar } from "./ChatEditorToolbar";
import { useChatEditor } from "./useChatEditor";
import { listTaskTemplatePresets } from "../../../api/tasks";
import { TaskTemplatePresetDialog } from "../../../components/task/TaskTemplatePresetDialog";
import { ChannelSelectorDialog } from "../../../components/dialogs/ChannelSelectorDialog";
import type { TaskTemplatePreset } from "../../../types";
import type { TemplateUsageMap } from "../../../components/task/taskTemplateTypes";
import { usePersistedState } from "../../../hooks/usePersistedState";
import { CHAT_EDITOR_TEMPLATE_USAGE_KEY } from "../../../domain/tasks/chatEditorPersistedKeys";
import { analysisModeSupportsTaskPresets } from "../../../domain/tasks/taskPresetModes";

export function ChatEditorPage() {
  const navigate = useNavigate();
  const { taskId } = useParams<{ taskId: string }>();
  const isEditMode = Boolean(taskId);

  const {
    formState,
    updateField,
    error,
    save,
    canSave,
    isSaving,
    applyPreset,
    channels,
  } = useChatEditor();

  const [showChannelDialog, setShowChannelDialog] = useState(false);
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [presets, setPresets] = useState<TaskTemplatePreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [presetUsage, setPresetUsage] = usePersistedState<TemplateUsageMap>(
    CHAT_EDITOR_TEMPLATE_USAGE_KEY,
    {},
  );

  const showPresets = analysisModeSupportsTaskPresets(formState.analysisMode);

  useEffect(() => {
    if (!showPresetDialog) return;
    let cancelled = false;
    setPresetsLoading(true);
    void (async () => {
      try {
        const loaded = await listTaskTemplatePresets();
        if (!cancelled) {
          setPresets(loaded);
          setSelectedPresetId((prev) => (prev === "" && loaded.length > 0 ? loaded[0].id : prev));
        }
      } catch {
        // Non-critical: presets may fail to load
      } finally {
        if (!cancelled) setPresetsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showPresetDialog]);

  useEffect(() => {
    if (!showPresets) setShowPresetDialog(false);
  }, [showPresets]);

  const scheduleError = validateScheduleValue(formState.scheduleType, formState.scheduleValue);
  const canSaveForm = canSave && !scheduleError;

  const handleBack = () => {
    navigate("/tasks");
  };

  const handlePresetApply = () => {
    const preset = presets.find((p) => p.id === selectedPresetId);
    if (!preset) return;

    applyPreset(preset);

    setPresetUsage((prev) => ({
      ...prev,
      [preset.id]: {
        useCount: (prev[preset.id]?.useCount ?? 0) + 1,
        lastUsedAt: new Date().toISOString(),
      },
    }));

    setShowPresetDialog(false);
  };

  const handleSave = () => {
    void save().catch(() => {});
  };

  return (
    <div className="grid h-[calc(100vh-var(--app-top-bar-height,48px))] grid-rows-[auto_1fr] overflow-hidden bg-[var(--surface-page,var(--surface-base))]">
      <ChatEditorToolbar
        isEditMode={isEditMode}
        canSaveForm={canSaveForm}
        isSaving={isSaving}
        showPresets={showPresets}
        onBack={handleBack}
        onSave={handleSave}
        onOpenPresetDialog={() => setShowPresetDialog(true)}
      />

      <div className="min-h-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-page-x pb-xl pt-sm">
          {error ? (
            <p className="mb-sm text-caption text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <ChatEditorForm
            formState={formState}
            updateField={updateField}
            channels={channels}
            onOpenChannelDialog={() => setShowChannelDialog(true)}
          />
        </div>
      </div>

      {showPresetDialog && (
        <TaskTemplatePresetDialog
          presets={presets}
          presetsLoading={presetsLoading}
          presetUsage={presetUsage}
          preferredAnalysisMode={formState.analysisMode}
          selectedPresetId={selectedPresetId}
          setSelectedPresetId={setSelectedPresetId}
          onApply={handlePresetApply}
          onClose={() => setShowPresetDialog(false)}
        />
      )}

      <ChannelSelectorDialog
        open={showChannelDialog}
        channels={channels}
        selectedChannelIds={formState.channelIds}
        onConfirm={(channelIds) => updateField("channelIds", channelIds)}
        onClose={() => setShowChannelDialog(false)}
      />
    </div>
  );
}
