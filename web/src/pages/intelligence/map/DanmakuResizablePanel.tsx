import { useCallback, useEffect, useRef } from "react";
import type React from "react";
import { useTranslation } from "react-i18next";
import {
  mapDanmakuBodyBottomResizeClass,
  mapDanmakuBodyTopResizeClass,
  mapDanmakuPanelContentRowClass,
  mapResizeHandleClass,
  mapResizeHandleGripClass,
  type PanelSpineVariant,
} from "./mapViewClasses";
import { PanelSpine } from "./PanelSpine";

interface PersistentPanelProps {
  children: React.ReactNode;
  panelClassName: string;
  height: number;
  minHeight: number;
  maxHeight: number;
  onHeightChange: (height: number) => void;
  resizeFrom: "top" | "bottom";
  spineVariant: PanelSpineVariant;
  panelLabel: string;
}

export function ResizablePersistentPanel({
  children,
  panelClassName,
  height,
  minHeight,
  maxHeight,
  onHeightChange,
  resizeFrom,
  spineVariant,
  panelLabel,
}: PersistentPanelProps) {
  const { t } = useTranslation("intelligence");
  const dragStateRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const previousBodyUserSelectRef = useRef<string | null>(null);

  const stopResize = useCallback(() => {
    dragStateRef.current = null;
    if (previousBodyUserSelectRef.current !== null) {
      document.body.style.userSelect = previousBodyUserSelectRef.current;
      previousBodyUserSelectRef.current = null;
    }
  }, []);

  useEffect(() => stopResize, [stopResize]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;
      const deltaY = event.clientY - dragState.startY;
      const nextHeight =
        resizeFrom === "top"
          ? dragState.startHeight - deltaY
          : dragState.startHeight + deltaY;
      onHeightChange(nextHeight);
    };

    const handlePointerUp = () => {
      stopResize();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [onHeightChange, resizeFrom, stopResize]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragStateRef.current = {
      startY: event.clientY,
      startHeight: height,
    };
    if (previousBodyUserSelectRef.current === null) {
      previousBodyUserSelectRef.current = document.body.style.userSelect;
    }
    document.body.style.userSelect = "none";
  }, [height]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 40 : 10;
    let nextHeight: number | null = null;
    switch (event.key) {
      case "ArrowUp":
      case "ArrowRight":
        nextHeight = height + step;
        break;
      case "ArrowDown":
      case "ArrowLeft":
        nextHeight = height - step;
        break;
      case "Home":
        nextHeight = minHeight;
        break;
      case "End":
        nextHeight = maxHeight;
        break;
      default:
        return;
    }
    event.preventDefault();
    onHeightChange(Math.min(maxHeight, Math.max(minHeight, nextHeight)));
  }, [height, maxHeight, minHeight, onHeightChange]);

  const bodyClassName =
    resizeFrom === "top" ? mapDanmakuBodyTopResizeClass : mapDanmakuBodyBottomResizeClass;
  const handleClassName = [
    mapResizeHandleClass,
    resizeFrom === "top" ? "top-0" : "bottom-0",
  ].join(" ");

  return (
    <div className={panelClassName} style={{ height }}>
      <div className={mapDanmakuPanelContentRowClass}>
        <PanelSpine variant={spineVariant} label={panelLabel} />
        <div className={bodyClassName}>{children}</div>
      </div>
      <div
        role="separator"
        tabIndex={0}
        aria-orientation="horizontal"
        aria-label={t("map.panelHeightAria")}
        aria-valuemin={minHeight}
        aria-valuemax={maxHeight}
        aria-valuenow={height}
        aria-valuetext={t("map.panelHeightValue", { height })}
        className={handleClassName}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
      >
        <div className={mapResizeHandleGripClass} />
      </div>
    </div>
  );
}
