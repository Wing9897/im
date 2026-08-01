/**
 * TimelineSkeleton — skeleton loading placeholder for the Timeline page.
 *
 * Renders shimmer placeholders that approximate the final calendar or gantt
 * grid layout, providing immediate visual feedback during initial data loading.
 *
 * Requirements: 5.1, 5.3, 5.4
 */

import { timelinePanelClass } from "../timelineViewLayout";
import {
  timelineSkeletonCalendarCellClass,
  timelineSkeletonCalendarGridClass,
  timelineSkeletonCalendarHeaderRowClass,
  timelineSkeletonCellHeaderClass,
  timelineSkeletonCenteredFlexClass,
  timelineSkeletonGanttHeaderGridClass,
  timelineSkeletonGanttHeaderGridStyle,
  timelineSkeletonGanttInnerClass,
  timelineSkeletonGanttRowGridStyle,
  timelineSkeletonGanttRowsContainerClass,
  timelineSkeletonGanttScrollContainerClass,
  timelineSkeletonInactiveBarClass,
  timelineSkeletonShimmerClass,
} from "./timelineSkeletonClasses";

interface TimelineSkeletonProps {
  viewMode: "calendar" | "gantt";
}

function ShimmerBlock({
  width,
  height,
  borderRadius = 6,
  className,
  style,
}: {
  width: string | number;
  height: number;
  borderRadius?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={[timelineSkeletonShimmerClass, className].filter(Boolean).join(" ")}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  );
}

function CalendarSkeleton() {
  return (
    <div>
      <div className={timelineSkeletonCalendarHeaderRowClass}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className={timelineSkeletonCenteredFlexClass}>
            <ShimmerBlock width="70%" height={14} borderRadius={4} />
          </div>
        ))}
      </div>

      <div className={timelineSkeletonCalendarGridClass}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className={timelineSkeletonCalendarCellClass}>
            <div className={timelineSkeletonCellHeaderClass}>
              <ShimmerBlock width={20} height={14} borderRadius={4} />
              <ShimmerBlock width={30} height={12} borderRadius={4} />
            </div>
            {Array.from({ length: 2 + (i % 2) }).map((_, j) => (
              <ShimmerBlock
                key={j}
                width="100%"
                height={28}
                borderRadius={8}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function GanttSkeleton() {
  const columnCount = 7;

  return (
    <div className={timelineSkeletonGanttScrollContainerClass}>
      <div className={timelineSkeletonGanttInnerClass}>
        <div
          className={timelineSkeletonGanttHeaderGridClass(columnCount)}
          style={timelineSkeletonGanttHeaderGridStyle(columnCount)}
        >
          <ShimmerBlock width="60%" height={14} borderRadius={4} />
          {Array.from({ length: columnCount }).map((_, i) => (
            <div key={i} className={timelineSkeletonCenteredFlexClass}>
              <ShimmerBlock width="80%" height={12} borderRadius={4} />
            </div>
          ))}
        </div>

        <div className={timelineSkeletonGanttRowsContainerClass}>
          {Array.from({ length: 6 }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              style={timelineSkeletonGanttRowGridStyle(columnCount)}
            >
              <ShimmerBlock
                width={`${60 + (rowIndex % 3) * 12}%`}
                height={18}
                borderRadius={4}
                style={{ padding: "6px 8px", boxSizing: "border-box" }}
              />
              {Array.from({ length: columnCount }).map((_, colIndex) => {
                const barStart = rowIndex % columnCount;
                const barEnd = barStart + 2 + (rowIndex % 3);
                const isInBar = colIndex >= barStart && colIndex <= barEnd;

                return isInBar ? (
                  <ShimmerBlock
                    key={colIndex}
                    width="100%"
                    height={22}
                    borderRadius={6}
                  />
                ) : (
                  <div key={colIndex} className={timelineSkeletonInactiveBarClass} />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TimelineSkeleton({ viewMode }: TimelineSkeletonProps) {
  return (
    <div className={timelinePanelClass} data-testid="timeline-skeleton">
      {viewMode === "calendar" ? <CalendarSkeleton /> : <GanttSkeleton />}
    </div>
  );
}
