/**
 * Household pipeline graph: blocks contain points; wires follow real
 * ownership / output / subscription flags. Layout is session-only — not persisted.
 *
 * Split modules live beside this barrel; existing `worksetPipelineGraph` imports stay valid.
 */

export {
  PIPELINE_MAX_POINTS,
  PIPELINE_VISIBLE_POINTS,
  PIPELINE_MAX_VISIBLE_WORKSETS,
  PIPELINE_BLOCK_WIDTH,
  PIPELINE_ROW_HEIGHT,
  PIPELINE_HEADER_HEIGHT,
  PIPELINE_BODY_PAD_Y,
  PIPELINE_EMPTY_BODY_HEIGHT,
  PIPELINE_COL_GAP_Y,
  PIPELINE_ZONE_PAD_X,
  PIPELINE_COL_GAP_X,
  PIPELINE_ZONE_WIDTH,
  PIPELINE_ZONE_ORIGIN_X,
  PIPELINE_EDGE_TYPE,
  PIPELINE_EDGE_Z_INDEX,
  PIPELINE_BLOCK_Z_INDEX,
  PIPELINE_ZONE_Z_INDEX,
  PIPELINE_EDGE_RADIUS,
  PIPELINE_BEZIER_OFFSET,
  PIPELINE_EDGE_HIT_WIDTH,
  PIPELINE_EDGE_PALETTE,
  PIPELINE_COL_X,
  PIPELINE_FIT_VIEW_PADDING,
  PIPELINE_COL_START_Y,
  PIPELINE_LAYERS,
  PIPELINE_BLOCK_COLUMN,
  pipelineZoneX,
  pipelineLayerForColumn,
  pipelineEdgeColorIndex,
  pipelineEdgeStroke,
  type PipelineLayerId,
  type PipelineColumn,
} from "./pipelineConstants";

export {
  PIPELINE_BLOCK,
  PIPELINE_PAGE,
  PIPELINE_LAYER_PORT,
  PIPELINE_OUTPUT_DEFS,
  PIPELINE_HANDLE_IN_SUFFIX,
  PIPELINE_HANDLE_OUT_SUFFIX,
  pipelinePointHandleId,
  worksetPointId,
  taskPointId,
  itemPointId,
  sourcePointId,
  isPipelineLayerPortId,
  isPipelineOutputPageId,
  type PipelineOutputKind,
  type PipelineOutputDef,
} from "./pipelineIds";

export {
  pipelinePointHandleSides,
  pipelineBlockShowsLayerOutPort,
  type PipelineHandleSides,
} from "./pipelineHandleVisibility";

export {
  buildWorksetPipelineGraph,
  taskOwnerWorksetId,
  assistantOwnerWorksetId,
  taskIntelEnabled,
  taskTimelineEnabled,
  taskCalendarWriteEnabled,
  taskNotifyEnabled,
  taskNotifyPrefOn,
  worksetNotifyOn,
  worksetExternalOn,
  normalizePipelineChannelId,
  normalizePipelineChannelIds,
  sourceIdsForTaskChannels,
  channelIdsForSource,
  isPipelineOutputBlockKind,
  isPipelineOutputPage,
  type PipelineBlockKind,
  type PipelinePointKind,
  type PipelineGateKind,
  type PipelineGate,
  type PipelinePoint,
  type PipelineBlock,
  type PipelineEdge,
  type PipelineGraph,
  type PipelineWorksetInput,
  type PipelineChannelRef,
  type PipelineTaskInput,
  type PipelineItemInput,
  type PipelineSourceInput,
  type PipelineChannelSourceInput,
  type PipelineEventInput,
  type PipelineGraphLabels,
  type PipelineGraphInput,
} from "./buildWorksetPipelineGraph";

export { scopePipelineInputToWorkset, collapsePipelineGraph } from "./pipelineGraphScope";

export {
  layoutPipelineFlow,
  pipelineBlockHeight,
  pipelinePointHandleTop,
  resolvePipelineGraphFocus,
  type PipelineBlockFlowNode,
  type PipelineZoneFlowNode,
  type PipelineFlowNode,
  type PipelineFlowEdge,
  type PipelineGraphFocus,
} from "./layoutPipelineFlow";

export {
  routePipelineEdge,
  type PipelineVec,
  type PipelineEdgeRoute,
  type PipelineEdgeRouteInput,
} from "./pipelineEdgeGeometry";
