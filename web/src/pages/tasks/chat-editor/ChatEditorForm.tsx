/**
 * Task form for create/edit — numbered sections on one scroll (not a wizard).
 */
import { useEffect, useState } from "react";
import { getTaskModeFieldVisibility } from "../../../domain/tasks/taskFormUtils";
import type { LlmProfileGate } from "./useChatEditorLlmProfiles";
import type { ChannelWithSource } from "../../../types";
import type { TaskFormState } from "./useChatEditor";
import { ChatEditorIdentitySection } from "./ChatEditorIdentitySection";
import { ChatEditorScopeSection } from "./ChatEditorScopeSection";
import { ChatEditorWhenSection } from "./ChatEditorWhenSection";
import { ChatEditorOutputSection } from "./ChatEditorOutputSection";
import { ChatEditorOptionalFields } from "./ChatEditorOptionalFields";

interface ChatEditorFormProps {
  formState: TaskFormState;
  updateField: <K extends keyof TaskFormState>(field: K, value: TaskFormState[K]) => void;
  channels: ChannelWithSource[];
  onOpenChannelDialog: () => void;
  onLlmProfileGateChange?: (gate: LlmProfileGate) => void;
  taskId?: string;
}

export function ChatEditorForm({
  formState,
  updateField,
  channels,
  onOpenChannelDialog,
  onLlmProfileGateChange,
  taskId,
}: ChatEditorFormProps) {
  const agentPolicy = {
    triggerMode: formState.triggerMode,
    capCalendarRead: formState.capCalendarRead,
    capCalendarWrites: formState.capCalendarWrites,
    capWebSearch: formState.capWebSearch,
    capForceWebSearch: formState.capForceWebSearch,
    capReadAnalysisEvents: formState.capReadAnalysisEvents,
    capReadItems: formState.capReadItems,
    outputCalendar: formState.outputCalendar,
    outputAnalysisEvents: formState.outputAnalysisEvents,
  };
  const vis = getTaskModeFieldVisibility(
    formState.analysisMode,
    agentPolicy,
    formState.channelIds,
  );
  const advancedRelevant = vis.showMessageGateOverrides || vis.showWaveInterval;
  const [optionalOpen, setOptionalOpen] = useState(advancedRelevant);
  useEffect(() => {
    if (advancedRelevant) setOptionalOpen(true);
  }, [advancedRelevant]);

  return (
    <div className="flex flex-col gap-sm" data-testid="task-editor-form">
      <ChatEditorIdentitySection
        formState={formState}
        updateField={updateField}
        vis={vis}
        taskId={taskId}
        onLlmProfileGateChange={onLlmProfileGateChange}
      />
      <ChatEditorScopeSection
        formState={formState}
        updateField={updateField}
        vis={vis}
        channels={channels}
        onOpenChannelDialog={onOpenChannelDialog}
      />
      <ChatEditorWhenSection
        formState={formState}
        updateField={updateField}
        vis={vis}
      />
      <ChatEditorOutputSection
        formState={formState}
        updateField={updateField}
        vis={vis}
      />
      <ChatEditorOptionalFields
        formState={formState}
        updateField={updateField}
        vis={vis}
        optionalOpen={optionalOpen}
        onToggleOptional={() => setOptionalOpen((v) => !v)}
      />
    </div>
  );
}
