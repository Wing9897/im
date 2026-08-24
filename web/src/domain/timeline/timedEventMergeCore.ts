import { userEventMatchesSourceSelection } from "../tasks/sourceFilterSelection";
import type { SourceFilterSelection } from "../tasks/sourceFilterSelection";
import type { TimelineFilterPlan } from "./timelineFilterPlan";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import type { AnalysisEvent, TimelineItem } from "../../types";
import { asTimedAnalysisEvent } from "../../types/timelineItem";

const EMPTY_EVENTS: TimelineItem[] = [];

/**
 * Client-filter tagged window rows for Timeline multi-select
 * (server window is a single worksetId/taskId + source flags).
 */
export function filterTimelineWindowEvents(opts: {
  selectedSources: SourceFilterSelection;
  filterPlan: TimelineFilterPlan;
  events: readonly AnalysisEvent[];
}): TimelineItem[] {
  const { selectedSources, filterPlan, events } = opts;

  if (
    selectedSources !== null &&
    selectedSources.taskIds.length === 0 &&
    selectedSources.worksetIds.length === 0
  ) {
    return EMPTY_EVENTS;
  }

  const isAll = selectedSources === null;
  const allow = new Set(filterPlan.selectedRealTaskIds);
  const allowWorksets = new Set(filterPlan.selectedWorksetIds);
  const allowExplicitTasks = new Set(filterPlan.explicitTaskIds);
  const analysisAllow = new Set(filterPlan.analysisTaskIds ?? []);

  const out: TimelineItem[] = [];
  for (const event of events) {
    const source = event.source ?? "analysis";
    let keep = false;
    if (source === "analysis") {
      keep = Boolean(filterPlan.fetchAnalysis);
      if (keep && !isAll) {
        const tid = (event.taskId ?? "").trim();
        keep = Boolean(tid && analysisAllow.has(tid));
      }
    } else if (source === "user") {
      keep = Boolean(filterPlan.fetchUserEvents);
      if (keep && !isAll) {
        keep = userEventMatchesSourceSelection(event, allowWorksets, allowExplicitTasks);
      }
    } else if (source === "recurring") {
      keep = Boolean(filterPlan.fetchCalendar);
      if (keep && !isAll) {
        const seriesId = (event.seriesId ?? "").trim();
        const wid = event.worksetId?.trim();
        keep = Boolean((seriesId && allow.has(seriesId)) || (wid && allowWorksets.has(wid)));
      }
    } else if (source === "item_remind") {
      keep = Boolean(filterPlan.fetchItems);
      if (keep && !isAll) {
        const wid =
          typeof event.worksetId === "string" && event.worksetId.trim()
            ? event.worksetId.trim()
            : SYSTEM_WORKSET_ID;
        keep = allowWorksets.has(wid);
      }
    }
    if (!keep) continue;
    const timed = asTimedAnalysisEvent(event);
    if (timed) out.push(timed);
  }
  return out;
}
