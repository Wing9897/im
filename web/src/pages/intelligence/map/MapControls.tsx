import { useMemo } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MenuSelect } from "../../../components/ui";
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

  const liveWindowOptions = useMemo(
    () =>
      LIVE_WINDOW_OPTIONS.map((hours) => ({
        value: String(hours),
        label: t("map.liveWindowOption", { hours }),
      })),
    [t],
  );

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
      <MenuSelect
        variant="field"
        menuPortal
        aria-label={t("map.liveWindowAria")}
        value={String(liveWindowHours)}
        options={liveWindowOptions}
        onChange={(next) => onLiveWindowHoursChange(Number(next))}
        data-testid="map-live-window-select"
        className="w-auto shrink-0"
        triggerClassName={mapSmallSelectClass}
      />
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
