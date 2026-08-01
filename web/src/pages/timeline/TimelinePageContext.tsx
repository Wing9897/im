import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { GanttColumn } from "../../domain/timeline/dateUtils";
import type {
  TimelineEventStatus,
  TimelineEventStatusMap,
} from "../../domain/timeline/status";
import type { TimelineItem } from "../../types";
import type { TaskActivitySpan } from "../../types/analysis";

/**
 * Context that provides timeline page state to deeply nested components,
 * eliminating prop drilling through TimelineViewSwitch and TimelineGrid.
 *
 * Groups:
 * - Event selection & editing (consumed by TimelineSidebar)
 * - Gantt-specific data (consumed by TimelineGrid/TimelineGanttView)
 */
export interface TimelinePageContextValue {
  // ── Event selection & editing ───────────────────────────────────────────────
  selectedEvent: TimelineItem | null;
  onSelectEvent: (event: TimelineItem | null) => void;
  editStartTime: string;
  editEndTime: string;
  setEditStartTime: (v: string) => void;
  setEditEndTime: (v: string) => void;
  onSaveTimeOverride: () => void;
  onResetTimeOverride: () => void;
  onSetEventStatus: (eventId: string, status: TimelineEventStatus) => void;
  eventStatuses: TimelineEventStatusMap;
  /** Open edit dialog for a user event (source === "user"). */
  onEditUserEvent?: (event: TimelineItem) => void;
  /** Soft-dismiss any source from the timeline. */
  onDismissTimelineEvent?: (event: TimelineItem) => void;
  /** Restore a soft-dismissed timeline event. */
  onRestoreTimelineEvent?: (event: TimelineItem) => void;
  userEventActionBusy?: boolean;
  /** When true, dismissed events stay visible in calendar/gantt (product default). */
  showDismissed: boolean;
  /** Month-cell「+N 进行中」span chip (product default on). */
  showOngoing: boolean;
  /** Month-cell「+N 完结」span chip (product default on). */
  showEnding: boolean;

  // ── Gantt-specific ──────────────────────────────────────────────────────────
  taskSpans: TaskActivitySpan[];
  selectedGanttTaskId: string | null;
  onSelectGanttTask: (taskId: string) => void;
  spansInitialLoading: boolean;
  spansIsRefreshing: boolean;
  spansError: string | null;
  onRetrySpans: () => void;
  selectedGanttSpan: TaskActivitySpan | null;
  onCloseGanttPanel: () => void;
  ganttColumns: GanttColumn[];
  timelineEvents: TimelineItem[];
  timelineEventsInitialLoading: boolean;
  timelineEventsIsRefreshing: boolean;
  timelineEventsError: string | null;
  onRetryTimelineEvents: () => void;
}

const TimelinePageContext = createContext<TimelinePageContextValue | null>(null);

export function TimelinePageProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: TimelinePageContextValue;
}) {
  return (
    <TimelinePageContext.Provider value={value}>
      {children}
    </TimelinePageContext.Provider>
  );
}

export function useTimelinePageContext(): TimelinePageContextValue {
  const ctx = useContext(TimelinePageContext);
  if (!ctx) {
    throw new Error(
      "useTimelinePageContext must be used within a TimelinePageProvider",
    );
  }
  return ctx;
}
