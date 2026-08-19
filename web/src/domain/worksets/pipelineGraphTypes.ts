/** Household pipeline graph model: blocks, points, gates, and input rows. */

import type { PipelineColumn } from "./pipelineConstants";
import { PIPELINE_OUTPUT_DEFS, isPipelineOutputPageId, type PipelineOutputKind } from "./pipelineIds";

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

export function isPipelineOutputBlockKind(kind: PipelineBlockKind): boolean {
  return PIPELINE_OUTPUT_DEFS.some((row) => row.kind === kind);
}

export function isPipelineOutputPage(point: PipelinePoint): boolean {
  return point.kind === "page" && isPipelineOutputPageId(point.id);
}

export function pipelineEdge(
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
