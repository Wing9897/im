import {
  BaseEdge,
  type ConnectionLineComponentProps,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";

import {
  PIPELINE_EDGE_HIT_WIDTH,
  pipelineEdgeStroke,
  routePipelineEdge,
} from "../../domain/worksets/worksetPipelineGraph";

export type WorksetPipelineSmoothStepEdgeType = Edge<Record<string, never>, "smoothstep">;

/** ComfyUI-style cubic: one bezier from handle to handle (wires pass under cards). */
export function WorksetPipelineSmoothStepEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
}: EdgeProps<WorksetPipelineSmoothStepEdgeType>) {
  const { path } = routePipelineEdge({
    source: { x: sourceX, y: sourceY },
    target: { x: targetX, y: targetY },
  });
  const stroke = style?.stroke ?? pipelineEdgeStroke(id);
  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      style={{ ...style, stroke }}
      interactionWidth={PIPELINE_EDGE_HIT_WIDTH}
    />
  );
}

/** Drag preview uses the same handle-to-handle cubic as committed wires. */
export function WorksetPipelineConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
}: ConnectionLineComponentProps) {
  const { path } = routePipelineEdge({
    source: { x: fromX, y: fromY },
    target: { x: toX, y: toY },
  });
  return (
    <g className="react-flow__connection">
      <path d={path} fill="none" className="react-flow__connection-path" />
    </g>
  );
}
