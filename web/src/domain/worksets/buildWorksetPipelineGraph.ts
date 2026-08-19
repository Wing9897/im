/** L1–L3 household pipeline: blocks, points, and ownership wires. */

import { normalizeNotifyPref } from "../notify/notifyPref";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { PIPELINE_BLOCK_COLUMN, PIPELINE_MAX_POINTS, type PipelineColumn } from "./pipelineConstants";
import {
  PIPELINE_BLOCK,
  PIPELINE_OUTPUT_DEFS,
  PIPELINE_PAGE,
  isPipelineLayerPortId,
  itemPointId,
  sourcePointId,
  taskPointId,
  worksetPointId,
} from "./pipelineIds";
import { buildPipelineLegendEdges } from "./pipelineGraphLegend";
import {
  pipelineEdge,
  type PipelineBlock,
  type PipelineBlockKind,
  type PipelineChannelRef,
  type PipelineChannelSourceInput,
  type PipelineEdge,
  type PipelineEventInput,
  type PipelineGate,
  type PipelineGateKind,
  type PipelineGraph,
  type PipelineGraphInput,
  type PipelineGraphLabels,
  type PipelineItemInput,
  type PipelinePoint,
  type PipelineTaskInput,
  type PipelineWorksetInput,
} from "./pipelineGraphTypes";

export type {
  PipelineBlock,
  PipelineBlockKind,
  PipelineChannelRef,
  PipelineChannelSourceInput,
  PipelineEdge,
  PipelineEventInput,
  PipelineGate,
  PipelineGateKind,
  PipelineGraph,
  PipelineGraphInput,
  PipelineGraphLabels,
  PipelineItemInput,
  PipelinePoint,
  PipelinePointKind,
  PipelineSourceInput,
  PipelineTaskInput,
  PipelineWorksetInput,
} from "./pipelineGraphTypes";

export { isPipelineOutputBlockKind, isPipelineOutputPage } from "./pipelineGraphTypes";

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

function itemHasLinkedCalendar(
  itemId: string,
  events: readonly PipelineEventInput[],
): boolean {
  return events.some((event) => event.itemId === itemId);
}

function gate(kind: PipelineGateKind, on: boolean, toggleable: boolean): PipelineGate {
  return { kind, on, toggleable };
}

function taskGates(task: PipelineTaskInput): PipelineGate[] {
  const gates: PipelineGate[] = [gate("calendar", taskTimelineEnabled(task), true)];
  if (task.analysisMode === "agent") {
    gates.push(gate("calendarWrite", taskCalendarWriteEnabled(task), true));
  }
  gates.push(gate("notify", taskNotifyPrefOn(task), true));
  if (task.analysisMode !== "leaderboard") {
    gates.push(gate("intel", taskIntelEnabled(task), true));
  }
  return gates;
}

function worksetGates(workset: PipelineWorksetInput): PipelineGate[] {
  return [
    gate("notify", worksetNotifyOn(workset), true),
    gate("external", worksetExternalOn(workset), true),
  ];
}

function itemGates(itemId: string, events: readonly PipelineEventInput[]): PipelineGate[] {
  return [gate("calendar", itemHasLinkedCalendar(itemId, events), false)];
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

function capPoints(
  points: PipelinePoint[],
  moreHref: string,
  moreLabel: (count: number) => string,
): PipelinePoint[] {
  if (points.length <= PIPELINE_MAX_POINTS) return points;
  const kept = points.slice(0, PIPELINE_MAX_POINTS - 1);
  const overflow = points.length - kept.length;
  kept.push({
    id: `more:${moreHref}`,
    kind: "more",
    entityId: "more",
    label: moreLabel(overflow),
    href: moreHref,
    muted: true,
  });
  return kept;
}

function pagePoint(id: string, label: string, href: string): PipelinePoint {
  return { id, kind: "page", entityId: id, label, href };
}

function singletonBlock(
  id: string,
  kind: PipelineBlockKind,
  titleKey: string,
  column: PipelineColumn,
  point: PipelinePoint,
): PipelineBlock {
  return { id, kind, titleKey, column, points: [point] };
}

function worksetLabel(row: PipelineWorksetInput, labels: PipelineGraphLabels): string {
  return row.id === SYSTEM_WORKSET_ID ? labels.generalName : row.name;
}

function taskHref(task: PipelineTaskInput): string {
  if (task.analysisMode === "agent" && task.outputCalendar) {
    return `/tasks/${encodeURIComponent(task.id)}/agent`;
  }
  return `/tasks/${encodeURIComponent(task.id)}/edit`;
}

/** Build the household pipeline: one block per kind, points listed one-by-one. */
export function buildWorksetPipelineGraph(input: PipelineGraphInput): PipelineGraph {
  const { labels } = input;
  const channels = input.channels ?? [];
  const knownWorksetIds = new Set(input.worksets.map((row) => row.id));

  const worksetPoints: PipelinePoint[] = input.worksets.map((row) => ({
    id: worksetPointId(row.id),
    kind: "workset",
    entityId: row.id,
    label: worksetLabel(row, labels),
    href: `/worksets/${encodeURIComponent(row.id)}`,
    gates: worksetGates(row),
  }));

  const taskPoints = capPoints(
    input.tasks.map((task) => ({
      id: taskPointId(task.id),
      kind: "task" as const,
      entityId: task.id,
      label: task.name,
      href: taskHref(task),
      gates: taskGates(task),
    })),
    "/tasks",
    labels.more,
  );

  const activeItems = input.items.filter((item) => item.status !== "archived");
  const itemPoints = capPoints(
    activeItems.map((item) => ({
      id: itemPointId(item.id),
      kind: "item" as const,
      entityId: item.id,
      label: item.title,
      href: `/items/${encodeURIComponent(item.id)}/edit`,
      gates: itemGates(item.id, input.events),
    })),
    "/items",
    labels.more,
  );

  const sourcePoints = capPoints(
    input.sources.map((source) => ({
      id: sourcePointId(source.id),
      kind: "source" as const,
      entityId: source.id,
      label: source.name,
      href: "/sources",
    })),
    "/sources",
    labels.more,
  );

  const assistantPoint = pagePoint(PIPELINE_PAGE.assistant, labels.assistant, "/assistant");

  const blocks: PipelineBlock[] = [
    {
      id: PIPELINE_BLOCK.sources,
      kind: "sources",
      titleKey: "graphBlockSources",
      column: PIPELINE_BLOCK_COLUMN.sources,
      points: sourcePoints,
    },
    {
      id: PIPELINE_BLOCK.items,
      kind: "items",
      titleKey: "graphBlockItems",
      column: PIPELINE_BLOCK_COLUMN.items,
      points: itemPoints,
    },
    {
      id: PIPELINE_BLOCK.tasks,
      kind: "tasks",
      titleKey: "graphBlockTasks",
      column: PIPELINE_BLOCK_COLUMN.tasks,
      points: taskPoints,
    },
    singletonBlock(
      PIPELINE_BLOCK.assistant,
      "assistant",
      "graphBlockAssistant",
      PIPELINE_BLOCK_COLUMN.assistant,
      assistantPoint,
    ),
    {
      id: PIPELINE_BLOCK.worksets,
      kind: "worksets",
      titleKey: "graphBlockWorksets",
      column: PIPELINE_BLOCK_COLUMN.worksets,
      points: capPoints(worksetPoints, "/worksets", labels.more),
    },
    ...PIPELINE_OUTPUT_DEFS.map((row) =>
      singletonBlock(
        row.blockId,
        row.kind,
        row.titleKey,
        PIPELINE_BLOCK_COLUMN[row.kind],
        pagePoint(row.pageId, labels[row.labelKey], row.href),
      ),
    ),
  ];

  const pointIds = new Set(blocks.flatMap((block) => block.points.map((point) => point.id)));
  const edges: PipelineEdge[] = [];
  const pushEdge = (
    sourceBlockId: string,
    sourcePointId: string,
    targetBlockId: string,
    targetPointId: string,
    muted = false,
  ) => {
    if (
      (!pointIds.has(sourcePointId) && !isPipelineLayerPortId(sourcePointId)) ||
      !pointIds.has(targetPointId)
    ) {
      return;
    }
    edges.push(pipelineEdge(sourceBlockId, sourcePointId, targetBlockId, targetPointId, muted));
  };

  const visibleTaskIds = new Set(
    taskPoints.filter((point) => point.kind === "task").map((point) => point.entityId),
  );
  const visibleSourceIds = new Set(
    sourcePoints.filter((point) => point.kind === "source").map((point) => point.entityId),
  );
  for (const task of input.tasks) {
    if (!visibleTaskIds.has(task.id)) continue;
    const sourceId = taskPointId(task.id);
    const ownerId = taskOwnerWorksetId(task);
    if (knownWorksetIds.has(ownerId)) {
      pushEdge(PIPELINE_BLOCK.tasks, sourceId, PIPELINE_BLOCK.worksets, worksetPointId(ownerId));
    }
    for (const subscribedSourceId of sourceIdsForTaskChannels(
      normalizePipelineChannelIds(task.channelIds),
      channels,
    )) {
      if (!visibleSourceIds.has(subscribedSourceId)) continue;
      pushEdge(
        PIPELINE_BLOCK.sources,
        sourcePointId(subscribedSourceId),
        PIPELINE_BLOCK.tasks,
        sourceId,
      );
    }
  }

  const visibleItemIds = new Set(
    itemPoints.filter((point) => point.kind === "item").map((point) => point.entityId),
  );
  for (const item of activeItems) {
    if (!visibleItemIds.has(item.id)) continue;
    if (knownWorksetIds.has(item.worksetId)) {
      pushEdge(
        PIPELINE_BLOCK.items,
        itemPointId(item.id),
        PIPELINE_BLOCK.worksets,
        worksetPointId(item.worksetId),
      );
    }
  }

  edges.push(...buildPipelineLegendEdges(pointIds));

  // Assistant is layer 2 with tasks: one ownership wire to the voice default workset.
  const assistantId = PIPELINE_PAGE.assistant;
  const defaultWorksetId = assistantOwnerWorksetId(input.assistantDefaultWorksetId);
  if (input.worksets.some((row) => row.id === defaultWorksetId)) {
    pushEdge(
      PIPELINE_BLOCK.assistant,
      assistantId,
      PIPELINE_BLOCK.worksets,
      worksetPointId(defaultWorksetId),
    );
  }

  return { blocks, edges };
}
