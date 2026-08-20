/** Ownership / subscription wires on top of the point layer. */

import {
  PIPELINE_BLOCK,
  PIPELINE_PAGE,
  isPipelineLayerPortId,
  itemPointId,
  sourcePointId,
  taskPointId,
  worksetPointId,
} from "./pipelineIds";
import { buildPipelineLegendEdges } from "./pipelineGraphLegend";
import {
  assistantOwnerWorksetId,
  normalizePipelineChannelIds,
  sourceIdsForTaskChannels,
  taskOwnerWorksetId,
} from "./pipelineGraphFlags";
import type { PipelinePointLayer } from "./pipelineGraphPoints";
import {
  pipelineEdge,
  type PipelineEdge,
  type PipelineGraphInput,
} from "./pipelineGraphTypes";

export function buildPipelineEdgeLayer(
  input: PipelineGraphInput,
  layer: PipelinePointLayer,
): PipelineEdge[] {
  const channels = input.channels ?? [];
  const knownWorksetIds = new Set(input.worksets.map((row) => row.id));
  const pointIds = new Set(layer.blocks.flatMap((block) => block.points.map((point) => point.id)));
  const edges: PipelineEdge[] = [];
  const pushEdge = (
    sourceBlockId: string,
    sourcePointIdValue: string,
    targetBlockId: string,
    targetPointId: string,
    muted = false,
  ) => {
    if (
      (!pointIds.has(sourcePointIdValue) && !isPipelineLayerPortId(sourcePointIdValue)) ||
      !pointIds.has(targetPointId)
    ) {
      return;
    }
    edges.push(pipelineEdge(sourceBlockId, sourcePointIdValue, targetBlockId, targetPointId, muted));
  };

  const visibleTaskIds = new Set(
    layer.taskPoints.filter((point) => point.kind === "task").map((point) => point.entityId),
  );
  const visibleSourceIds = new Set(
    layer.sourcePoints.filter((point) => point.kind === "source").map((point) => point.entityId),
  );
  for (const task of input.tasks) {
    if (!visibleTaskIds.has(task.id)) continue;
    const taskId = taskPointId(task.id);
    const ownerId = taskOwnerWorksetId(task);
    if (knownWorksetIds.has(ownerId)) {
      pushEdge(PIPELINE_BLOCK.tasks, taskId, PIPELINE_BLOCK.worksets, worksetPointId(ownerId));
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
        taskId,
      );
    }
  }

  const visibleItemIds = new Set(
    layer.itemPoints.filter((point) => point.kind === "item").map((point) => point.entityId),
  );
  for (const item of layer.activeItems) {
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

  return edges;
}
