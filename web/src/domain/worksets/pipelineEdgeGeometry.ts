/**
 * ComfyUI-style cubic wires: one bezier from handle to handle.
 * Cards sit on top of the stroke; routing does not wrap zone AABBs.
 */

import { PIPELINE_BEZIER_OFFSET } from "./pipelineConstants";

export type PipelineVec = { x: number; y: number };

export type PipelineEdgeRouteInput = {
  source: PipelineVec;
  target: PipelineVec;
};

export type PipelineEdgeRoute = {
  path: string;
  samples: PipelineVec[];
};

type Cubic = {
  p0: PipelineVec;
  c1: PipelineVec;
  c2: PipelineVec;
  p3: PipelineVec;
};

const SAMPLE_STEPS = 24;

function fmt(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function cubicPoint(curve: Cubic, t: number): PipelineVec {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  return {
    x: uu * u * curve.p0.x + 3 * uu * t * curve.c1.x + 3 * u * tt * curve.c2.x + tt * t * curve.p3.x,
    y: uu * u * curve.p0.y + 3 * uu * t * curve.c1.y + 3 * u * tt * curve.c2.y + tt * t * curve.p3.y,
  };
}

function sampleCubic(curve: Cubic, steps = SAMPLE_STEPS): PipelineVec[] {
  const points: PipelineVec[] = [];
  for (let i = 0; i <= steps; i += 1) {
    points.push(cubicPoint(curve, i / steps));
  }
  return points;
}

function cubicPath(curve: Cubic): string {
  return `M ${fmt(curve.p0.x)} ${fmt(curve.p0.y)} C ${fmt(curve.c1.x)} ${fmt(curve.c1.y)} ${fmt(curve.c2.x)} ${fmt(curve.c2.y)} ${fmt(curve.p3.x)} ${fmt(curve.p3.y)}`;
}

/** Horizontal control points at `PIPELINE_BEZIER_OFFSET` along dx (ComfyUI). */
function handleCubic(source: PipelineVec, target: PipelineVec): Cubic {
  const dx = target.x - source.x;
  const offset = dx * PIPELINE_BEZIER_OFFSET;
  return {
    p0: source,
    c1: { x: source.x + offset, y: source.y },
    c2: { x: target.x - offset, y: target.y },
    p3: target,
  };
}

/** Single cubic from handle to handle — skip-layer and adjacent use the same curve. */
export function routePipelineEdge(input: PipelineEdgeRouteInput): PipelineEdgeRoute {
  const curve = handleCubic(input.source, input.target);
  return {
    path: cubicPath(curve),
    samples: sampleCubic(curve),
  };
}
