import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { boardGanttBarClass } from "../../domain/gantt/ganttStatusTokens";
import type { AnalysisEvent, TaskActivitySpan } from "../../types";
import {
  activityToSingletonRow,
  buildGanttAxis,
  calculateBar,
  formatActivityRange,
  normalizeGanttActivities,
  normalizeGanttEventActivities,
  type GanttActivity,
  type GanttEventActivityRow,
} from "./ganttBoardModel";

export type { GanttActivity, GanttEventActivityRow, GanttAxis, GanttBarLayout } from "./ganttBoardModel";
export {
  normalizeGanttActivities,
  normalizeGanttEventActivities,
  buildGanttAxis,
  calculateBar,
} from "./ganttBoardModel";

interface GanttBoardEmbedProps {
  viewMode: "day" | "month";
  onSelectActivity?: (activity: GanttActivity) => void;
  /** Left column header, e.g. 任務 / 事件. */
  labelHeader?: string;
  /** Shown when there are no source rows. */
  emptyLabel?: string;
  spans?: TaskActivitySpan[];
  events?: AnalysisEvent[];
}

/**
 * Compact Gantt chart for the ops board. It intentionally keeps its own
 * activity projection so it can render without TimelinePageContext.
 */
export function GanttBoardEmbed({
  viewMode,
  onSelectActivity,
  labelHeader,
  emptyLabel,
  spans,
  events,
}: GanttBoardEmbedProps) {
  const { t } = useTranslation();
  const resolvedLabelHeader = labelHeader ?? t("board.gantt.defaultLabelHeader");
  const resolvedEmptyLabel = emptyLabel ?? t("board.gantt.defaultEmptyLabel");
  const chart = useMemo(() => {
    const now = Date.now();
    const activityRows = events
      ? normalizeGanttEventActivities(events, now)
      : normalizeGanttActivities(spans ?? [], now).map(activityToSingletonRow);
    const axis = buildGanttAxis(viewMode, now);
    return {
      axis,
      sourceCount: events ? events.length : (spans ?? []).length,
      rows: activityRows.flatMap((row) => {
        const bars = row.segments.flatMap((segment) => {
          const bar = calculateBar(segment, axis);
          return bar ? [{ activity: segment, bar }] : [];
        });
        if (bars.length === 0) {
          return [];
        }
        return [{ row, bars }];
      }),
    };
  }, [spans, events, viewMode]);

  const axisStyle = {
    ["--board-gantt-ticks" as string]: String(chart.axis.tickCount),
  };

  const emptyText =
    chart.sourceCount === 0
      ? resolvedEmptyLabel
      : chart.rows.length === 0
        ? t("board.gantt.emptyFiltered")
        : resolvedEmptyLabel;

  return (
    <div
      className="board-gantt-embed"
      data-testid="board-gantt-embed"
      data-view-mode={viewMode}
      data-tick-count={chart.axis.tickCount}
      style={axisStyle}
    >
      <div className="board-gantt-embed__header">
        <span className="board-gantt-embed__header-label">{resolvedLabelHeader}</span>
        <div
          className="board-gantt-embed__axis"
          aria-label={
            viewMode === "day" ? t("board.gantt.axisDayAria") : t("board.gantt.axisMonthAria")
          }
        >
          {chart.axis.ticks.map((tick) => (
            <span key={tick.key}>{tick.label}</span>
          ))}
        </div>
      </div>
      <ul className="board-gantt-embed__rows" aria-label={t("board.gantt.rowsAria")}>
        {chart.rows.length === 0 ? (
          <li className="board-gantt-embed__empty">{emptyText}</li>
        ) : chart.rows.map(({ row, bars }) => {
          const representative = bars[0].activity;
          const rangeLabel = bars
            .map(({ activity }) => formatActivityRange(activity.start, activity.end))
            .join(" · ");
          return (
            <li key={row.id} className="board-gantt-embed__row">
              <button
                type="button"
                className="board-gantt-embed__label"
                data-testid={`board-gantt-row-${row.id}`}
                onClick={() => onSelectActivity?.(representative)}
                title={`${row.label}（${rangeLabel}）`}
              >
                {row.status === "active" ? (
                  <span
                    className="board-gantt-embed__active-dot"
                    aria-label={t("board.gantt.activeAria")}
                  />
                ) : null}
                <span className="board-gantt-embed__name">{row.label}</span>
              </button>
              <div
                className="board-gantt-embed__track"
                aria-label={t("board.gantt.trackAria", {
                  label: row.label,
                  range: rangeLabel,
                })}
                title={rangeLabel}
              >
                {bars.map(({ activity, bar }) => (
                  <button
                    key={activity.id}
                    type="button"
                    className={boardGanttBarClass(activity.status)}
                    data-testid={`board-gantt-bar-${activity.id}`}
                    data-start-cell={bar.startCell}
                    data-end-cell={bar.endCell}
                    data-start-ms={activity.start}
                    data-end-ms={activity.end}
                    style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                    title={formatActivityRange(activity.start, activity.end)}
                    aria-label={t("board.gantt.trackAria", {
                      label: activity.label,
                      range: formatActivityRange(activity.start, activity.end),
                    })}
                    onClick={() => onSelectActivity?.(activity)}
                  />
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
