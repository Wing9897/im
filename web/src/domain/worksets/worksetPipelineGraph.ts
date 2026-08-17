/**
 * Household pipeline graph: blocks contain points; wires follow real
 * ownership / output / subscription flags. Layout is session-only — not persisted.
 */

import { settingsIntegrationsPath } from "../navigation/integrationsRoutes";
import { normalizeNotifyPref } from "../notify/notifyPref";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";

export const PIPELINE_MAX_POINTS = 24;
export const PIPELINE_VISIBLE_POINTS = 8;
export const PIPELINE_BLOCK_WIDTH = 168;
export const PIPELINE_ROW_HEIGHT = 24;
export const PIPELINE_HEADER_HEIGHT = 30;
export const PIPELINE_BODY_PAD_Y = 4;
export const PIPELINE_EMPTY_BODY_HEIGHT = 20;
export const PIPELINE_COL_GAP_Y = 12;
/** Inner pad from zone left/right to the block. */
export const PIPELINE_ZONE_PAD_X = 10;
/** Corridor between layer zones so step edges can turn without crossing 工作集. */
export const PIPELINE_COL_GAP_X = 64;
export const PIPELINE_ZONE_WIDTH = PIPELINE_BLOCK_WIDTH + PIPELINE_ZONE_PAD_X * 2;
export const PIPELINE_ZONE_ORIGIN_X = 8;
export const PIPELINE_EDGE_TYPE = "smoothstep";
export const PIPELINE_EDGE_Z_INDEX = 2;
export const PIPELINE_BLOCK_Z_INDEX = 4;
export const PIPELINE_ZONE_Z_INDEX = -10;
export const PIPELINE_DETOUR_PAD = 16;
export const PIPELINE_EDGE_RADIUS = 8;

export function pipelineZoneX(column: number): number {
  return PIPELINE_ZONE_ORIGIN_X + column * (PIPELINE_ZONE_WIDTH + PIPELINE_COL_GAP_X);
}

export const PIPELINE_COL_X = [
  pipelineZoneX(0) + PIPELINE_ZONE_PAD_X,
  pipelineZoneX(1) + PIPELINE_ZONE_PAD_X,
  pipelineZoneX(2) + PIPELINE_ZONE_PAD_X,
  pipelineZoneX(3) + PIPELINE_ZONE_PAD_X,
] as const;
export const PIPELINE_FIT_VIEW_PADDING = 0.06;
export const PIPELINE_COL_START_Y = 28;

/** Four always-on columns: 第一層…第四層 (never 輸入/輸出). */
export const PIPELINE_LAYERS = [
  { id: "layer1", titleKey: "graphLayer1", column: 0 },
  { id: "layer2", titleKey: "graphLayer2", column: 1 },
  { id: "layer3", titleKey: "graphLayer3", column: 2 },
  { id: "layer4", titleKey: "graphLayer4", column: 3 },
] as const;

export type PipelineLayerId = (typeof PIPELINE_LAYERS)[number]["id"];
export type PipelineColumn = 0 | 1 | 2 | 3;

export function pipelineLayerForColumn(column: PipelineColumn): PipelineLayerId {
  return PIPELINE_LAYERS[column].id;
}

export type PipelineBlockKind =
  | "sources"
  | "items"
  | "calendar"
  | "tasks"
  | "worksets"
  | "intel"
  | "timeline"
  | "notify"
  | "external"
  | "assistant";

export type PipelinePointKind =
  | "workset"
  | "task"
  | "item"
  | "source"
  | "page"
  | "more";

export type PipelinePoint = {
  id: string;
  kind: PipelinePointKind;
  entityId: string;
  label: string;
  href: string;
  muted?: boolean;
  legalTarget?: boolean;
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
  calendar: string;
  calendarPage: string;
  intel: string;
  timeline: string;
  notify: string;
  mcp: string;
  a2a: string;
  assistant: string;
};

export type PipelineGraphInput = {
  worksets: readonly PipelineWorksetInput[];
  tasks: readonly PipelineTaskInput[];
  items: readonly PipelineItemInput[];
  sources: readonly PipelineSourceInput[];
  channels?: readonly PipelineChannelSourceInput[];
  events: readonly PipelineEventInput[];
  labels: PipelineGraphLabels;
};

export const PIPELINE_BLOCK = {
  sources: "block-sources",
  items: "block-items",
  calendar: "block-calendar",
  tasks: "block-tasks",
  worksets: "block-worksets",
  intel: "block-intel",
  timeline: "block-timeline",
  notify: "block-notify",
  external: "block-external",
  assistant: "block-assistant",
} as const;

export const PIPELINE_PAGE = {
  calendar: "page:calendar",
  intel: "page:intel",
  timeline: "page:timeline",
  notify: "page:notify",
  mcp: "page:mcp",
  a2a: "page:a2a",
  assistant: "page:assistant",
} as const;

export const PIPELINE_HANDLE_IN_SUFFIX = "__in";
export const PIPELINE_HANDLE_OUT_SUFFIX = "__out";

export function pipelinePointHandleId(pointId: string, side: "in" | "out"): string {
  return `${pointId}${side === "in" ? PIPELINE_HANDLE_IN_SUFFIX : PIPELINE_HANDLE_OUT_SUFFIX}`;
}

export function worksetPointId(worksetId: string): string {
  return `workset:${worksetId}`;
}

export function taskOwnerWorksetId(task: PipelineTaskInput): string {
  const id = task.worksetId?.trim();
  return id || SYSTEM_WORKSET_ID;
}

export function taskPointId(taskId: string): string {
  return `task:${taskId}`;
}

export function itemPointId(itemId: string): string {
  return `item:${itemId}`;
}

export function sourcePointId(sourceId: string): string {
  return `source:${sourceId}`;
}

export function taskIntelEnabled(task: PipelineTaskInput): boolean {
  if (task.analysisMode === "leaderboard") return false;
  if (task.analysisMode === "agent") return task.outputAnalysisEvents === true;
  return task.outputAnalysisEvents !== false;
}

export function taskTimelineEnabled(task: PipelineTaskInput): boolean {
  return task.includeInTimeline !== false;
}

export function taskNotifyEnabled(
  task: PipelineTaskInput,
  worksetNotifyEnabled: boolean | null | undefined,
): boolean {
  if (normalizeNotifyPref(task.notifyPref) === "off") return false;
  return worksetNotifyEnabled !== false;
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
): PipelineEdge {
  return {
    id: `${sourcePointId}->${targetPointId}`,
    sourceBlockId,
    sourcePointId,
    targetBlockId,
    targetPointId,
    muted,
  };
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
  const worksetById = new Map(input.worksets.map((row) => [row.id, row]));
  const knownWorksetIds = new Set(worksetById.keys());

  const worksetPoints: PipelinePoint[] = input.worksets.map((row) => ({
    id: worksetPointId(row.id),
    kind: "workset",
    entityId: row.id,
    label: worksetLabel(row, labels),
    href: `/worksets/${encodeURIComponent(row.id)}`,
  }));

  const taskPoints = capPoints(
    input.tasks.map((task) => ({
      id: taskPointId(task.id),
      kind: "task" as const,
      entityId: task.id,
      label: task.name,
      href: taskHref(task),
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

  const calendarPoint = pagePoint(PIPELINE_PAGE.calendar, labels.calendar, "/timeline");
  const intelPoint = pagePoint(PIPELINE_PAGE.intel, labels.intel, "/intelligence");
  const timelinePoint = pagePoint(PIPELINE_PAGE.timeline, labels.timeline, "/timeline");
  const notifyPoint = pagePoint(PIPELINE_PAGE.notify, labels.notify, "/actions?tab=notify");
  const assistantPoint = pagePoint(PIPELINE_PAGE.assistant, labels.assistant, "/assistant");
  const externalPoints: PipelinePoint[] = [
    pagePoint(PIPELINE_PAGE.mcp, labels.mcp, settingsIntegrationsPath("mcp")),
    pagePoint(PIPELINE_PAGE.a2a, labels.a2a, settingsIntegrationsPath("a2a")),
  ];

  const blocks: PipelineBlock[] = [
    {
      id: PIPELINE_BLOCK.sources,
      kind: "sources",
      titleKey: "graphBlockSources",
      column: 0,
      points: sourcePoints,
    },
    singletonBlock(PIPELINE_BLOCK.assistant, "assistant", "graphBlockAssistant", 0, assistantPoint),
    {
      id: PIPELINE_BLOCK.items,
      kind: "items",
      titleKey: "graphBlockItems",
      column: 1,
      points: itemPoints,
    },
    {
      id: PIPELINE_BLOCK.tasks,
      kind: "tasks",
      titleKey: "graphBlockTasks",
      column: 1,
      points: taskPoints,
    },
    singletonBlock(PIPELINE_BLOCK.calendar, "calendar", "graphBlockCalendar", 1, calendarPoint),
  ];
  if (worksetPoints.length > 0) {
    blocks.push({
      id: PIPELINE_BLOCK.worksets,
      kind: "worksets",
      titleKey: "graphBlockWorksets",
      column: 2,
      points: capPoints(worksetPoints, "/worksets", labels.more),
    });
  }
  blocks.push(
    singletonBlock(PIPELINE_BLOCK.intel, "intel", "graphBlockIntel", 3, intelPoint),
    singletonBlock(PIPELINE_BLOCK.timeline, "timeline", "graphBlockTimeline", 3, timelinePoint),
    singletonBlock(PIPELINE_BLOCK.notify, "notify", "graphBlockNotify", 3, notifyPoint),
    {
      id: PIPELINE_BLOCK.external,
      kind: "external",
      titleKey: "graphBlockExternal",
      column: 3,
      points: externalPoints,
    },
  );

  const pointIds = new Set(blocks.flatMap((block) => block.points.map((point) => point.id)));
  const edges: PipelineEdge[] = [];
  const pushEdge = (
    sourceBlockId: string,
    sourcePointId: string,
    targetBlockId: string,
    targetPointId: string,
    muted = false,
  ) => {
    if (!pointIds.has(sourcePointId) || !pointIds.has(targetPointId)) return;
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
    // Leaderboard sinks are 排行榜 page + 通知 — never 情报页 (no extra graph layer).
    if (task.analysisMode !== "leaderboard") {
      pushEdge(
        PIPELINE_BLOCK.tasks,
        sourceId,
        PIPELINE_BLOCK.intel,
        PIPELINE_PAGE.intel,
        !taskIntelEnabled(task),
      );
    }
    pushEdge(
      PIPELINE_BLOCK.tasks,
      sourceId,
      PIPELINE_BLOCK.timeline,
      PIPELINE_PAGE.timeline,
      !taskTimelineEnabled(task),
    );
    const owner = worksetById.get(taskOwnerWorksetId(task));
    pushEdge(
      PIPELINE_BLOCK.tasks,
      sourceId,
      PIPELINE_BLOCK.notify,
      PIPELINE_PAGE.notify,
      !taskNotifyEnabled(task, owner?.notifyEnabled),
    );
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

  for (const workset of input.worksets) {
    pushEdge(
      PIPELINE_BLOCK.calendar,
      PIPELINE_PAGE.calendar,
      PIPELINE_BLOCK.worksets,
      worksetPointId(workset.id),
    );
  }

  // Workset gates: notify / MCP / A2A plus always-on 时间规划 (display + navigate).
  // Intel stays task-only (outputAnalysisEvents). No workset-level includeInTimeline flag.
  for (const workset of input.worksets) {
    const notifyMuted = workset.notifyEnabled === false;
    const externalMuted = workset.externalEnabled === false;
    pushEdge(
      PIPELINE_BLOCK.worksets,
      worksetPointId(workset.id),
      PIPELINE_BLOCK.notify,
      PIPELINE_PAGE.notify,
      notifyMuted,
    );
    pushEdge(
      PIPELINE_BLOCK.worksets,
      worksetPointId(workset.id),
      PIPELINE_BLOCK.external,
      PIPELINE_PAGE.mcp,
      externalMuted,
    );
    pushEdge(
      PIPELINE_BLOCK.worksets,
      worksetPointId(workset.id),
      PIPELINE_BLOCK.external,
      PIPELINE_PAGE.a2a,
      externalMuted,
    );
    pushEdge(
      PIPELINE_BLOCK.worksets,
      worksetPointId(workset.id),
      PIPELINE_BLOCK.timeline,
      PIPELINE_PAGE.timeline,
    );
  }

  // Assistant is intake (layer 1): writes items, worksets, and 我的日程 (layer 2) — not a last-column sink.
  const assistantId = PIPELINE_PAGE.assistant;
  for (const point of itemPoints) {
    if (point.kind === "item") {
      pushEdge(PIPELINE_BLOCK.assistant, assistantId, PIPELINE_BLOCK.items, point.id);
    }
  }
  for (const point of worksetPoints) {
    if (point.kind === "workset") {
      pushEdge(PIPELINE_BLOCK.assistant, assistantId, PIPELINE_BLOCK.worksets, point.id);
    }
  }
  pushEdge(
    PIPELINE_BLOCK.assistant,
    assistantId,
    PIPELINE_BLOCK.calendar,
    PIPELINE_PAGE.calendar,
  );

  return { blocks, edges };
}

/** Limit the household graph to one workset; keep sources that feed its tasks. */
export function scopePipelineInputToWorkset(
  input: PipelineGraphInput,
  worksetId: string | null,
): PipelineGraphInput {
  if (!worksetId) return input;
  const channels = input.channels ?? [];
  const tasks = input.tasks.filter((task) => taskOwnerWorksetId(task) === worksetId);
  const items = input.items.filter((item) => item.worksetId === worksetId);
  const events = input.events.filter((event) => event.worksetId === worksetId);
  const worksets = input.worksets.filter((row) => row.id === worksetId);
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
        (row) => pointIds.has(row.sourcePointId) && pointIds.has(row.targetPointId),
      ),
    },
    overflowByBlockId,
  };
}

export type PipelineBlockFlowNode = {
  id: string;
  type: "worksetBlock";
  position: { x: number; y: number };
  className: string;
  data: {
    block: PipelineBlock;
    selectedPointId: string | null;
    overflowCount: number;
    expanded: boolean;
    onSelectPoint?: (point: PipelinePoint) => void;
    onOpenSettings?: (point: PipelinePoint) => void;
    onToggleOverflow?: () => void;
  };
  draggable: false;
  connectable: true;
  selectable: false;
  zIndex: number;
  style: { width: number; height: number; pointerEvents: "all" };
};

export type PipelineZoneFlowNode = {
  id: string;
  type: "layerZone";
  position: { x: number; y: number };
  className: string;
  data: { layer: PipelineLayerId; titleKey: string };
  draggable: false;
  connectable: false;
  selectable: false;
  focusable: false;
  zIndex: number;
  style: { width: number; height: number; pointerEvents: "none" };
};

export type PipelineFlowNode = PipelineBlockFlowNode | PipelineZoneFlowNode;

export type PipelineSkipDetour = {
  gutterLeft: number;
  gutterRight: number;
  top: number;
  bottom: number;
  pad: number;
};

export type PipelineFlowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  type: typeof PIPELINE_EDGE_TYPE;
  selectable: false;
  focusable: false;
  interactionWidth: 0;
  zIndex: number;
  className: string;
  data?: { detour: PipelineSkipDetour };
};

export function pipelineBlockHeight(pointCount: number, hasOverflowRow = false): number {
  if (pointCount === 0 && !hasOverflowRow) {
    return PIPELINE_HEADER_HEIGHT + PIPELINE_EMPTY_BODY_HEIGHT;
  }
  const rows = pointCount + (hasOverflowRow ? 1 : 0);
  return PIPELINE_HEADER_HEIGHT + PIPELINE_BODY_PAD_Y * 2 + rows * PIPELINE_ROW_HEIGHT;
}

/** Handle Y inside a block node — row center, not the header. */
export function pipelinePointHandleTop(index: number): number {
  return (
    PIPELINE_HEADER_HEIGHT +
    PIPELINE_BODY_PAD_Y +
    index * PIPELINE_ROW_HEIGHT +
    PIPELINE_ROW_HEIGHT / 2
  );
}

export function pipelineWorksetDetour(box: {
  x: number;
  y: number;
  width: number;
  height: number;
}): PipelineSkipDetour {
  return {
    gutterLeft: pipelineZoneX(2) - PIPELINE_COL_GAP_X / 2,
    gutterRight: pipelineZoneX(3) - PIPELINE_COL_GAP_X / 2,
    top: box.y,
    bottom: box.y + box.height,
    pad: PIPELINE_DETOUR_PAD,
  };
}

function yHitsBand(y: number, top: number, bottom: number): boolean {
  return y >= top && y <= bottom;
}

/** Orthogonal waypoints for L2→L4 edges: turn in the layer corridors, go around 工作集. */
export function pipelineSkipLayerWaypoints(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  detour: PipelineSkipDetour,
): { x: number; y: number }[] {
  const start = { x: sourceX, y: sourceY };
  const end = { x: targetX, y: targetY };
  if (!yHitsBand(targetY, detour.top, detour.bottom)) {
    return [start, { x: detour.gutterLeft, y: sourceY }, { x: detour.gutterLeft, y: targetY }, end];
  }
  const aboveY = detour.top - detour.pad;
  const belowY = detour.bottom + detour.pad;
  const detourY = sourceY <= (detour.top + detour.bottom) / 2 ? Math.max(8, aboveY) : belowY;
  return [
    start,
    { x: detour.gutterLeft, y: sourceY },
    { x: detour.gutterLeft, y: detourY },
    { x: detour.gutterRight, y: detourY },
    { x: detour.gutterRight, y: targetY },
    end,
  ];
}

export function pipelineRoundedOrthogonalPath(
  points: readonly { x: number; y: number }[],
  radius = PIPELINE_EDGE_RADIUS,
): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const len1 = Math.hypot(dx1, dy1);
    const len2 = Math.hypot(dx2, dy2);
    if (len1 === 0 || len2 === 0) continue;
    const r = Math.min(radius, len1 / 2, len2 / 2);
    d += ` L ${curr.x - (dx1 / len1) * r} ${curr.y - (dy1 / len1) * r}`;
    d += ` Q ${curr.x} ${curr.y} ${curr.x + (dx2 / len2) * r} ${curr.y + (dy2 / len2) * r}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function segmentHitsAabb(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  box: { left: number; right: number; top: number; bottom: number },
): boolean {
  const minX = Math.min(ax, bx);
  const maxX = Math.max(ax, bx);
  const minY = Math.min(ay, by);
  const maxY = Math.max(ay, by);
  if (maxX < box.left || minX > box.right || maxY < box.top || minY > box.bottom) return false;
  if (ax === bx) return ax >= box.left && ax <= box.right;
  if (ay === by) return ay >= box.top && ay <= box.bottom;
  return true;
}

/** True when any orthogonal segment of `points` crosses the workset card. */
export function pipelinePathHitsAabb(
  points: readonly { x: number; y: number }[],
  box: { left: number; right: number; top: number; bottom: number },
): boolean {
  for (let i = 0; i < points.length - 1; i += 1) {
    if (segmentHitsAabb(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, box)) {
      return true;
    }
  }
  return false;
}

/** Session-only xyflow positions — not written back to the server. */
export function layoutPipelineFlow(
  graph: PipelineGraph,
  selectedPointId: string | null = null,
  legalTargetIds: ReadonlySet<string> | null = null,
  options?: {
    overflowByBlockId?: Readonly<Record<string, number>>;
    expandedBlockIds?: ReadonlySet<string>;
  },
): {
  nodes: PipelineFlowNode[];
  edges: PipelineFlowEdge[];
} {
  const targets = selectedPointId && legalTargetIds ? legalTargetIds : null;
  const overflowByBlockId = options?.overflowByBlockId ?? {};
  const expandedBlockIds = options?.expandedBlockIds ?? new Set<string>();
  const colY = PIPELINE_COL_X.map(() => PIPELINE_COL_START_Y);
  const blockNodes: PipelineBlockFlowNode[] = graph.blocks.map((block) => {
    const points = targets
      ? block.points.map((point) => {
          const selected = point.id === selectedPointId;
          const legalTarget = targets.has(point.id);
          return {
            ...point,
            legalTarget,
            muted: selected ? false : !legalTarget,
          };
        })
      : block.points.map((point) => ({ ...point, legalTarget: false }));
    const laidOutBlock = { ...block, points };
    const overflowCount = overflowByBlockId[block.id] ?? 0;
    const height = pipelineBlockHeight(laidOutBlock.points.length, overflowCount > 0);
    const x = PIPELINE_COL_X[block.column];
    const y = colY[block.column];
    colY[block.column] += height + PIPELINE_COL_GAP_Y;
    return {
      id: block.id,
      type: "worksetBlock",
      position: { x, y },
      className: laidOutBlock.points.length === 0 ? "nopan nodrag is-empty" : "nopan nodrag",
      data: {
        block: laidOutBlock,
        selectedPointId,
        overflowCount,
        expanded: expandedBlockIds.has(block.id),
      },
      draggable: false,
      connectable: laidOutBlock.points.length > 0,
      selectable: false,
      zIndex: PIPELINE_BLOCK_Z_INDEX,
      style: { width: PIPELINE_BLOCK_WIDTH, height, pointerEvents: "all" },
    };
  });
  const zoneNodes: PipelineZoneFlowNode[] = PIPELINE_LAYERS.map((layer) => {
    const nextY = colY[layer.column];
    const contentBottom =
      nextY > PIPELINE_COL_START_Y ? nextY - PIPELINE_COL_GAP_Y + 10 : PIPELINE_COL_START_Y + 24;
    return {
      id: `zone-${layer.id}`,
      type: "layerZone",
      position: { x: pipelineZoneX(layer.column), y: 0 },
      className: `im-ws-graph-zone-node is-${layer.id} nopan nodrag`,
      data: { layer: layer.id, titleKey: layer.titleKey },
      draggable: false,
      connectable: false,
      selectable: false,
      focusable: false,
      zIndex: PIPELINE_ZONE_Z_INDEX,
      style: { width: PIPELINE_ZONE_WIDTH, height: contentBottom, pointerEvents: "none" },
    };
  });
  const nodes: PipelineFlowNode[] = [...zoneNodes, ...blockNodes];
  const columnByBlockId = new Map(graph.blocks.map((block) => [block.id, block.column]));
  const worksetNode = blockNodes.find((node) => node.id === PIPELINE_BLOCK.worksets);
  const skipDetour = worksetNode
    ? pipelineWorksetDetour({
        x: worksetNode.position.x,
        y: worksetNode.position.y,
        width: PIPELINE_BLOCK_WIDTH,
        height: Number(worksetNode.style.height),
      })
    : null;

  const edges: PipelineFlowEdge[] = graph.edges.map((row) => {
    const sourceCol = columnByBlockId.get(row.sourceBlockId);
    const targetCol = columnByBlockId.get(row.targetBlockId);
    const edge: PipelineFlowEdge = {
      id: row.id,
      source: row.sourceBlockId,
      target: row.targetBlockId,
      sourceHandle: pipelinePointHandleId(row.sourcePointId, "out"),
      targetHandle: pipelinePointHandleId(row.targetPointId, "in"),
      type: PIPELINE_EDGE_TYPE,
      selectable: false,
      focusable: false,
      interactionWidth: 0,
      zIndex: PIPELINE_EDGE_Z_INDEX,
      className: row.muted ? "im-ws-graph-edge is-muted" : "im-ws-graph-edge",
    };
    if (skipDetour && sourceCol === 1 && targetCol === 3) {
      edge.data = { detour: skipDetour };
    }
    return edge;
  });

  return { nodes, edges };
}
