/**
 * Shared match-matrix: Timeline filter plan vs Board client filter for user_events.
 *
 * Does not merge hooks — only asserts both paths agree on the same selection × event grid.
 */

import { describe, expect, it } from "vitest";

import { filterItemsBySourceSelection } from "../../board/useBoardSourceFilter";
import { resolveTimelineFilterPlan } from "../timeline/timelineFilterPlan";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import {
  resolveAnalysisTaskIdsFromFilter,
  userEventMatchesSourceSelection,
  type SourceFilterSelection,
} from "./sourceFilterSelection";

type CatalogTask = {
  id: string;
  analysisMode: string;
  worksetId?: string | null;
};

type UserEventCase = {
  id: string;
  worksetId?: string | null;
  taskId?: string | null;
};

const CATALOG: CatalogTask[] = [
  { id: "memberOfA", analysisMode: "intel_event", worksetId: "ws-A" },
  { id: "memberOfB", analysisMode: "intel_event", worksetId: "ws-B" },
  { id: "cal-A", analysisMode: "recurring", worksetId: "ws-A" },
  { id: "orphan", analysisMode: "intel_event", worksetId: null },
];

const USER_EVENTS: UserEventCase[] = [
  { id: "owned-A", worksetId: "ws-A", taskId: null },
  { id: "owned-B", worksetId: "ws-B", taskId: "memberOfA" },
  { id: "owned-user", worksetId: SYSTEM_WORKSET_ID, taskId: null },
  { id: "prov-A-on-B", worksetId: "ws-B", taskId: "memberOfA" },
  { id: "prov-orphan", worksetId: "ws-B", taskId: "orphan" },
  { id: "null-prov", worksetId: "ws-A", taskId: SYSTEM_WORKSET_ID },
];

const SELECTIONS: Array<{
  name: string;
  selection: SourceFilterSelection;
}> = [
  { name: "all (null)", selection: null },
  { name: "empty", selection: { taskIds: [], worksetIds: [] } },
  { name: "workset A only", selection: { taskIds: [], worksetIds: ["ws-A"] } },
  { name: "workset B only", selection: { taskIds: [], worksetIds: ["ws-B"] } },
  {
    name: "builtin __user__",
    selection: { taskIds: [], worksetIds: [SYSTEM_WORKSET_ID] },
  },
  {
    name: "explicit memberOfA",
    selection: { taskIds: ["memberOfA"], worksetIds: [] },
  },
  {
    name: "explicit orphan",
    selection: { taskIds: ["orphan"], worksetIds: [] },
  },
  {
    name: "workset A + explicit orphan",
    selection: { taskIds: ["orphan"], worksetIds: ["ws-A"] },
  },
];

function timelineMatchesUserEvent(
  selection: SourceFilterSelection,
  event: UserEventCase,
): boolean {
  if (selection === null) return true;
  const plan = resolveTimelineFilterPlan(selection, CATALOG);
  if (!plan.fetchUserEvents) return false;
  return userEventMatchesSourceSelection(
    event,
    new Set(plan.selectedWorksetIds),
    new Set(plan.explicitTaskIds),
  );
}

function boardMatchesUserEvent(
  selection: SourceFilterSelection,
  event: UserEventCase,
): boolean {
  const memberTaskIds =
    selection === null
      ? null
      : new Set(resolveAnalysisTaskIdsFromFilter(selection, CATALOG) ?? []);
  const filtered = filterItemsBySourceSelection(
    [{ ...event, source: "user" as const }],
    selection,
    memberTaskIds,
  );
  return filtered.length === 1;
}

describe("source-filter match matrix (Timeline vs Board)", () => {
  it.each(
    SELECTIONS.flatMap(({ name, selection }) =>
      USER_EVENTS.map((event) => ({
        name,
        selection,
        eventId: event.id,
        event,
      })),
    ),
  )("$name × $eventId agree", ({ selection, event }) => {
    expect(boardMatchesUserEvent(selection, event)).toBe(
      timelineMatchesUserEvent(selection, event),
    );
  });

  it("documents key ownership vs provenance cases", () => {
    // Workset A must not pull B-owned events that only share expanded provenance.
    expect(
      timelineMatchesUserEvent(
        { taskIds: [], worksetIds: ["ws-A"] },
        { id: "cross", worksetId: "ws-B", taskId: "memberOfA" },
      ),
    ).toBe(false);
    expect(
      boardMatchesUserEvent(
        { taskIds: [], worksetIds: ["ws-A"] },
        { id: "cross", worksetId: "ws-B", taskId: "memberOfA" },
      ),
    ).toBe(false);

    // Explicit taskIds may match provenance across ownership worksets.
    expect(
      timelineMatchesUserEvent(
        { taskIds: ["memberOfA"], worksetIds: [] },
        { id: "tagged", worksetId: "ws-B", taskId: "memberOfA" },
      ),
    ).toBe(true);
    expect(
      boardMatchesUserEvent(
        { taskIds: ["memberOfA"], worksetIds: [] },
        { id: "tagged", worksetId: "ws-B", taskId: "memberOfA" },
      ),
    ).toBe(true);
  });
});
