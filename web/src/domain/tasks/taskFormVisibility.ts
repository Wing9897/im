import type { AnalysisMode } from "../../types";
import {
  analysisModeHidesPromptAndChannel,
  analysisModeIsWebIntel,
  analysisModeRequiresChannels,
  analysisModeShowsOptionalChannels,
  analysisModeShowsRruleFields,
  webIntelMessageGateActive,
} from "./analysisModeCapabilities";

export interface TaskModeFieldVisibility {
  rruleFieldsVisible: boolean;
  promptFieldsVisible: boolean;
  channelFieldsVisible: boolean;
  /** Channels allowed but not required (web_intel timed vs message-gate). */
  channelsOptional: boolean;
  channelsRequired: boolean;
  /** Message analysisTimeRange chips (not used by web_intel Agent search). */
  analysisTimeRangeVisible: boolean;
  /** Timeline include toggle (event / project / web_intel). */
  timelineToggleVisible: boolean;
  /** Prompt is required to save (all AI modes with a prompt field). */
  promptRequired: boolean;
  isWebIntel: boolean;
  isProject: boolean;
  isRecurring: boolean;
}

/** Field visibility rules for ChatEditorForm by analysis mode. */
export function getTaskModeFieldVisibility(mode: AnalysisMode): TaskModeFieldVisibility {
  const hidesPromptAndChannel = analysisModeHidesPromptAndChannel(mode);
  const channelsRequired = analysisModeRequiresChannels(mode);
  const channelsOptional = analysisModeShowsOptionalChannels(mode);
  const isWebIntel = analysisModeIsWebIntel(mode);
  const promptFieldsVisible = !hidesPromptAndChannel;
  return {
    rruleFieldsVisible: analysisModeShowsRruleFields(mode),
    promptFieldsVisible,
    channelFieldsVisible:
      !hidesPromptAndChannel && (channelsRequired || channelsOptional),
    channelsOptional,
    channelsRequired,
    analysisTimeRangeVisible: promptFieldsVisible && !isWebIntel,
    timelineToggleVisible:
      mode === "intel_event" || mode === "project" || mode === "web_intel",
    promptRequired: promptFieldsVisible,
    isWebIntel,
    isProject: mode === "project",
    isRecurring: mode === "recurring",
  };
}

/** Whether web_intel message-gate overrides should show. */
export function taskShowsMessageBatchOverrides(
  mode: AnalysisMode,
  channelIds: readonly string[],
): boolean {
  return (
    mode === "intel_event" ||
    mode === "leaderboard" ||
    webIntelMessageGateActive(mode, channelIds)
  );
}
