import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useTaskCatalog } from "../../context/TaskCatalogContext";
import { useToast } from "../../context/ToastContext";
import { resolveGraphWorksetIds } from "../../domain/worksets/worksetGraphFilter";
import {
  buildWorksetPipelineGraph,
  collapsePipelineGraph,
  scopePipelineInputToWorkset,
} from "../../domain/worksets/worksetPipelineGraph";
import {
  parseWorksetGraphFilter,
  WORKSET_GRAPH_FILTER_PARAM,
} from "../../domain/worksets/worksetRoutes";
import { toError } from "../../utils/errors";
import { useWorksetPipelineGraphData } from "./useWorksetPipelineGraphData";
import { type GraphPatchDeps } from "./worksetGraphPatches";

/** Filter-scoped pipeline graph plus patch deps used by connect / gate handlers. */
export function useWorksetPipelineGraphModel() {
  const [searchParams] = useSearchParams();
  const data = useWorksetPipelineGraphData();
  const { worksets: catalogWorksets, refreshTasks, refreshWorksets } = useTaskCatalog();
  const { showToast } = useToast();
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

  const graphRef = useRef(graph);
  graphRef.current = graph;
  const dataRef = useRef(data);
  dataRef.current = data;
  const patchDepsRef = useRef(patchDeps);
  patchDepsRef.current = patchDeps;

  return {
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
  };
}
