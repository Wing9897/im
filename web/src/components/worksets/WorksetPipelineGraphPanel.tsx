import { useEffect, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { useTranslation } from "react-i18next";

import { connectHintKey, legalConnectTargetIds } from "../../domain/worksets/worksetPipelineConnect";
import {
  layoutPipelineFlow,
  PIPELINE_EDGE_TYPE,
  PIPELINE_EDGE_Z_INDEX,
  PIPELINE_FIT_VIEW_PADDING,
} from "../../domain/worksets/worksetPipelineGraph";
import { WorksetGraphLayerZone, WorksetGraphNode } from "./WorksetGraphNode";
import { WorksetGraphPointModal } from "./WorksetGraphPointModal";
import { WorksetPipelineConnectionLine, WorksetPipelineSmoothStepEdge } from "./WorksetPipelineSmoothStepEdge";
import { useWorksetPipelineGraphInteractions } from "./useWorksetPipelineGraphInteractions";
import { useWorksetPipelineGraphModel } from "./useWorksetPipelineGraphModel";

import "@xyflow/react/dist/style.css";

const NODE_TYPES = { worksetBlock: WorksetGraphNode, layerZone: WorksetGraphLayerZone };
const EDGE_TYPES = { smoothstep: WorksetPipelineSmoothStepEdge };

function WorksetPipelineGraphCanvas() {
  const { t } = useTranslation("workset");
  const { fitView } = useReactFlow();
  const model = useWorksetPipelineGraphModel();
  const {
    data,
    graph,
    overflowByBlockId,
    expandedBlockIds,
    setExpandedBlockIds,
    filterKey,
    graphRef,
    dataRef,
    patchDepsRef,
    showToast,
  } = model;
  const {
    connectFrom,
    connectViaDrag,
    focusedEdgeId,
    focusPointId,
    settingsPoint,
    setSettingsPoint,
    clearGraphSelection,
    onSelectPoint,
    onConnect,
    isValidConnection,
    onConnectStart,
    onConnectEnd,
    onEdgeClick,
    onOpenSettings,
    onToggleGate,
    onToggleOverflow,
  } = useWorksetPipelineGraphInteractions({
    graphRef,
    dataRef,
    patchDepsRef,
    filterKey,
    setExpandedBlockIds,
    showToast,
  });

  const legalIds = useMemo(
    () => (connectFrom ? legalConnectTargetIds(connectFrom, graph) : null),
    [connectFrom, graph],
  );

  const laidOut = useMemo(
    () =>
      layoutPipelineFlow(graph, connectFrom?.id ?? focusPointId, legalIds, {
        overflowByBlockId,
        expandedBlockIds,
        focusedEdgeId,
      }),
    [connectFrom?.id, expandedBlockIds, focusPointId, focusedEdgeId, graph, legalIds, overflowByBlockId],
  );
  const nodesWithHandlers = useMemo(
    () =>
      laidOut.nodes.map((node) => {
        if (node.type !== "worksetBlock") return node;
        return {
          ...node,
          data: {
            ...node.data,
            onSelectPoint,
            onOpenSettings,
            onToggleGate,
            onToggleOverflow: () => onToggleOverflow(node.id),
          },
        };
      }),
    [laidOut.nodes, onOpenSettings, onSelectPoint, onToggleGate, onToggleOverflow],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(nodesWithHandlers);
  const [edges, setEdges, onEdgesChange] = useEdgesState(laidOut.edges);

  const layoutKey = useMemo(
    () =>
      [
        graph.blocks
          .map((block) => `${block.id}:${block.points.map((point) => point.id).join(",")}`)
          .join("|"),
        connectFrom?.id ?? "",
        focusPointId ?? "",
        focusedEdgeId ?? "",
        filterKey,
        [...expandedBlockIds].sort().join(","),
      ].join("::"),
    [connectFrom?.id, expandedBlockIds, filterKey, focusPointId, focusedEdgeId, graph.blocks],
  );
  const fitKey = useMemo(
    () =>
      [
        graph.blocks
          .map((block) => `${block.id}:${block.points.map((point) => point.id).join(",")}`)
          .join("|"),
        filterKey,
        [...expandedBlockIds].sort().join(","),
      ].join("::"),
    [expandedBlockIds, filterKey, graph.blocks],
  );

  useEffect(() => {
    setNodes(nodesWithHandlers);
    setEdges(laidOut.edges);
  }, [layoutKey, laidOut.edges, nodesWithHandlers, setEdges, setNodes]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void fitView({
        padding: PIPELINE_FIT_VIEW_PADDING,
        minZoom: 0.5,
        maxZoom: 1.15,
        duration: 160,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [fitKey, fitView]);

  const edgeIds = graph.edges.map((edge) => edge.id).join(",");
  const graphFocus =
    focusedEdgeId != null
      ? `edge:${focusedEdgeId}`
      : connectFrom
        ? `point:${connectFrom.id}`
        : focusPointId
          ? `point:${focusPointId}`
          : "none";

  return (
    <div
      className="im-ws-graph-shell"
      data-testid="workset-pipeline-graph"
      data-edge-ids={edgeIds}
      data-graph-focus={graphFocus}
      data-filter-workset={filterKey || "none"}
    >
      <div className="im-ws-graph-canvas im-surface-panel">
        {connectFrom ? (
          <div className="im-ws-graph-connect-hint" data-testid="workset-graph-connect-hint">
            {t(connectViaDrag ? "graphConnectHintDrag" : connectHintKey(connectFrom))}
          </div>
        ) : null}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onPaneClick={clearGraphSelection}
          onEdgeClick={onEdgeClick}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          isValidConnection={isValidConnection}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          nodesDraggable={false}
          nodesConnectable
          edgesReconnectable={false}
          elementsSelectable={false}
          connectionMode={ConnectionMode.Loose}
          connectionLineComponent={WorksetPipelineConnectionLine}
          connectionRadius={28}
          panOnDrag
          panOnScroll
          zoomOnScroll
          minZoom={0.35}
          maxZoom={1.4}
          fitView
          fitViewOptions={{
            padding: PIPELINE_FIT_VIEW_PADDING,
            minZoom: 0.5,
            maxZoom: 1.15,
          }}
          deleteKeyCode={null}
          defaultEdgeOptions={{ type: PIPELINE_EDGE_TYPE, animated: false, zIndex: PIPELINE_EDGE_Z_INDEX }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={18}
            size={1}
            color="var(--surface-border)"
          />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <WorksetGraphPointModal
        point={settingsPoint}
        data={data}
        onClose={() => setSettingsPoint(null)}
      />
    </div>
  );
}

/** Household graph: full-bleed canvas, drag- or click-to-connect, settings modal. */
export function WorksetPipelineGraphPanel() {
  return (
    <ReactFlowProvider>
      <WorksetPipelineGraphCanvas />
    </ReactFlowProvider>
  );
}
