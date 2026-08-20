/** L1–L3 household pipeline: blocks, points, and ownership wires. */

import { buildPipelinePointLayer } from "./pipelineGraphPoints";
import { buildPipelineEdgeLayer } from "./pipelineGraphEdges";
import type { PipelineGraph, PipelineGraphInput } from "./pipelineGraphTypes";

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

export {
  assistantOwnerWorksetId,
  channelIdsForSource,
  normalizePipelineChannelId,
  normalizePipelineChannelIds,
  sourceIdsForTaskChannels,
  taskCalendarWriteEnabled,
  taskIntelEnabled,
  taskNotifyEnabled,
  taskNotifyPrefOn,
  taskOwnerWorksetId,
  taskTimelineEnabled,
  worksetExternalOn,
  worksetNotifyOn,
} from "./pipelineGraphFlags";

/** Build the household pipeline: one block per kind, points listed one-by-one. */
export function buildWorksetPipelineGraph(input: PipelineGraphInput): PipelineGraph {
  const points = buildPipelinePointLayer(input);
  const edges = buildPipelineEdgeLayer(input, points);
  return { blocks: points.blocks, edges };
}
