/** Ownership, output flags, and channel-id helpers for the household pipeline graph. */

import { normalizeNotifyPref } from "../notify/notifyPref";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import type {
  PipelineChannelRef,
  PipelineChannelSourceInput,
  PipelineTaskInput,
  PipelineWorksetInput,
} from "./pipelineGraphTypes";

export function taskOwnerWorksetId(task: PipelineTaskInput): string {
  const id = task.worksetId?.trim();
  return id || SYSTEM_WORKSET_ID;
}

/** Assistant graph ownership: the voice-page default workset (一般 when unset). */
export function assistantOwnerWorksetId(worksetId?: string | null): string {
  const id = worksetId?.trim();
  return id || SYSTEM_WORKSET_ID;
}

export function taskIntelEnabled(task: PipelineTaskInput): boolean {
  if (task.analysisMode === "leaderboard") return false;
  if (task.analysisMode === "agent") return task.outputAnalysisEvents === true;
  return task.outputAnalysisEvents !== false;
}

export function taskTimelineEnabled(task: PipelineTaskInput): boolean {
  return task.includeInTimeline !== false;
}

/** Agent-only write into 我的日程 (`outputCalendar`). Hidden on other modes. */
export function taskCalendarWriteEnabled(task: PipelineTaskInput): boolean {
  return task.analysisMode === "agent" && task.outputCalendar === true;
}

export function taskNotifyEnabled(
  task: PipelineTaskInput,
  worksetNotifyEnabled: boolean | null | undefined,
): boolean {
  if (normalizeNotifyPref(task.notifyPref) === "off") return false;
  return worksetNotifyEnabled !== false;
}

/** Task-point notify icon: the task's own pref, not AND-ed with the workset gate. */
export function taskNotifyPrefOn(task: PipelineTaskInput): boolean {
  return normalizeNotifyPref(task.notifyPref) !== "off";
}

export function worksetNotifyOn(workset: PipelineWorksetInput): boolean {
  return workset.notifyEnabled !== false;
}

export function worksetExternalOn(workset: PipelineWorksetInput): boolean {
  return workset.externalEnabled !== false;
}

export function normalizePipelineChannelId(ref: PipelineChannelRef): string {
  if (typeof ref === "string") return ref.trim();
  if (ref.id?.trim()) return ref.id.trim();
  const platform = ref.platform?.trim() ?? "";
  const platformId = ref.platformId?.trim() ?? "";
  if (platform && platformId) return `${platform}:${platformId}`;
  return "";
}

export function normalizePipelineChannelIds(
  refs: readonly PipelineChannelRef[] | null | undefined,
): string[] {
  const ids: string[] = [];
  for (const ref of refs ?? []) {
    const id = normalizePipelineChannelId(ref);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function sourceIdsForTaskChannels(
  channelIds: readonly string[],
  channels: readonly PipelineChannelSourceInput[],
): string[] {
  const byChannel = new Map(channels.map((row) => [row.channelId, row.sourceId]));
  const sourceIds: string[] = [];
  for (const channelId of channelIds) {
    const sourceId = byChannel.get(channelId);
    if (sourceId && !sourceIds.includes(sourceId)) sourceIds.push(sourceId);
  }
  return sourceIds;
}

export function channelIdsForSource(
  sourceId: string,
  channels: readonly PipelineChannelSourceInput[],
): string[] {
  return channels.filter((row) => row.sourceId === sourceId).map((row) => row.channelId);
}
