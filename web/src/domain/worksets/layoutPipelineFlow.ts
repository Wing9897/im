/** Session-only xyflow layout for the household pipeline graph. */

import {
  PIPELINE_BLOCK_WIDTH,
  PIPELINE_BLOCK_Z_INDEX,
  PIPELINE_BODY_PAD_Y,
  PIPELINE_COL_GAP_Y,
  PIPELINE_COL_START_Y,
  PIPELINE_COL_X,
  PIPELINE_EDGE_HIT_WIDTH,
  PIPELINE_EDGE_TYPE,
  PIPELINE_EDGE_Z_INDEX,
  PIPELINE_EMPTY_BODY_HEIGHT,
  PIPELINE_HEADER_HEIGHT,
  PIPELINE_LAYERS,
  PIPELINE_ROW_HEIGHT,
  PIPELINE_ZONE_WIDTH,
  PIPELINE_ZONE_Z_INDEX,
  pipelineEdgeStroke,
  pipelineZoneX,
  type PipelineLayerId,
} from "./pipelineConstants";
import { PIPELINE_LAYER_PORT, pipelinePointHandleId } from "./pipelineIds";
import {
  isPipelineOutputBlockKind,
  type PipelineBlock,
  type PipelineGraph,
  type PipelinePoint,
} from "./pipelineGraphTypes";

export type PipelineBlockFlowNode = {
  id: string;
  type: "worksetBlock";
  position: { x: number; y: number };
  className: string;
  data: {
    block: PipelineBlock;
    selectedPointId: string | null;
    overflowCount: number;
    expanded: boolean;
    onSelectPoint?: (point: PipelinePoint) => void;
    onOpenSettings?: (point: PipelinePoint) => void;
    onToggleOverflow?: () => void;
  };
  draggable: false;
  connectable: boolean;
  selectable: false;
  zIndex: number;
  style: { width: number; height: number; pointerEvents: "all" };
};

export type PipelineZoneFlowNode = {
  id: string;
  type: "layerZone";
  position: { x: number; y: number };
  className: string;
  data: { layer: PipelineLayerId; titleKey: string };
  draggable: false;
  connectable: false;
  selectable: false;
  focusable: false;
  zIndex: number;
  style: { width: number; height: number; pointerEvents: "none" };
};

export type PipelineFlowNode = PipelineBlockFlowNode | PipelineZoneFlowNode;

export type PipelineFlowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  type: typeof PIPELINE_EDGE_TYPE;
  selectable: true;
  focusable: false;
  interactionWidth: number;
  zIndex: number;
  className: string;
  style: { stroke: string; strokeWidth: number };
};

export type PipelineGraphFocus =
  | { kind: "point"; pointId: string }
  | { kind: "edge"; edgeId: string };

export function resolvePipelineGraphFocus(
  graph: PipelineGraph,
  focus: PipelineGraphFocus | null | undefined,
): { edgeIds: Set<string>; pointIds: Set<string> } | null {
  if (!focus) return null;
  if (focus.kind === "edge") {
    const row = graph.edges.find((edge) => edge.id === focus.edgeId);
    return {
      edgeIds: new Set([focus.edgeId]),
      pointIds: row ? new Set([row.sourcePointId, row.targetPointId]) : new Set(),
    };
  }
  const edgeIds = new Set<string>();
  const pointIds = new Set<string>([focus.pointId]);
  for (const edge of graph.edges) {
    if (edge.sourcePointId === focus.pointId || edge.targetPointId === focus.pointId) {
      edgeIds.add(edge.id);
      pointIds.add(edge.sourcePointId);
      pointIds.add(edge.targetPointId);
    }
  }
  return { edgeIds, pointIds };
}

export function pipelineBlockHeight(pointCount: number, hasOverflowRow = false): number {
  if (pointCount === 0 && !hasOverflowRow) {
    return PIPELINE_HEADER_HEIGHT + PIPELINE_EMPTY_BODY_HEIGHT;
  }
  const rows = pointCount + (hasOverflowRow ? 1 : 0);
  return PIPELINE_HEADER_HEIGHT + PIPELINE_BODY_PAD_Y * 2 + rows * PIPELINE_ROW_HEIGHT;
}

/** Handle Y inside a block node — row center, not the header. */
export function pipelinePointHandleTop(index: number): number {
  return (
    PIPELINE_HEADER_HEIGHT +
    PIPELINE_BODY_PAD_Y +
    index * PIPELINE_ROW_HEIGHT +
    PIPELINE_ROW_HEIGHT / 2
  );
}

/** Session-only xyflow positions — not written back to the server. */
export function layoutPipelineFlow(
  graph: PipelineGraph,
  selectedPointId: string | null = null,
  legalTargetIds: ReadonlySet<string> | null = null,
  options?: {
    overflowByBlockId?: Readonly<Record<string, number>>;
    expandedBlockIds?: ReadonlySet<string>;
    focusedEdgeId?: string | null;
  },
): {
  nodes: PipelineFlowNode[];
  edges: PipelineFlowEdge[];
} {
  const targets = selectedPointId && legalTargetIds ? legalTargetIds : null;
  const overflowByBlockId = options?.overflowByBlockId ?? {};
  const expandedBlockIds = options?.expandedBlockIds ?? new Set<string>();
  const focus: PipelineGraphFocus | null = options?.focusedEdgeId
    ? { kind: "edge", edgeId: options.focusedEdgeId }
    : selectedPointId
      ? { kind: "point", pointId: selectedPointId }
      : null;
  const resolvedFocus = resolvePipelineGraphFocus(graph, focus);
  const brightPointIds = resolvedFocus ? new Set(resolvedFocus.pointIds) : null;
  if (brightPointIds && targets) {
    for (const id of targets) brightPointIds.add(id);
  }
  const colY = PIPELINE_COL_X.map(() => PIPELINE_COL_START_Y);
  const blockNodes: PipelineBlockFlowNode[] = graph.blocks.map((block) => {
    const points = targets
      ? block.points.map((point) => {
          const selected = point.id === selectedPointId;
          const legalTarget = targets.has(point.id);
          return {
            ...point,
            legalTarget,
            muted: selected ? false : !legalTarget,
          };
        })
      : block.points.map((point) => ({ ...point, legalTarget: false }));
    const laidOutBlock = { ...block, points };
    const overflowCount = overflowByBlockId[block.id] ?? 0;
    const height = pipelineBlockHeight(laidOutBlock.points.length, overflowCount > 0);
    const x = PIPELINE_COL_X[block.column];
    const y = colY[block.column];
    colY[block.column] += height + PIPELINE_COL_GAP_Y;
    const unfocused =
      brightPointIds != null &&
      !laidOutBlock.points.some((point) => brightPointIds.has(point.id)) &&
      !(block.kind === "worksets" && brightPointIds.has(PIPELINE_LAYER_PORT.worksets));
    const classNames = ["nopan", "nodrag"];
    if (laidOutBlock.points.length === 0) classNames.push("is-empty");
    if (unfocused) classNames.push("is-unfocused");
    return {
      id: block.id,
      type: "worksetBlock",
      position: { x, y },
      className: classNames.join(" "),
      data: {
        block: laidOutBlock,
        selectedPointId,
        overflowCount,
        expanded: expandedBlockIds.has(block.id),
      },
      draggable: false,
      connectable: !isPipelineOutputBlockKind(block.kind) && laidOutBlock.points.length > 0,
      selectable: false,
      zIndex: PIPELINE_BLOCK_Z_INDEX,
      style: { width: PIPELINE_BLOCK_WIDTH, height, pointerEvents: "all" },
    };
  });
  const zoneNodes: PipelineZoneFlowNode[] = PIPELINE_LAYERS.map((layer) => {
    const nextY = colY[layer.column];
    const contentBottom =
      nextY > PIPELINE_COL_START_Y ? nextY - PIPELINE_COL_GAP_Y + 10 : PIPELINE_COL_START_Y + 24;
    return {
      id: `zone-${layer.id}`,
      type: "layerZone",
      position: { x: pipelineZoneX(layer.column), y: 0 },
      className: `im-ws-graph-zone-node is-${layer.id} nopan nodrag`,
      data: { layer: layer.id, titleKey: layer.titleKey },
      draggable: false,
      connectable: false,
      selectable: false,
      focusable: false,
      zIndex: PIPELINE_ZONE_Z_INDEX,
      style: { width: PIPELINE_ZONE_WIDTH, height: contentBottom, pointerEvents: "none" },
    };
  });
  const nodes: PipelineFlowNode[] = [...zoneNodes, ...blockNodes];
  const edges: PipelineFlowEdge[] = graph.edges.map((row) => {
    const focused = resolvedFocus?.edgeIds.has(row.id) === true;
    const dimmed = resolvedFocus != null && !focused;
    const classNames = ["im-ws-graph-edge"];
    if (row.muted) classNames.push("is-muted");
    if (row.legend) classNames.push("is-legend");
    if (dimmed) classNames.push("is-dimmed");
    if (focused) classNames.push("is-focused");
    return {
      id: row.id,
      source: row.sourceBlockId,
      target: row.targetBlockId,
      sourceHandle: pipelinePointHandleId(row.sourcePointId, "out"),
      targetHandle: pipelinePointHandleId(row.targetPointId, "in"),
      type: PIPELINE_EDGE_TYPE,
      selectable: true,
      focusable: false,
      interactionWidth: PIPELINE_EDGE_HIT_WIDTH,
      zIndex: focused ? PIPELINE_EDGE_Z_INDEX + 1 : PIPELINE_EDGE_Z_INDEX,
      className: classNames.join(" "),
      style: {
        stroke: pipelineEdgeStroke(row.id),
        strokeWidth: focused ? 2.75 : 2,
      },
    };
  });

  return { nodes, edges };
}
