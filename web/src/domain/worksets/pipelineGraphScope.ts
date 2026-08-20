/** Filter household graph input to selected worksets; cap visible points per block. */

import { PIPELINE_VISIBLE_POINTS } from "./pipelineConstants";
import {
  normalizePipelineChannelIds,
  sourceIdsForTaskChannels,
  taskOwnerWorksetId,
} from "./pipelineGraphFlags";
import type { PipelineGraph, PipelineGraphInput } from "./pipelineGraphTypes";

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

/** Collapse expanded-block overflow: hide extra points and drop dangling wires. */
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
