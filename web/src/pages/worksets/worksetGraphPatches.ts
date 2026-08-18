/**
 * Shared PATCH helpers for pipeline click-to-connect, drag-to-connect, gate
 * icons, and the point settings modal.
 */

import { persistAssistantDefaultWorksetId } from "../../speech";
import { updateItem } from "../../api/items";
import { updateTask } from "../../api/tasks";
import { updateWorkset } from "../../api/worksets";
import { notifyPrefFromChecked, notifyPrefChecked } from "../../domain/notify/notifyPref";
import {
  PIPELINE_PAGE,
  assistantOwnerWorksetId,
  taskCalendarWriteEnabled,
  taskIntelEnabled,
  taskOwnerWorksetId,
  taskTimelineEnabled,
  worksetExternalOn,
  worksetNotifyOn,
  type PipelineGateKind,
  type PipelineGraph,
  type PipelinePoint,
  type PipelineTaskInput,
} from "../../domain/worksets/worksetPipelineGraph";
import {
  isLegalConnectPair,
  nextItemWorksetId,
  nextTaskChannelIds,
  nextTaskWorksetId,
  pipelinePairConnected,
  pipelinePointsFromConnection,
  type PipelineConnectData,
} from "../../domain/worksets/worksetPipelineConnect";

export type GraphPatchDeps = {
  refreshTasks: () => Promise<unknown> | void;
  refreshWorksets: () => Promise<unknown> | void;
  reloadGraph: () => void;
  onError: (error: unknown) => void;
};

export type PipelineConnectResult = "connected" | "disconnected" | "illegal";

export type PipelineGateToggleResult = "toggled" | "ignored";

export function taskPatchPayload(task: PipelineTaskInput, fields: Record<string, unknown>) {
  return {
    name: task.name,
    promptTemplate: task.promptTemplate ?? "",
    ...fields,
  };
}

function run(promise: Promise<unknown>, deps: GraphPatchDeps, after?: () => void): Promise<void> {
  return promise
    .then(() => {
      after?.();
    })
    .catch((error) => {
      deps.onError(error);
    });
}

export function patchPipelineTask(
  task: PipelineTaskInput,
  fields: Record<string, unknown>,
  deps: GraphPatchDeps,
): Promise<void> {
  return run(updateTask(task.id, taskPatchPayload(task, fields)), deps, () => {
    void deps.refreshTasks();
  });
}

export function patchPipelineItemWorkset(
  itemId: string,
  worksetId: string,
  deps: GraphPatchDeps,
): Promise<void> {
  return run(updateItem(itemId, { worksetId }), deps, () => deps.reloadGraph());
}

export function patchPipelineWorksetFlags(
  worksetId: string,
  body: { notifyEnabled?: boolean; externalEnabled?: boolean },
  deps: GraphPatchDeps,
): Promise<void> {
  return run(updateWorkset(worksetId, body), deps, () => {
    void deps.refreshWorksets();
  });
}

function taskOf(data: PipelineConnectData, point: PipelinePoint): PipelineTaskInput | undefined {
  return data.tasks.find((row) => row.id === point.entityId);
}

/**
 * Toggle an enable-state icon on a point. Status-only icons (item calendar)
 * return `"ignored"`. Uses the same PATCH fields as the settings modal.
 */
export async function applyPipelineGateToggle(
  point: PipelinePoint,
  kind: PipelineGateKind,
  data: PipelineConnectData,
  deps: GraphPatchDeps,
): Promise<PipelineGateToggleResult> {
  if (point.kind === "task") {
    const task = taskOf(data, point);
    if (!task) return "ignored";
    if (kind === "calendar") {
      await patchPipelineTask(task, { includeInTimeline: !taskTimelineEnabled(task) }, deps);
      return "toggled";
    }
    if (kind === "calendarWrite") {
      if (task.analysisMode !== "agent") return "ignored";
      await patchPipelineTask(
        task,
        { outputCalendar: !taskCalendarWriteEnabled(task) },
        deps,
      );
      return "toggled";
    }
    if (kind === "notify") {
      await patchPipelineTask(
        task,
        { notifyPref: notifyPrefFromChecked(!notifyPrefChecked(task.notifyPref)) },
        deps,
      );
      return "toggled";
    }
    if (kind === "intel") {
      if (task.analysisMode === "leaderboard") return "ignored";
      await patchPipelineTask(task, { outputAnalysisEvents: !taskIntelEnabled(task) }, deps);
      return "toggled";
    }
    return "ignored";
  }

  if (point.kind === "workset") {
    const workset = data.worksets.find((row) => row.id === point.entityId);
    if (!workset) return "ignored";
    if (kind === "notify") {
      await patchPipelineWorksetFlags(workset.id, { notifyEnabled: !worksetNotifyOn(workset) }, deps);
      return "toggled";
    }
    if (kind === "external") {
      await patchPipelineWorksetFlags(
        workset.id,
        { externalEnabled: !worksetExternalOn(workset) },
        deps,
      );
      return "toggled";
    }
    return "ignored";
  }

  return "ignored";
}

/**
 * Toggle the relationship for a legal pair. Illegal pairs return `"illegal"`
 * without writing. Already-connected legal pairs disconnect.
 */
export async function applyPipelineConnect(
  from: PipelinePoint,
  to: PipelinePoint,
  data: PipelineConnectData,
  deps: GraphPatchDeps,
): Promise<PipelineConnectResult> {
  if (!isLegalConnectPair(from, to)) return "illegal";
  const connected = pipelinePairConnected(from, to, data);
  const points = [from, to];
  const source = points.find((point) => point.kind === "source");
  const taskPoint = points.find((point) => point.kind === "task");
  const workset = points.find((point) => point.kind === "workset");
  const item = points.find((point) => point.kind === "item");
  const page = points.find((point) => point.kind === "page");

  if (source && taskPoint) {
    const task = taskOf(data, taskPoint);
    if (!task) return "illegal";
    await patchPipelineTask(
      task,
      { channelIds: nextTaskChannelIds(task, source.entityId, data, !connected) },
      deps,
    );
    return connected ? "disconnected" : "connected";
  }

  if (taskPoint && workset) {
    const task = taskOf(data, taskPoint);
    if (!task) return "illegal";
    const current = taskOwnerWorksetId(task);
    const nextWorksetId = nextTaskWorksetId(current, workset.entityId);
    if (nextWorksetId !== current) {
      await patchPipelineTask(task, { worksetId: nextWorksetId }, deps);
    }
    return connected ? "disconnected" : "connected";
  }

  if (item && workset) {
    const owner = data.items.find((entry) => entry.id === item.entityId);
    if (!owner) return "illegal";
    const next = nextItemWorksetId(owner.worksetId, workset.entityId);
    if (next !== owner.worksetId) {
      await patchPipelineItemWorkset(owner.id, next, deps);
    }
    return connected ? "disconnected" : "connected";
  }

  if (page?.id === PIPELINE_PAGE.assistant && workset) {
    const current = assistantOwnerWorksetId(data.assistantDefaultWorksetId);
    const next = nextItemWorksetId(current, workset.entityId);
    if (next !== current) {
      persistAssistantDefaultWorksetId(next);
      deps.reloadGraph();
    }
    return connected ? "disconnected" : "connected";
  }

  return "illegal";
}

/**
 * Drag-to-connect: legal pairs PATCH like click-connect, but an already-live
 * edge is a no-op (click-toggle still disconnects). Illegal pairs do not write.
 */
export async function applyPipelineHandleConnect(
  connection: { sourceHandle?: string | null; targetHandle?: string | null },
  graph: PipelineGraph,
  data: PipelineConnectData,
  deps: GraphPatchDeps,
): Promise<PipelineConnectResult> {
  const pair = pipelinePointsFromConnection(connection, graph);
  if (!pair || !isLegalConnectPair(pair[0], pair[1])) return "illegal";
  if (pipelinePairConnected(pair[0], pair[1], data)) return "connected";
  return applyPipelineConnect(pair[0], pair[1], data, deps);
}
