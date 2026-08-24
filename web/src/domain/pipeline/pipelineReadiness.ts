import { isAnalysisMode } from "../tasks/analysisModeCapabilities";

/** Four-state onboarding machine for the analysis pipeline (not FirstRun). */
export const PIPELINE_READINESS_STATES = [
  "no_sources",
  "no_active_task",
  "no_events",
  "complete",
] as const;

export type PipelineReadinessState = (typeof PIPELINE_READINESS_STATES)[number];

export interface PipelineReadinessInput {
  sourceCount: number;
  activeAnalysisTaskCount: number;
  analysisEventCount: number;
  /**
   * True after the pipeline has once reached `complete`. Cleared when sources
   * or active analysis tasks are wiped so the checklist can return.
   */
  everCompleted: boolean;
  /**
   * Optional checklist step only: a complete AI profile is bound to the
   * assistant global slot. Never gates `state` / `showChecklist`.
   */
  assistantSlotReady?: boolean;
}

export interface PipelineReadiness {
  state: PipelineReadinessState;
  showChecklist: boolean;
  assistantSlotReady: boolean;
}

/**
 * Optional onboarding: assistant global slot points at a complete profile.
 * Unbound / blank ids stay unbound — never invent `__default__`.
 */
export function isAssistantOnboardingDone(input: {
  slots: readonly { slot: string; profileId?: string | null }[];
  profiles: readonly { id: string; complete: boolean }[];
}): boolean {
  const id = (
    input.slots.find((s) => s.slot === "assistant")?.profileId ?? ""
  ).trim();
  if (!id) return false;
  return input.profiles.some((p) => p.id === id && p.complete);
}

export function countActiveAnalysisTasks(
  tasks: readonly { isActive?: boolean; analysisMode?: string | null }[],
): number {
  let count = 0;
  for (const task of tasks) {
    if (task.isActive === true && isAnalysisMode(task.analysisMode)) {
      count += 1;
    }
  }
  return count;
}

/**
 * Derive pipeline checklist visibility from live counts.
 *
 * Complete hides the checklist even if analysis events are later dismissed,
 * until sources or active analysis tasks are emptied.
 */
export function pipelineReadiness(input: PipelineReadinessInput): PipelineReadiness {
  const sourceCount = Math.max(0, input.sourceCount);
  const activeAnalysisTaskCount = Math.max(0, input.activeAnalysisTaskCount);
  const analysisEventCount = Math.max(0, input.analysisEventCount);
  const assistantSlotReady = input.assistantSlotReady === true;

  if (sourceCount <= 0) {
    return { state: "no_sources", showChecklist: true, assistantSlotReady };
  }
  if (activeAnalysisTaskCount <= 0) {
    return { state: "no_active_task", showChecklist: true, assistantSlotReady };
  }
  if (analysisEventCount > 0) {
    return { state: "complete", showChecklist: false, assistantSlotReady };
  }
  if (input.everCompleted) {
    return { state: "complete", showChecklist: false, assistantSlotReady };
  }
  return { state: "no_events", showChecklist: true, assistantSlotReady };
}

/** Persist “ever completed” only while the pipeline still has sources + tasks. */
export function nextPipelineEverCompleted(
  input: Omit<PipelineReadinessInput, "everCompleted"> & { everCompleted: boolean },
): boolean {
  if (input.sourceCount <= 0 || input.activeAnalysisTaskCount <= 0) {
    return false;
  }
  if (input.analysisEventCount > 0) {
    return true;
  }
  return input.everCompleted;
}
