import { useEffect, useMemo, useState } from "react";

import { fetchEvents } from "../api/results";
import { listSources } from "../api/sources";
import { useTaskCatalog } from "../context/TaskCatalogContext";
import { PIPELINE_EVER_COMPLETED_KEY } from "../domain/prefs";
import {
  countActiveAnalysisTasks,
  nextPipelineEverCompleted,
  pipelineReadiness,
  type PipelineReadiness,
} from "../domain/pipeline/pipelineReadiness";
import { usePersistedState } from "./usePersistedState";

const IDLE: PipelineReadiness = { state: "no_sources", showChecklist: false };

/**
 * Live pipeline checklist state for Tasks and Intelligence (not Timeline).
 * Completeness uses unfiltered analysis-event totalCount (not page filters).
 */
export function usePipelineReadiness(): PipelineReadiness & { loading: boolean } {
  const { tasks, tasksLoading } = useTaskCatalog();
  const [everCompleted, setEverCompleted] = usePersistedState(
    PIPELINE_EVER_COMPLETED_KEY,
    false,
  );
  const [sourceCount, setSourceCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [countsLoading, setCountsLoading] = useState(true);

  const activeAnalysisTaskCount = useMemo(
    () => countActiveAnalysisTasks(tasks),
    [tasks],
  );

  useEffect(() => {
    let cancelled = false;
    setCountsLoading(true);
    void Promise.all([
      listSources().then((sources) => sources.length),
      fetchEvents({ limit: 1, includeTotal: true }).then((page) => page.totalCount ?? 0),
    ])
      .then(([sources, total]) => {
        if (cancelled) return;
        setSourceCount(sources);
        setEventCount(total);
      })
      .catch(() => {
        if (cancelled) return;
        setSourceCount(0);
        setEventCount(0);
      })
      .finally(() => {
        if (!cancelled) setCountsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tasks.length, activeAnalysisTaskCount]);

  const loading = tasksLoading || countsLoading;

  useEffect(() => {
    if (loading) return;
    const next = nextPipelineEverCompleted({
      sourceCount,
      activeAnalysisTaskCount,
      analysisEventCount: eventCount,
      everCompleted,
    });
    if (next !== everCompleted) setEverCompleted(next);
  }, [
    loading,
    sourceCount,
    activeAnalysisTaskCount,
    eventCount,
    everCompleted,
    setEverCompleted,
  ]);

  const readiness = useMemo(() => {
    if (loading) return IDLE;
    return pipelineReadiness({
      sourceCount,
      activeAnalysisTaskCount,
      analysisEventCount: eventCount,
      everCompleted,
    });
  }, [loading, sourceCount, activeAnalysisTaskCount, eventCount, everCompleted]);

  return { ...readiness, loading };
}
