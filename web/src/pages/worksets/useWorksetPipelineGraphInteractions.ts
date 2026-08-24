import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { Connection } from "@xyflow/react";

import {
  findPipelinePoint,
  isLegalConnectPair,
  pipelinePointsFromConnection,
  pointIdFromPipelineHandle,
} from "../../domain/worksets/worksetPipelineConnect";
import {
  isPipelineOutputPage,
  type PipelineGateKind,
  type PipelineGraph,
  type PipelinePoint,
} from "../../domain/worksets/worksetPipelineGraph";
import type { WorksetPipelineGraphData } from "./useWorksetPipelineGraphData";
import {
  applyPipelineConnect,
  applyPipelineGateToggle,
  applyPipelineHandleConnect,
  type GraphPatchDeps,
  type PipelineConnectResult,
} from "./worksetGraphPatches";

type ToastFn = (message: string, tone?: "info" | "error" | "success" | "warning") => void;

type Args = {
  graphRef: MutableRefObject<PipelineGraph>;
  dataRef: MutableRefObject<WorksetPipelineGraphData>;
  patchDepsRef: MutableRefObject<GraphPatchDeps>;
  filterKey: string;
  setExpandedBlockIds: Dispatch<SetStateAction<Set<string>>>;
  showToast: ToastFn;
};

/** Click / drag connect, edge focus, settings, gates, overflow, Escape. */
export function useWorksetPipelineGraphInteractions({
  graphRef,
  dataRef,
  patchDepsRef,
  filterKey,
  setExpandedBlockIds,
  showToast,
}: Args) {
  const { t } = useTranslation("workset");
  const [connectFrom, setConnectFrom] = useState<PipelinePoint | null>(null);
  const [connectViaDrag, setConnectViaDrag] = useState(false);
  const [focusedEdgeId, setFocusedEdgeId] = useState<string | null>(null);
  const [focusPointId, setFocusPointId] = useState<string | null>(null);
  const [settingsPoint, setSettingsPoint] = useState<PipelinePoint | null>(null);

  const connectFromRef = useRef(connectFrom);
  connectFromRef.current = connectFrom;

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
    [clearGraphSelection, connectFrom, dataRef, finishConnect, focusPointId, patchDepsRef, showToast, t],
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
    [dataRef, finishConnect, graphRef, patchDepsRef],
  );

  const isValidConnection = useCallback((connection: { sourceHandle?: string | null; targetHandle?: string | null }) => {
    const pair = pipelinePointsFromConnection(connection, graphRef.current);
    return Boolean(pair && isLegalConnectPair(pair[0], pair[1]));
  }, [graphRef]);

  const onConnectStart = useCallback((_event: unknown, params: { handleId: string | null }) => {
    const pointId = pointIdFromPipelineHandle(params.handleId);
    if (!pointId) return;
    const point = findPipelinePoint(graphRef.current, pointId);
    if (!point || isPipelineOutputPage(point)) return;
    setConnectViaDrag(true);
    setFocusedEdgeId(null);
    setFocusPointId(null);
    setConnectFrom(point);
  }, [graphRef]);

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
  }, [dataRef, patchDepsRef]);

  const onToggleOverflow = useCallback((blockId: string) => {
    setExpandedBlockIds((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  }, [setExpandedBlockIds]);

  useEffect(() => {
    setExpandedBlockIds(new Set());
    clearGraphSelection();
  }, [clearGraphSelection, filterKey, setExpandedBlockIds]);

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

  return {
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
  };
}
