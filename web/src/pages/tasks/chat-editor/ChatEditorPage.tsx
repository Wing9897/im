import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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
import { CHAT_EDITOR_TEMPLATE_USAGE_KEY } from "../../../domain/prefs";
import { analysisModeSupportsTaskPresets } from "../../../domain/tasks/taskPresetModes";
import { stickyChromePageFillClass } from "../../../components/ui/pageChrome";

export function ChatEditorPage() {
  const navigate = useNavigate();
  const { taskId } = useParams<{ taskId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const isEditMode = Boolean(taskId);
  const worksetDeepLinkHandled = useRef(false);
  const presetDeepLinkHandled = useRef(false);

  const {
    formState,
    updateField,
    error,
    save,
    canSave,
    saveBlockReason,
    isSaving,
    applyPreset,
    channels,
  } = useChatEditor();

  const [showChannelDialog, setShowChannelDialog] = useState(false);
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [llmProfileGate, setLlmProfileGate] = useState<{
    ready: boolean;
    reason: string | null;
  }>({ ready: false, reason: null });
  const [presets, setPresets] = useState<TaskTemplatePreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [presetUsage, setPresetUsage] = usePersistedState<TemplateUsageMap>(
    CHAT_EDITOR_TEMPLATE_USAGE_KEY,
    {},
  );

  const showPresets = analysisModeSupportsTaskPresets(formState.analysisMode);

  // Deep-link from workset detail: /tasks/new?worksetId=…
  useEffect(() => {
    if (isEditMode) {
      worksetDeepLinkHandled.current = false;
      return;
    }
    const wid = searchParams.get("worksetId")?.trim();
    if (!wid) {
      worksetDeepLinkHandled.current = false;
      return;
    }
    if (worksetDeepLinkHandled.current) return;
    worksetDeepLinkHandled.current = true;
    updateField("worksetId", wid);
    const next = new URLSearchParams(searchParams);
    next.delete("worksetId");
    setSearchParams(next, { replace: true });
  }, [isEditMode, searchParams, setSearchParams, updateField]);

  // Deep-link from pipeline guide: /tasks/new?preset=key-insights
  useEffect(() => {
    if (isEditMode) {
      presetDeepLinkHandled.current = false;
      return;
    }
    const presetId = searchParams.get("preset")?.trim();
    if (!presetId) {
      presetDeepLinkHandled.current = false;
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await listTaskTemplatePresets();
        if (cancelled || presetDeepLinkHandled.current) return;
        const preset = loaded.find((row) => row.id === presetId);
        if (preset) applyPreset(preset);
      } catch {
        // Non-critical: user can still pick a preset in the dialog.
      } finally {
        if (cancelled) return;
        presetDeepLinkHandled.current = true;
        const next = new URLSearchParams(searchParams);
        next.delete("preset");
        setSearchParams(next, { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, searchParams, setSearchParams, applyPreset]);

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
  const canSaveForm = canSave && !scheduleError && llmProfileGate.ready;
  const disabledSaveReason =
    scheduleError ?? (!llmProfileGate.ready ? llmProfileGate.reason : null) ?? saveBlockReason;

  const handleBack = () => {
    navigate("/worksets?tab=tasks");
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
    <div className={stickyChromePageFillClass}>
      <ChatEditorToolbar
        isEditMode={isEditMode}
        canSaveForm={canSaveForm}
        saveBlockReason={disabledSaveReason}
        isSaving={isSaving}
        showPresets={showPresets}
        onBack={handleBack}
        onSave={handleSave}
        onOpenPresetDialog={() => setShowPresetDialog(true)}
      />

      <div className="im-auto-scrollbar min-h-0 overflow-y-auto [scrollbar-gutter:stable]">
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
            onLlmProfileGateChange={setLlmProfileGate}
            taskId={taskId}
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
