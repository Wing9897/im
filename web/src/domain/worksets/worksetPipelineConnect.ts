/**
 * Legal click-to-connect and drag-to-connect pairs for the household pipeline graph.
 * Ownership / subscription wires only — enable-state is icons, not connectable gates.
 */

import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import {
  PIPELINE_HANDLE_IN_SUFFIX,
  PIPELINE_HANDLE_OUT_SUFFIX,
  PIPELINE_PAGE,
  assistantOwnerWorksetId,
  channelIdsForSource,
  normalizePipelineChannelIds,
  sourceIdsForTaskChannels,
  taskOwnerWorksetId,
  type PipelineGraph,
  type PipelineGraphInput,
  type PipelinePoint,
  type PipelineTaskInput,
} from "./worksetPipelineGraph";

export type PipelineConnectData = Pick<
  PipelineGraphInput,
  "tasks" | "items" | "events" | "channels" | "worksets" | "assistantDefaultWorksetId"
>;

export type PipelineConnectHintKey =
  | "graphConnectHintTask"
  | "graphConnectHintSource"
  | "graphConnectHintItem"
  | "graphConnectHintWorkset"
  | "graphConnectHintAssistant";

function isAssistantPage(point: PipelinePoint): boolean {
  return point.kind === "page" && point.id === PIPELINE_PAGE.assistant;
}

function isWorksetTarget(point: PipelinePoint): boolean {
  return point.kind === "workset";
}

function directedLegal(from: PipelinePoint, to: PipelinePoint): boolean {
  if (from.kind === "more" || to.kind === "more") return false;
  if (from.kind === "source" && to.kind === "task") return true;
  if (from.kind === "task" && isWorksetTarget(to)) return true;
  if (from.kind === "item" && to.kind === "workset") return true;
  if (isAssistantPage(from) && isWorksetTarget(to)) return true;
  return false;
}

/** True when A and B are a legal ownership / subscription pair (either order). */
export function isLegalConnectPair(a: PipelinePoint, b: PipelinePoint): boolean {
  if (a.id === b.id) return false;
  return directedLegal(a, b) || directedLegal(b, a);
}

/** Point ids that may complete a click-to-connect from `from`. */
export function legalConnectTargetIds(from: PipelinePoint, graph: PipelineGraph): Set<string> {
  const ids = new Set<string>();
  for (const block of graph.blocks) {
    for (const point of block.points) {
      if (isLegalConnectPair(from, point)) ids.add(point.id);
    }
  }
  return ids;
}

function taskById(data: PipelineConnectData, taskId: string): PipelineTaskInput | undefined {
  return data.tasks.find((row) => row.id === taskId);
}

function orient(
  a: PipelinePoint,
  b: PipelinePoint,
  left: (point: PipelinePoint) => boolean,
  right: (point: PipelinePoint) => boolean,
): [PipelinePoint, PipelinePoint] | null {
  if (left(a) && right(b)) return [a, b];
  if (left(b) && right(a)) return [b, a];
  return null;
}

function taskSubscribesToSource(
  task: PipelineTaskInput,
  sourceId: string,
  data: PipelineConnectData,
): boolean {
  return sourceIdsForTaskChannels(
    normalizePipelineChannelIds(task.channelIds),
    data.channels ?? [],
  ).includes(sourceId);
}

/** Whether the pair already has a live ownership / subscription relationship. */
export function pipelinePairConnected(
  a: PipelinePoint,
  b: PipelinePoint,
  data: PipelineConnectData,
): boolean {
  const sourceTask = orient(a, b, (p) => p.kind === "source", (p) => p.kind === "task");
  if (sourceTask) {
    const task = taskById(data, sourceTask[1].entityId);
    return Boolean(task && taskSubscribesToSource(task, sourceTask[0].entityId, data));
  }

  const taskWorkset = orient(a, b, (p) => p.kind === "task", isWorksetTarget);
  if (taskWorkset) {
    const task = taskById(data, taskWorkset[0].entityId);
    if (!task) return false;
    return taskOwnerWorksetId(task) === taskWorkset[1].entityId;
  }

  const itemWorkset = orient(a, b, (p) => p.kind === "item", (p) => p.kind === "workset");
  if (itemWorkset) {
    const item = data.items.find((row) => row.id === itemWorkset[0].entityId);
    return Boolean(item && item.worksetId === itemWorkset[1].entityId);
  }

  const assistantWorkset = orient(a, b, isAssistantPage, isWorksetTarget);
  if (assistantWorkset) {
    return assistantOwnerWorksetId(data.assistantDefaultWorksetId) === assistantWorkset[1].entityId;
  }

  return false;
}

export function nextTaskChannelIds(
  task: PipelineTaskInput,
  sourceId: string,
  data: PipelineConnectData,
  subscribe: boolean,
): string[] {
  const current = normalizePipelineChannelIds(task.channelIds);
  const sourceChannels = channelIdsForSource(sourceId, data.channels ?? []);
  if (subscribe) {
    return [...current.filter((id) => !sourceChannels.includes(id)), ...sourceChannels];
  }
  return current.filter((id) => !sourceChannels.includes(id));
}

export function nextItemWorksetId(currentWorksetId: string, targetWorksetId: string): string {
  if (currentWorksetId === targetWorksetId) return SYSTEM_WORKSET_ID;
  return targetWorksetId;
}

export function nextTaskWorksetId(currentWorksetId: string, targetWorksetId: string): string {
  const current = currentWorksetId.trim() || SYSTEM_WORKSET_ID;
  if (current === targetWorksetId) return SYSTEM_WORKSET_ID;
  return targetWorksetId;
}

export function connectHintKey(from: PipelinePoint): PipelineConnectHintKey {
  if (from.kind === "source") return "graphConnectHintSource";
  if (from.kind === "item") return "graphConnectHintItem";
  if (isAssistantPage(from)) return "graphConnectHintAssistant";
  if (from.kind === "workset") return "graphConnectHintWorkset";
  return "graphConnectHintTask";
}

/** Point id encoded in a Handle id (`task:t1__out` → `task:t1`). */
export function pointIdFromPipelineHandle(handleId: string | null | undefined): string | null {
  if (!handleId) return null;
  if (handleId.endsWith(PIPELINE_HANDLE_OUT_SUFFIX)) {
    return handleId.slice(0, -PIPELINE_HANDLE_OUT_SUFFIX.length);
  }
  if (handleId.endsWith(PIPELINE_HANDLE_IN_SUFFIX)) {
    return handleId.slice(0, -PIPELINE_HANDLE_IN_SUFFIX.length);
  }
  return null;
}

export function findPipelinePoint(graph: PipelineGraph, pointId: string): PipelinePoint | undefined {
  for (const block of graph.blocks) {
    const point = block.points.find((row) => row.id === pointId);
    if (point) return point;
  }
  return undefined;
}

/** Resolve xyflow `onConnect` handles to the two pipeline points, or null. */
export function pipelinePointsFromConnection(
  connection: { sourceHandle?: string | null; targetHandle?: string | null },
  graph: PipelineGraph,
): [PipelinePoint, PipelinePoint] | null {
  const sourceId = pointIdFromPipelineHandle(connection.sourceHandle);
  const targetId = pointIdFromPipelineHandle(connection.targetHandle);
  if (!sourceId || !targetId || sourceId === targetId) return null;
  const from = findPipelinePoint(graph, sourceId);
  const to = findPipelinePoint(graph, targetId);
  if (!from || !to) return null;
  return [from, to];
}
