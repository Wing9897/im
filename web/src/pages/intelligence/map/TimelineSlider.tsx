import type React from "react";
import { useTranslation } from "react-i18next";
import type { TimeWindow } from "../../../types";
import { formatDateTime, formatTickLabel } from "../../../utils/dateFormat";
import { ONE_HOUR } from "./timelineSliderLayout";
import { useTimelineSliderInteraction } from "./useTimelineSliderInteraction";
import {
  mapSliderCalInputClass,
  mapSliderCanvasClass,
  mapSliderCanvasWrapClass,
  mapSliderControlRowClass,
  mapSliderEventCountClass,
  mapSliderKeyboardHandleClass,
  mapSliderLiveBtnActiveClass,
  mapSliderLiveBtnBaseClass,
  mapSliderLiveBtnDisabledClass,
  mapSliderLiveBtnIdleClass,
  mapSliderPanelClass,
  mapSliderRangeLabelClass,
  mapSliderTickLabelClass,
  mapSliderTickRowClass,
} from "./timelineSliderClasses";

interface TimelineSliderProps {
  dataRange: TimeWindow;
  timeWindow: TimeWindow;
  onTimeWindowChange: (window: TimeWindow) => void;
  /** Fired on scrub commit (mouseup / calendar / keyboard) for API refetch. */
  onCommitFetchWindow?: (window: TimeWindow) => void;
  liveMode: boolean;
  onLiveModeToggle: () => void;
  onExitLiveMode: () => void;
  liveWindowHours: number;
  liveDisabled?: boolean;
  extraControls?: React.ReactNode;
  eventCount?: number;
}

export function TimelineSlider({
  dataRange,
  timeWindow,
  onTimeWindowChange,
  onCommitFetchWindow,
  liveMode,
  onLiveModeToggle,
  onExitLiveMode,
  liveWindowHours,
  liveDisabled = false,
  extraControls,
  eventCount,
}: TimelineSliderProps) {
  const { t } = useTranslation("intelligence");
  const interaction = useTimelineSliderInteraction({
    dataRange,
    timeWindow,
    liveMode,
    selectionHalfMs: liveWindowHours * ONE_HOUR,
    onTimeWindowChange,
    onCommitFetchWindow,
    onExitLiveMode,
  });
  const liveClass = liveDisabled
    ? `${mapSliderLiveBtnBaseClass} ${mapSliderLiveBtnDisabledClass}`
    : liveMode
      ? `${mapSliderLiveBtnBaseClass} ${mapSliderLiveBtnActiveClass}`
      : `${mapSliderLiveBtnBaseClass} ${mapSliderLiveBtnIdleClass}`;
  return (
    <div className={mapSliderPanelClass}>
      <div ref={interaction.wrapRef} className={mapSliderCanvasWrapClass}>
        <canvas
          ref={interaction.canvasRef}
          className={mapSliderCanvasClass}
          onMouseDown={interaction.onMouseDown}
          onMouseMove={interaction.onHover}
          onWheel={interaction.onWheel}
        />
        {(["start", "end"] as const).map((handle) => {
          const start = handle === "start";
          const value = start ? interaction.wS : interaction.wE;
          return (
            <div
              key={handle}
              role="slider"
              tabIndex={0}
              aria-label={start ? t("map.rangeStartAria") : t("map.rangeEndAria")}
              aria-orientation="horizontal"
              aria-valuemin={start ? interaction.sliderMin : interaction.wS + ONE_HOUR}
              aria-valuemax={start ? interaction.wE - ONE_HOUR : interaction.sliderMax}
              aria-valuenow={value}
              aria-valuetext={formatDateTime(value)}
              className={mapSliderKeyboardHandleClass}
              style={interaction.keyboardHandleStyle(value)}
              onFocus={() => interaction.setFocusedHandle(start ? "left" : "right")}
              onBlur={() => interaction.setFocusedHandle(null)}
              onKeyDown={(event) => interaction.onHandleKeyDown(handle, event)}
            />
          );
        })}
      </div>
      <div className={mapSliderTickRowClass}>
        {interaction.ticks.map((timestamp) => {
          const pct = interaction.tsPct(timestamp);
          return pct < -5 || pct > 105 ? null : (
            <span key={timestamp} className={mapSliderTickLabelClass} style={{ left: `${pct}%` }}>
              {formatTickLabel(timestamp)}
            </span>
          );
        })}
      </div>
      <div className={mapSliderControlRowClass}>
        <span className={mapSliderRangeLabelClass}>
          {formatDateTime(interaction.wS)} — {formatDateTime(interaction.wE)}
        </span>
        {eventCount != null && (
          <span className={mapSliderEventCountClass}>{t("map.eventCount", { count: eventCount })}</span>
        )}
        <div className="flex-1" />
        <div className="inline-flex shrink-0 flex-wrap items-center gap-2.5">
          {extraControls}
          <input
            type="date"
            aria-label={t("map.calendarPickerAria")}
            className={mapSliderCalInputClass}
            value={interaction.viewCenterDate}
            onChange={interaction.onCalendarChange}
          />
          <button
            type="button"
            className={liveClass}
            onClick={onLiveModeToggle}
            disabled={liveDisabled}
            aria-label={
              liveDisabled
                ? t("map.liveUnavailable")
                : liveMode
                  ? t("map.liveDisable")
                  : t("map.liveEnable")
            }
          >
            Live
          </button>
        </div>
      </div>
    </div>
  );
}
