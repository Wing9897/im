import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
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
  layoutPipelineFlow,
  scopePipelineInputToWorkset,
  PIPELINE_EDGE_TYPE,
  PIPELINE_EDGE_Z_INDEX,
  PIPELINE_FIT_VIEW_PADDING,
  type PipelinePoint,
} from "../../domain/worksets/worksetPipelineGraph";
import {
  parseWorksetGraphFilter,
  WORKSET_GRAPH_FILTER_PARAM,
} from "../../domain/worksets/worksetRoutes";
import { toError } from "../../utils/errors";
import { WorksetGraphLayerZone, WorksetGraphNode } from "./WorksetGraphNode";
import { WorksetGraphPointModal } from "./WorksetGraphPointModal";
import { WorksetPipelineSmoothStepEdge } from "./WorksetPipelineSmoothStepEdge";
import { useWorksetPipelineGraphData } from "./useWorksetPipelineGraphData";
import {
  applyPipelineConnect,
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
  const { refreshTasks, refreshWorksets } = useTaskCatalog();
  const { showToast } = useToast();
  const [connectFrom, setConnectFrom] = useState<PipelinePoint | null>(null);
  const [connectViaDrag, setConnectViaDrag] = useState(false);
  const [settingsPoint, setSettingsPoint] = useState<PipelinePoint | null>(null);
  const filterWorksetId = parseWorksetGraphFilter(searchParams.get(WORKSET_GRAPH_FILTER_PARAM));
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
        },
        filterWorksetId,
      ),
    [
      data.channels,
      data.events,
      data.items,
      data.labels,
      data.sources,
      data.tasks,
      data.worksets,
      filterWorksetId,
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

  const finishConnect = useCallback(
    (result: PipelineConnectResult) => {
      if (result === "disconnected") {
        showToast(t("graphConnectDisconnected"), "info");
      } else if (result === "illegal") {
        showToast(t("graphConnectIllegal"), "info");
      }
      clearConnect();
    },
    [clearConnect, showToast, t],
  );

  const onSelectPoint = useCallback(
    (point: PipelinePoint) => {
      const from = connectFromRef.current;
      if (!from) {
        setConnectViaDrag(false);
        setConnectFrom(point);
        return;
      }
      if (from.id === point.id) {
        clearConnect();
        return;
      }
      if (!isLegalConnectPair(from, point)) {
        showToast(t("graphConnectIllegal"), "info");
        return;
      }
      void applyPipelineConnect(from, point, dataRef.current, patchDepsRef.current).then(finishConnect);
    },
    [clearConnect, finishConnect, showToast, t],
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
    if (!point) return;
    setConnectViaDrag(true);
    setConnectFrom(point);
  }, []);

  const onConnectEnd = useCallback(() => {
    clearConnect();
  }, [clearConnect]);

  const onOpenSettings = useCallback((point: PipelinePoint) => {
    setSettingsPoint(point);
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
    setConnectFrom(null);
    setConnectViaDrag(false);
  }, [filterWorksetId]);

  const legalIds = useMemo(
    () => (connectFrom ? legalConnectTargetIds(connectFrom, graph) : null),
    [connectFrom, graph],
  );

  const laidOut = useMemo(
    () =>
      layoutPipelineFlow(graph, connectFrom?.id ?? null, legalIds, {
        overflowByBlockId,
        expandedBlockIds,
      }),
    [connectFrom?.id, expandedBlockIds, graph, legalIds, overflowByBlockId],
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
            onToggleOverflow: () => onToggleOverflow(node.id),
          },
        };
      }),
    [laidOut.nodes, onOpenSettings, onSelectPoint, onToggleOverflow],
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
        filterWorksetId ?? "",
        [...expandedBlockIds].sort().join(","),
      ].join("::"),
    [connectFrom?.id, expandedBlockIds, filterWorksetId, graph.blocks],
  );
  const fitKey = useMemo(
    () =>
      [
        graph.blocks
          .map((block) => `${block.id}:${block.points.map((point) => point.id).join(",")}`)
          .join("|"),
        filterWorksetId ?? "",
        [...expandedBlockIds].sort().join(","),
      ].join("::"),
    [expandedBlockIds, filterWorksetId, graph.blocks],
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
    if (!connectFrom || settingsPoint) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      clearConnect();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearConnect, connectFrom, settingsPoint]);

  const edgeIds = graph.edges.map((edge) => edge.id).join(",");

  return (
    <div
      className="im-ws-graph-shell"
      data-testid="workset-pipeline-graph"
      data-edge-ids={edgeIds}
      data-filter-workset={filterWorksetId ?? "all"}
    >
      <div className="im-ws-graph-canvas">
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
          onPaneClick={clearConnect}
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
          connectionLineType={ConnectionLineType.SmoothStep}
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
