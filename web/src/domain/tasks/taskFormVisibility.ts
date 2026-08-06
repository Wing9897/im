import type { AnalysisMode } from "../../types";
import {
  analysisModeHidesPromptAndChannel,
  analysisModeIsAgent,
  analysisModeRequiresChannels,
  analysisModeShowsOptionalChannels,
  analysisModeShowsRruleFields,
} from "./analysisModeCapabilities";
import type { AgentTaskPolicy } from "./agentTaskPolicy";
import {
  agentChannelsOptional,
  agentChannelsRequired,
  agentShowsMessageGateOverrides,
  agentShowsWaveInterval,
} from "./agentTaskPolicy";

export interface TaskModeFieldVisibility {
  rruleFieldsVisible: boolean;
  promptFieldsVisible: boolean;
  channelFieldsVisible: boolean;
  /** Channels allowed but not required. */
  channelsOptional: boolean;
  channelsRequired: boolean;
  /** Message analysisTimeRange chips (not used by agent search-oriented presets). */
  analysisTimeRangeVisible: boolean;
  /** Timeline include toggle (event / agent). */
  timelineToggleVisible: boolean;
  /** Prompt is required to save (all AI modes with a prompt field). */
  promptRequired: boolean;
  isAgent: boolean;
  isRecurring: boolean;
  showAgentPolicy: boolean;
  showWaveInterval: boolean;
  showMessageGateOverrides: boolean;
}

/** Field visibility rules for ChatEditorForm by analysis mode (+ optional agent policy). */
export function getTaskModeFieldVisibility(
  mode: AnalysisMode,
  policy?: AgentTaskPolicy | null,
  channelIds: readonly string[] = [],
): TaskModeFieldVisibility {
  const hidesPromptAndChannel = analysisModeHidesPromptAndChannel(mode);
  const isAgent = analysisModeIsAgent(mode);
  const promptFieldsVisible = !hidesPromptAndChannel;

  let channelsRequired = analysisModeRequiresChannels(mode);
  let channelsOptional = analysisModeShowsOptionalChannels(mode);
  let showWaveInterval = false;
  let showMessageGateOverrides = false;

  if (isAgent && policy) {
    channelsRequired = agentChannelsRequired(policy);
    channelsOptional = agentChannelsOptional(policy) && !channelsRequired;
    showWaveInterval = agentShowsWaveInterval(policy);
    showMessageGateOverrides = agentShowsMessageGateOverrides(policy, channelIds.length);
  }

  return {
    rruleFieldsVisible: analysisModeShowsRruleFields(mode),
    promptFieldsVisible,
    channelFieldsVisible:
      !hidesPromptAndChannel && (channelsRequired || channelsOptional),
    channelsOptional,
    channelsRequired,
    analysisTimeRangeVisible: promptFieldsVisible && !isAgent,
    timelineToggleVisible: mode === "intel_event" || isAgent,
    promptRequired: promptFieldsVisible,
    isAgent,
    isRecurring: mode === "recurring",
    showAgentPolicy: isAgent,
    showWaveInterval,
    showMessageGateOverrides,
  };
}

/** Whether message-batch / threshold overrides should show. */
export function taskShowsMessageBatchOverrides(
  mode: AnalysisMode,
  channelIds: readonly string[],
  policy?: AgentTaskPolicy | null,
): boolean {
  if (mode === "intel_event" || mode === "leaderboard") return true;
  if (analysisModeIsAgent(mode) && policy) {
    return agentShowsMessageGateOverrides(policy, channelIds.length);
  }
  return false;
}
