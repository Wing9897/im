import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { GanttColumn } from "../../domain/timeline/dateUtils";
import type {
  MonthCardEmptyReason,
  MonthCardModel,
  TimelineMonthLayout,
} from "../../domain/timeline/monthCardSources";
import type {
  TimelineEventStatus,
  TimelineEventStatusMap,
} from "../../domain/timeline/status";
import type { DailyHoliday } from "../../hooks/useMonthHolidays";
import type { DailyWeather } from "../../hooks/useMonthWeather";
import type { TimelineItem } from "../../types";
import type { TaskActivitySpan } from "../../types/analysis";

/**
 * Context that provides timeline page state to deeply nested components,
 * eliminating prop drilling through TimelineViewSwitch and TimelineGrid.
 *
 * Groups:
 * - Event selection & editing (consumed by TimelineSidebar)
 * - Calendar month-cards (consumed by TimelineGrid)
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
  /** Navigate to /items for a trackable-item occurrence (source === "item_remind"). */
  onEditItemEvent?: (event: TimelineItem) => void;
  /** Soft-dismiss any source from the timeline. */
  onDismissTimelineEvent?: (event: TimelineItem) => void;
  /** Restore a soft-dismissed timeline event. */
  onRestoreTimelineEvent?: (event: TimelineItem) => void;
  /** Toggle user/agent 「重要事件」 marker (❗). */
  onToggleImportantEvent?: (event: TimelineItem) => void;
  /** Month cell right-click → open create dialog prefilled for that day. */
  onCreateOnDay?: (day: Date) => void;
  userEventActionBusy?: boolean;
  /** When true, dismissed events stay visible in calendar/gantt (product default). */
  showDismissed: boolean;
  /** Month-cell「+N 进行中」span chip (product default on). */
  showOngoing: boolean;
  /** Month-cell「+N 结束」span chip (product default on). */
  showEnding: boolean;
  /** Month-view daily weather keyed by local YYYY-MM-DD (empty when not month calendar). */
  weatherByDate?: Record<string, DailyWeather>;
  /** Country public holidays for the weather location, keyed by local YYYY-MM-DD. */
  holidaysByDate?: Record<string, DailyHoliday[]>;
  /** Month 顯示日期 persist/preview (visit-scoped). */
  monthDatesRevealed: boolean;
  /** Calendar month: one grid or per-source cards. Optional so existing fixtures stay valid. */
  monthLayout?: TimelineMonthLayout;
  monthCardModels?: MonthCardModel[];
  monthCardsOmitted?: number;
  monthCardsEmptyReason?: MonthCardEmptyReason | null;

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
