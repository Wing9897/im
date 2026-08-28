/** L4 shared output legend: workset-block port → page nodes (not per-card). */

import { PIPELINE_BLOCK, PIPELINE_LAYER_PORT, PIPELINE_OUTPUT_DEFS } from "./pipelineIds";
import { pipelineEdge, type PipelineEdge } from "./pipelineGraphTypes";

/**
 * Legend wires from the L3 工作集 block to L4 pages (timeline / intel /
 * local notify at `/notify?tab=notify` / actions at `/notify?tab=types`).
 * notifyEnabled / externalEnabled stay as card icons and do not gate these edges.
 */
export function buildPipelineLegendEdges(pointIds: ReadonlySet<string>): PipelineEdge[] {
  const edges: PipelineEdge[] = [];
  for (const row of PIPELINE_OUTPUT_DEFS) {
    if (!pointIds.has(row.pageId)) continue;
    edges.push(
      pipelineEdge(
        PIPELINE_BLOCK.worksets,
        PIPELINE_LAYER_PORT.worksets,
        row.blockId,
        row.pageId,
        false,
        true,
      ),
    );
  }
  return edges;
}
