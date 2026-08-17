import { BaseEdge, getSmoothStepPath, type Edge, type EdgeProps } from "@xyflow/react";

import {
  PIPELINE_EDGE_RADIUS,
  pipelineRoundedOrthogonalPath,
  pipelineSkipLayerWaypoints,
  type PipelineSkipDetour,
} from "../../domain/worksets/worksetPipelineGraph";

export type WorksetPipelineSmoothStepEdgeData = {
  detour?: PipelineSkipDetour;
};

export type WorksetPipelineSmoothStepEdgeType = Edge<WorksetPipelineSmoothStepEdgeData, "smoothstep">;

/** SmoothStep edges; L2→L4 skip-layer wires detour around the 工作集 card. */
export function WorksetPipelineSmoothStepEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
}: EdgeProps<WorksetPipelineSmoothStepEdgeType>) {
  const detour = data?.detour;
  if (detour) {
    const path = pipelineRoundedOrthogonalPath(
      pipelineSkipLayerWaypoints(sourceX, sourceY, targetX, targetY, detour),
    );
    return <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} interactionWidth={0} />;
  }
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: PIPELINE_EDGE_RADIUS,
    offset: 16,
  });
  return <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} interactionWidth={0} />;
}
