import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type Connection,
} from "@xyflow/react";
import { useTranslation } from "react-i18next";

import { useSearchParams } from "react-router-dom";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import { resolveGraphWorksetIds } from "../../domain/worksets/worksetGraphFilter";
import { useToast } from "../../context/ToastContext";
import {
  connectHintKey,
  findPipelinePoint,
  isLegalConnectPair,
  legalConnectTargetIds,
  pipelinePointsFromConnection,
  pointIdFromPipelineHandle,
} from "../../domain/worksets/worksetPipelineConnect";
import {
  buildWorksetPipelineGraph,
  collapsePipelineGraph,
  isPipelineOutputPage,
  layoutPipelineFlow,
  scopePipelineInputToWorkset,
  PIPELINE_EDGE_TYPE,
  PIPELINE_EDGE_Z_INDEX,
  PIPELINE_FIT_VIEW_PADDING,
  type PipelineGateKind,
  type PipelinePoint,
} from "../../domain/worksets/worksetPipelineGraph";
import {
  parseWorksetGraphFilter,
  WORKSET_GRAPH_FILTER_PARAM,
} from "../../domain/worksets/worksetRoutes";
import { toError } from "../../utils/errors";
import { WorksetGraphLayerZone, WorksetGraphNode } from "./WorksetGraphNode";
import { WorksetGraphPointModal } from "./WorksetGraphPointModal";
import { WorksetPipelineConnectionLine, WorksetPipelineSmoothStepEdge } from "./WorksetPipelineSmoothStepEdge";
import { useWorksetPipelineGraphData } from "./useWorksetPipelineGraphData";
import {
  applyPipelineConnect,
  applyPipelineGateToggle,
  applyPipelineHandleConnect,
  type GraphPatchDeps,
  type PipelineConnectResult,
} from "./worksetGraphPatches";

import "@xyflow/react/dist/style.css";

const NODE_TYPES = { worksetBlock: WorksetGraphNode, layerZone: WorksetGraphLayerZone };
const EDGE_TYPES = { smoothstep: WorksetPipelineSmoothStepEdge };

function WorksetPipelineGraphCanvas() {
  const { t } = useTranslation("workset");
  const { fitView } = useReactFlow();
  const [searchParams] = useSearchParams();
  const data = useWorksetPipelineGraphData();
  const { worksets: catalogWorksets, refreshTasks, refreshWorksets } = useTaskCatalog();
  const { showToast } = useToast();
  const [connectFrom, setConnectFrom] = useState<PipelinePoint | null>(null);
  const [connectViaDrag, setConnectViaDrag] = useState(false);
  const [focusedEdgeId, setFocusedEdgeId] = useState<string | null>(null);
  const [focusPointId, setFocusPointId] = useState<string | null>(null);
  const [settingsPoint, setSettingsPoint] = useState<PipelinePoint | null>(null);
  const filterParam = searchParams.get(WORKSET_GRAPH_FILTER_PARAM);
  const filterWorksetIds = useMemo(
    () => resolveGraphWorksetIds(parseWorksetGraphFilter(filterParam), catalogWorksets),
    [catalogWorksets, filterParam],
  );
  const filterKey = filterWorksetIds.join(",");
  const [expandedBlockIds, setExpandedBlockIds] = useState<Set<string>>(() => new Set());

  const scopedInput = useMemo(
    () =>
      scopePipelineInputToWorkset(
        {
          worksets: data.worksets,
          tasks: data.tasks,
          items: data.items,
          sources: data.sources,
          channels: data.channels,
          events: data.events,
          labels: data.labels,
          assistantDefaultWorksetId: data.assistantDefaultWorksetId,
        },
        filterWorksetIds,
      ),
    [
      data.assistantDefaultWorksetId,
      data.channels,
      data.events,
      data.items,
      data.labels,
      data.sources,
      data.tasks,
      data.worksets,
      filterWorksetIds,
    ],
  );

  const fullGraph = useMemo(() => buildWorksetPipelineGraph(scopedInput), [scopedInput]);
  const { graph, overflowByBlockId } = useMemo(
    () => collapsePipelineGraph(fullGraph, expandedBlockIds),
    [expandedBlockIds, fullGraph],
  );

  const patchDeps = useMemo<GraphPatchDeps>(
    () => ({
      refreshTasks,
      refreshWorksets,
      reloadGraph: data.reload,
      onError: (error) => showToast(toError(error).message, "error"),
    }),
    [data.reload, refreshTasks, refreshWorksets, showToast],
  );

  const connectFromRef = useRef(connectFrom);
  connectFromRef.current = connectFrom;
  const graphRef = useRef(graph);
  graphRef.current = graph;
  const dataRef = useRef(data);
  dataRef.current = data;
  const patchDepsRef = useRef(patchDeps);
  patchDepsRef.current = patchDeps;

  const clearConnect = useCallback(() => {
    setConnectFrom(null);
    setConnectViaDrag(false);
  }, []);

  const clearGraphSelection = useCallback(() => {
    clearConnect();
    setFocusedEdgeId(null);
    setFocusPointId(null);
  }, [clearConnect]);

  const finishConnect = useCallback(
    (result: PipelineConnectResult) => {
      if (result === "disconnected") {
        showToast(t("graphConnectDisconnected"), "info");
      } else if (result === "illegal") {
        showToast(t("graphConnectIllegal"), "info");
      }
      clearGraphSelection();
    },
    [clearGraphSelection, showToast, t],
  );

  const onSelectPoint = useCallback(
    (point: PipelinePoint) => {
      if (isPipelineOutputPage(point)) {
        if (focusPointId === point.id && !connectFrom) {
          clearGraphSelection();
          return;
        }
        setConnectFrom(null);
        setConnectViaDrag(false);
        setFocusedEdgeId(null);
        setFocusPointId(point.id);
        return;
      }
      const from = connectFromRef.current;
      setFocusPointId(null);
      if (!from) {
        setConnectViaDrag(false);
        setFocusedEdgeId(null);
        setConnectFrom(point);
        return;
      }
      if (from.id === point.id) {
        clearGraphSelection();
        return;
      }
      if (!isLegalConnectPair(from, point)) {
        showToast(t("graphConnectIllegal"), "info");
        return;
      }
      void applyPipelineConnect(from, point, dataRef.current, patchDepsRef.current).then(finishConnect);
    },
    [clearGraphSelection, connectFrom, finishConnect, focusPointId, showToast, t],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      void applyPipelineHandleConnect(
        connection,
        graphRef.current,
        dataRef.current,
        patchDepsRef.current,
      ).then(finishConnect);
    },
    [finishConnect],
  );

  const isValidConnection = useCallback((connection: { sourceHandle?: string | null; targetHandle?: string | null }) => {
    const pair = pipelinePointsFromConnection(connection, graphRef.current);
    return Boolean(pair && isLegalConnectPair(pair[0], pair[1]));
  }, []);

  const onConnectStart = useCallback((_event: unknown, params: { handleId: string | null }) => {
    const pointId = pointIdFromPipelineHandle(params.handleId);
    if (!pointId) return;
    const point = findPipelinePoint(graphRef.current, pointId);
    if (!point || isPipelineOutputPage(point)) return;
    setConnectViaDrag(true);
    setFocusedEdgeId(null);
    setFocusPointId(null);
    setConnectFrom(point);
  }, []);

  const onConnectEnd = useCallback(() => {
    clearConnect();
  }, [clearConnect]);

  const onEdgeClick = useCallback((event: { stopPropagation: () => void }, edge: { id: string }) => {
    event.stopPropagation();
    clearConnect();
    setFocusPointId(null);
    setFocusedEdgeId(edge.id);
  }, [clearConnect]);

  const onOpenSettings = useCallback((point: PipelinePoint) => {
    setSettingsPoint(point);
  }, []);

  const onToggleGate = useCallback((point: PipelinePoint, kind: PipelineGateKind) => {
    void applyPipelineGateToggle(point, kind, dataRef.current, patchDepsRef.current);
  }, []);

  const onToggleOverflow = useCallback((blockId: string) => {
    setExpandedBlockIds((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  }, []);

  useEffect(() => {
    setExpandedBlockIds(new Set());
    clearGraphSelection();
  }, [clearGraphSelection, filterKey]);

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

  useEffect(() => {
    if (settingsPoint) return;
    if (!connectFrom && !focusedEdgeId && !focusPointId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      clearGraphSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearGraphSelection, connectFrom, focusPointId, focusedEdgeId, settingsPoint]);

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
