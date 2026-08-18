/** Household pipeline graph data: blocks, points, and ownership wires. */

import { normalizeNotifyPref } from "../notify/notifyPref";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import {
  PIPELINE_BLOCK_COLUMN,
  PIPELINE_MAX_POINTS,
  PIPELINE_VISIBLE_POINTS,
  type PipelineColumn,
} from "./pipelineConstants";
import {
  PIPELINE_BLOCK,
  PIPELINE_LAYER_PORT,
  PIPELINE_OUTPUT_DEFS,
  PIPELINE_PAGE,
  isPipelineLayerPortId,
  isPipelineOutputPageId,
  itemPointId,
  sourcePointId,
  taskPointId,
  worksetPointId,
  type PipelineOutputKind,
} from "./pipelineIds";

export type PipelineBlockKind =
  | "sources"
  | "items"
  | "tasks"
  | "worksets"
  | "assistant"
  | PipelineOutputKind;

export type PipelinePointKind =
  | "workset"
  | "task"
  | "item"
  | "source"
  | "page"
  | "more";

/** Enable-state shown as a node icon — not a wire. */
export type PipelineGateKind = "calendar" | "calendarWrite" | "notify" | "intel" | "external";

export type PipelineGate = {
  kind: PipelineGateKind;
  on: boolean;
  /** Click toggles the existing PATCH; status-only icons stay false. */
  toggleable: boolean;
};

export type PipelinePoint = {
  id: string;
  kind: PipelinePointKind;
  entityId: string;
  label: string;
  href: string;
  muted?: boolean;
  legalTarget?: boolean;
  gates?: PipelineGate[];
};

export type PipelineBlock = {
  id: string;
  kind: PipelineBlockKind;
  titleKey: string;
  column: PipelineColumn;
  points: PipelinePoint[];
};

export type PipelineEdge = {
  id: string;
  sourceBlockId: string;
  sourcePointId: string;
  targetBlockId: string;
  targetPointId: string;
  muted?: boolean;
  /** Layer-legend wire: not per-card and not disconnectable. */
  legend?: boolean;
};

export type PipelineGraph = {
  blocks: PipelineBlock[];
  edges: PipelineEdge[];
};

export type PipelineWorksetInput = {
  id: string;
  name: string;
  notifyEnabled?: boolean | null;
  externalEnabled?: boolean | null;
};

export type PipelineChannelRef = string | { id?: string; platform?: string; platformId?: string };

export type PipelineTaskInput = {
  id: string;
  name: string;
  promptTemplate?: string | null;
  analysisMode?: string | null;
  worksetId?: string | null;
  outputAnalysisEvents?: boolean | null;
  includeInTimeline?: boolean | null;
  outputCalendar?: boolean | null;
  notifyPref?: string | null;
  channelIds?: readonly PipelineChannelRef[] | null;
};

export type PipelineItemInput = {
  id: string;
  title: string;
  worksetId: string;
  status?: string | null;
};

export type PipelineSourceInput = {
  id: string;
  name: string;
};

export type PipelineChannelSourceInput = {
  channelId: string;
  sourceId: string;
};

export type PipelineEventInput = {
  id: string;
  title: string;
  worksetId: string;
  itemId?: string | null;
  kind?: string | null;
  notifyPref?: string | null;
};

export type PipelineGraphLabels = {
  generalName: string;
  unassigned: string;
  more: (count: number) => string;
  assistant: string;
  timeline: string;
  intel: string;
  notify: string;
  external: string;
};

export type PipelineGraphInput = {
  worksets: readonly PipelineWorksetInput[];
  tasks: readonly PipelineTaskInput[];
  items: readonly PipelineItemInput[];
  sources: readonly PipelineSourceInput[];
  channels?: readonly PipelineChannelSourceInput[];
  events: readonly PipelineEventInput[];
  labels: PipelineGraphLabels;
  /** Voice-page / assistant picker default (`GET/PUT …/assistant/voice-io`). */
  assistantDefaultWorksetId?: string | null;
};

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

function edge(
  sourceBlockId: string,
  sourcePointId: string,
  targetBlockId: string,
  targetPointId: string,
  muted = false,
  legend = false,
): PipelineEdge {
  return {
    id: `${sourcePointId}->${targetPointId}`,
    sourceBlockId,
    sourcePointId,
    targetBlockId,
    targetPointId,
    muted,
    ...(legend ? { legend: true } : {}),
  };
}

function pagePoint(id: string, label: string, href: string): PipelinePoint {
  return { id, kind: "page", entityId: id, label, href };
}

export function isPipelineOutputBlockKind(kind: PipelineBlockKind): boolean {
  return PIPELINE_OUTPUT_DEFS.some((row) => row.kind === kind);
}

export function isPipelineOutputPage(point: PipelinePoint): boolean {
  return point.kind === "page" && isPipelineOutputPageId(point.id);
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
    edges.push(edge(sourceBlockId, sourcePointId, targetBlockId, targetPointId, muted));
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

  // L4 is a shared output legend from the 工作集 block — not per-card wires.
  // notifyEnabled / externalEnabled stay as card icons and do not gate these edges.
  for (const row of PIPELINE_OUTPUT_DEFS) {
    if (!pointIds.has(row.pageId)) continue;
    edges.push(
      edge(
        PIPELINE_BLOCK.worksets,
        PIPELINE_LAYER_PORT.worksets,
        row.blockId,
        row.pageId,
        false,
        true,
      ),
    );
  }

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

/** Limit the household graph to selected worksets; keep sources that feed their tasks. */
export function scopePipelineInputToWorkset(
  input: PipelineGraphInput,
  worksetId: string | readonly string[] | null,
): PipelineGraphInput {
  if (worksetId == null) return input;
  const allowedIds = typeof worksetId === "string" ? [worksetId] : [...worksetId];
  if (allowedIds.length === 0) {
    return { ...input, worksets: [], tasks: [], items: [], events: [], sources: [] };
  }
  const allowed = new Set(allowedIds);
  const channels = input.channels ?? [];
  const tasks = input.tasks.filter((task) => allowed.has(taskOwnerWorksetId(task)));
  const items = input.items.filter((item) => allowed.has(item.worksetId));
  const events = input.events.filter((event) => allowed.has(event.worksetId));
  const worksets = input.worksets.filter((row) => allowed.has(row.id));
  const feedingSourceIds = new Set<string>();
  for (const task of tasks) {
    for (const sourceId of sourceIdsForTaskChannels(
      normalizePipelineChannelIds(task.channelIds),
      channels,
    )) {
      feedingSourceIds.add(sourceId);
    }
  }
  return {
    ...input,
    worksets,
    tasks,
    items,
    events,
    sources: input.sources.filter((source) => feedingSourceIds.has(source.id)),
  };
}

export function collapsePipelineGraph(
  graph: PipelineGraph,
  expandedBlockIds: ReadonlySet<string>,
  limit = PIPELINE_VISIBLE_POINTS,
): { graph: PipelineGraph; overflowByBlockId: Record<string, number> } {
  const overflowByBlockId: Record<string, number> = {};
  const blocks = graph.blocks.map((block) => {
    const overflow = Math.max(0, block.points.length - limit);
    overflowByBlockId[block.id] = overflow;
    if (overflow === 0 || expandedBlockIds.has(block.id)) return block;
    return { ...block, points: block.points.slice(0, limit) };
  });
  const pointIds = new Set(blocks.flatMap((block) => block.points.map((point) => point.id)));
  return {
    graph: {
      blocks,
      edges: graph.edges.filter(
        (row) =>
          row.legend === true ||
          (pointIds.has(row.sourcePointId) && pointIds.has(row.targetPointId)),
      ),
    },
    overflowByBlockId,
  };
}
