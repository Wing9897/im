/** Point / block construction, including overflow collapse (`capPoints`). */

import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { PIPELINE_BLOCK_COLUMN, PIPELINE_MAX_POINTS, type PipelineColumn } from "./pipelineConstants";
import {
  PIPELINE_BLOCK,
  PIPELINE_OUTPUT_DEFS,
  PIPELINE_PAGE,
  itemPointId,
  sourcePointId,
  taskPointId,
  worksetPointId,
} from "./pipelineIds";
import {
  taskCalendarWriteEnabled,
  taskIntelEnabled,
  taskNotifyPrefOn,
  taskTimelineEnabled,
  worksetExternalOn,
  worksetNotifyOn,
} from "./pipelineGraphFlags";
import type {
  PipelineBlock,
  PipelineBlockKind,
  PipelineEventInput,
  PipelineGate,
  PipelineGateKind,
  PipelineGraphInput,
  PipelineGraphLabels,
  PipelineItemInput,
  PipelinePoint,
  PipelineTaskInput,
  PipelineWorksetInput,
} from "./pipelineGraphTypes";

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

/** Collapse excess points into a trailing `more` chip. */
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

export type PipelinePointLayer = {
  blocks: PipelineBlock[];
  taskPoints: PipelinePoint[];
  itemPoints: PipelinePoint[];
  sourcePoints: PipelinePoint[];
  activeItems: PipelineItemInput[];
};

export function buildPipelinePointLayer(input: PipelineGraphInput): PipelinePointLayer {
  const { labels } = input;

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

  return { blocks, taskPoints, itemPoints, sourcePoints, activeItems };
}
