/**
 * Household pipeline graph: sizes, layer columns, and z-index.
 * Layout is session-only — not persisted.
 */

export const PIPELINE_MAX_POINTS = 24;
export const PIPELINE_VISIBLE_POINTS = 8;
/** Max workset nodes rendered on the household graph (not the per-block overflow chip). */
export const PIPELINE_MAX_VISIBLE_WORKSETS = 10;
/**
 * Card width SoT for the 4-layer household graph.
 * 240px leaves room for `[live-eval] …` task titles beside point gates;
 * zone/column X and out-handle X all derive from this.
 */
export const PIPELINE_BLOCK_WIDTH = 240;
export const PIPELINE_ROW_HEIGHT = 24;
export const PIPELINE_HEADER_HEIGHT = 30;
export const PIPELINE_BODY_PAD_Y = 4;
export const PIPELINE_EMPTY_BODY_HEIGHT = 20;
export const PIPELINE_COL_GAP_Y = 12;
/** Inner pad from zone left/right to the block. */
export const PIPELINE_ZONE_PAD_X = 10;
/** Corridor between layer zones. */
export const PIPELINE_COL_GAP_X = 64;
export const PIPELINE_ZONE_WIDTH = PIPELINE_BLOCK_WIDTH + PIPELINE_ZONE_PAD_X * 2;
export const PIPELINE_ZONE_ORIGIN_X = 8;
export const PIPELINE_EDGE_TYPE = "smoothstep";
/** Wires sit under zone/block cards (ComfyUI). */
export const PIPELINE_EDGE_Z_INDEX = 0;
export const PIPELINE_ZONE_Z_INDEX = 2;
export const PIPELINE_BLOCK_Z_INDEX = 4;
export const PIPELINE_EDGE_RADIUS = 8;
/** Control-point offset along dx for the handle-to-handle cubic. */
export const PIPELINE_BEZIER_OFFSET = 0.5;
/** Wider than the stroke so wires are clickable without blocking pan. */
export const PIPELINE_EDGE_HIT_WIDTH = 20;

/**
 * Distinct wire hues hashed from edge id — looks random, stable across pan/re-render.
 * Mid-bright saturations stay readable on the dark frost canvas.
 */
export const PIPELINE_EDGE_PALETTE = [
  "#6EA8FF",
  "#5EE0A8",
  "#FFD166",
  "#FF8A70",
  "#C792EA",
  "#4DD0E1",
  "#FF7EB6",
  "#B8E986",
  "#82B1FF",
  "#FFB74D",
  "#80CBC4",
  "#F48FB1",
] as const;

/** FNV-1a so the same edge id always maps to the same palette slot. */
export function pipelineEdgeColorIndex(edgeId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < edgeId.length; i += 1) {
    hash ^= edgeId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % PIPELINE_EDGE_PALETTE.length;
}

export function pipelineEdgeStroke(edgeId: string): string {
  return PIPELINE_EDGE_PALETTE[pipelineEdgeColorIndex(edgeId)];
}

export function pipelineZoneX(column: number): number {
  return PIPELINE_ZONE_ORIGIN_X + column * (PIPELINE_ZONE_WIDTH + PIPELINE_COL_GAP_X);
}

export const PIPELINE_COL_X = [
  pipelineZoneX(0) + PIPELINE_ZONE_PAD_X,
  pipelineZoneX(1) + PIPELINE_ZONE_PAD_X,
  pipelineZoneX(2) + PIPELINE_ZONE_PAD_X,
  pipelineZoneX(3) + PIPELINE_ZONE_PAD_X,
] as const;
export const PIPELINE_FIT_VIEW_PADDING = 0.1;
export const PIPELINE_COL_START_Y = 28;

/** Four always-on columns: L1 來源+物品 · L2 任務+助手 · L3 工作集 · L4 輸出層. */
export const PIPELINE_LAYERS = [
  { id: "layer1", titleKey: "graphLayer1", column: 0 },
  { id: "layer2", titleKey: "graphLayer2", column: 1 },
  { id: "layer3", titleKey: "graphLayer3", column: 2 },
  { id: "layer4", titleKey: "graphLayer4", column: 3 },
] as const;

export type PipelineLayerId = (typeof PIPELINE_LAYERS)[number]["id"];
export type PipelineColumn = 0 | 1 | 2 | 3;

/** Block → column. Sources do not feed items/assistant; items skip L2 to worksets. */
export const PIPELINE_BLOCK_COLUMN = {
  sources: 0,
  items: 0,
  tasks: 1,
  assistant: 1,
  worksets: 2,
  timeline: 3,
  intel: 3,
  notify: 3,
  external: 3,
} as const satisfies Record<string, PipelineColumn>;

export function pipelineLayerForColumn(column: PipelineColumn): PipelineLayerId {
  return PIPELINE_LAYERS[column].id;
}
