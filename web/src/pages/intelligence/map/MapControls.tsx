import { Maximize2, Minimize2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DanmakuMode, OverlayDisplayMode } from "./mapViewHelpers";
import {
  danmakuModeLabel,
  overlayDisplayLabel,
  LIVE_WINDOW_OPTIONS,
} from "./mapViewHelpers";
import { mapSmallBtnClass, mapSmallSelectClass, overlayButtonClass } from "./mapViewClasses";

interface MapControlsProps {
  overlayDisplayMode: OverlayDisplayMode;
  onOverlayDisplayCycle: () => void;
  sharedDanmakuMode: DanmakuMode;
  onDanmakuModeCycle: () => void;
  liveWindowHours: number;
  onLiveWindowHoursChange: (hours: number) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function MapControls({
  overlayDisplayMode,
  onOverlayDisplayCycle,
  sharedDanmakuMode,
  onDanmakuModeCycle,
  liveWindowHours,
  onLiveWindowHoursChange,
  isFullscreen,
  onToggleFullscreen,
}: MapControlsProps) {
  const { t } = useTranslation("intelligence");

  return (
    <>
      <button
        type="button"
        className={overlayButtonClass(true)}
        onClick={onOverlayDisplayCycle}
      >
        {overlayDisplayLabel(t, overlayDisplayMode)}
      </button>
      <button
        type="button"
        className={overlayButtonClass(sharedDanmakuMode !== "off")}
        onClick={onDanmakuModeCycle}
      >
        {danmakuModeLabel(t, sharedDanmakuMode)}
      </button>
      <select
        aria-label={t("map.liveWindowAria")}
        value={liveWindowHours}
        onChange={(e) => onLiveWindowHoursChange(Number(e.target.value))}
        className={mapSmallSelectClass}
      >
        {LIVE_WINDOW_OPTIONS.map((hours) => (
          <option key={hours} value={hours}>
            {t("map.liveWindowOption", { hours })}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={mapSmallBtnClass}
        onClick={onToggleFullscreen}
        aria-label={isFullscreen ? t("map.fullscreenExit") : t("map.fullscreenEnter")}
        title={isFullscreen ? t("map.fullscreenExit") : t("map.fullscreenEnter")}
      >
        {isFullscreen ? (
          <Minimize2 size={14} strokeWidth={2.2} aria-hidden="true" />
        ) : (
          <Maximize2 size={14} strokeWidth={2.2} aria-hidden="true" />
        )}
      </button>
    </>
  );
}
