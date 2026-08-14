import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { Rnd } from "react-rnd";
import { useTranslation } from "react-i18next";
import { useMonitorMode } from "../context/MonitorModeContext";
import { type BoardSizePresetId } from "./boardSizePresets";
import {
  removeWidget,
  updateWidgetSizeId,
  widgetDesignRect,
} from "./boardLayoutStore";
import { BoardWidgetFrame } from "./BoardWidgetFrame";
import { BOARD_WIDGET_COMPONENTS } from "./widgetRegistry";
import { useBoardScaleRefs, useBoardStretchScale } from "./useBoardStretchScale";
import { useBoardWidgetDrag } from "./useBoardWidgetDrag";
import type { BoardConfig, BoardEditMode } from "./types";

/** Nudge window.resize listeners (Leaflet etc.) without remounting widgets. */
export function nudgeBoardRemeasure(): void {
  window.dispatchEvent(new Event("resize"));
}

interface BoardCanvasProps {
  config: BoardConfig;
  editMode: BoardEditMode;
  maximizedId: string | null;
  onConfigChange: (config: BoardConfig) => void;
  onMaximize: (widgetId: string | null) => void;
  /** Overlay chrome (FAB) rendered on the design surface over frames. */
  chrome?: ReactNode;
}

function canvasClassName(isEdit: boolean, maximized: boolean): string {
  const parts = ["board-canvas"];
  if (isEdit) {
    parts.push("board-canvas--edit");
  }
  if (maximized) {
    parts.push("board-canvas--maximized");
  }
  return parts.join(" ");
}

export function BoardCanvas({
  config,
  editMode,
  maximizedId,
  onConfigChange,
  onMaximize,
  chrome,
}: BoardCanvasProps) {
  const { t } = useTranslation("common");
  const { monitorMode } = useMonitorMode();
  const isEdit = editMode === "edit";
  const canvasRef = useRef<HTMLDivElement>(null);
  const isMaximized = Boolean(maximizedId);
  const configRef = useRef(config);
  configRef.current = config;

  const scale = useBoardStretchScale(canvasRef, [config.widgets.length, monitorMode]);
  const { scaleXRef, scaleYRef } = useBoardScaleRefs(scale);
  const sx = scale?.x ?? 1;
  const sy = scale?.y ?? 1;
  const scaleReady = scale != null;

  const toView = useCallback(
    (designX: number, designY: number) => ({
      x: designX * sx,
      y: designY * sy,
    }),
    [sx, sy],
  );

  const toViewSize = useCallback(
    (designW: number, designH: number) => ({
      w: designW * sx,
      h: designH * sy,
    }),
    [sx, sy],
  );

  const { drag, handleDragStart, handleDrag, handleDragStop } = useBoardWidgetDrag({
    isEdit,
    maximizedId,
    onConfigChange,
    configRef,
    scaleXRef,
    scaleYRef,
    toView,
    toViewSize,
  });

  useEffect(() => {
    if (monitorMode !== "canvas") {
      return;
    }
    const frame = requestAnimationFrame(() => nudgeBoardRemeasure());
    return () => cancelAnimationFrame(frame);
  }, [monitorMode]);

  // Remeasure on maximize / first scale ready — map embeds observe their own stage size.
  // Do not depend on sx/sy: continuous resize already flows through ResizeObserver.
  useEffect(() => {
    if (!scaleReady) {
      return;
    }
    const frame = requestAnimationFrame(() => nudgeBoardRemeasure());
    const timer = window.setTimeout(() => nudgeBoardRemeasure(), 80);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [maximizedId, scaleReady]);

  const handleRemove = useCallback(
    (widgetId: string) => {
      if (maximizedId === widgetId) {
        onMaximize(null);
      }
      onConfigChange(removeWidget(configRef.current, widgetId));
    },
    [maximizedId, onConfigChange, onMaximize],
  );

  const handleSizeChange = useCallback(
    (widgetId: string, sizeId: BoardSizePresetId) => {
      onConfigChange(updateWidgetSizeId(configRef.current, widgetId, sizeId));
    },
    [onConfigChange],
  );

  if (config.widgets.length === 0) {
    return (
      <div
        ref={canvasRef}
        className="board-canvas board-canvas--empty"
        data-testid="board-canvas"
      >
        <div className="board-canvas-empty" data-testid="board-empty">
          <p className="board-canvas-empty__title">{t("board:shell.emptyTitle")}</p>
          <p className="board-canvas-empty__hint">{t("board:shell.emptyHint")}</p>
        </div>
        {chrome}
      </div>
    );
  }

  return (
    <div
      ref={canvasRef}
      className={canvasClassName(isEdit, isMaximized)}
      data-testid="board-canvas"
      data-maximized={maximizedId ?? undefined}
      data-board-scale-x={scaleReady ? sx.toFixed(3) : "pending"}
      data-board-scale-y={scaleReady ? sy.toFixed(3) : "pending"}
      data-board-widget-count={config.widgets.length}
    >
      <div
        className="board-free-scale-slot"
        data-testid="board-free-scale-slot"
        style={{ width: "100%", height: "100%" }}
      >
        <div
          className={
            isMaximized
              ? "board-free-surface board-free-surface--maximized"
              : "board-free-surface"
          }
          data-testid="board-free-surface"
          style={{ width: "100%", height: "100%" }}
        >
          {drag ? (
            <div
              className="board-snap-preview"
              data-testid="board-snap-preview"
              aria-hidden="true"
              style={{
                left: drag.snapX,
                top: drag.snapY,
                width: drag.w,
                height: drag.h,
              }}
            />
          ) : null}
          {scaleReady
            ? config.widgets.map((widget) => {
                const Comp = BOARD_WIDGET_COMPONENTS[widget.type];
                const rect = widgetDesignRect(widget);
                const viewPos = toView(rect.x, rect.y);
                const viewSize = toViewSize(rect.w, rect.h);
                const isMax = maximizedId === widget.i;
                const active = monitorMode === "canvas" && (!maximizedId || isMax);
                const canInteract = isEdit && !maximizedId;
                const isDragging = drag?.id === widget.i;
                const itemClass = [
                  "board-free-item",
                  maximizedId && isMax ? "board-free-item--maximized" : "",
                  maximizedId && !isMax ? "board-free-item--obscured" : "",
                  isDragging ? "board-free-item--dragging" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <Rnd
                    key={widget.i}
                    className={itemClass}
                    size={
                      isMaximized && isMax
                        ? { width: "100%", height: "100%" }
                        : {
                            width: isDragging ? drag.w : viewSize.w,
                            height: isDragging ? drag.h : viewSize.h,
                          }
                    }
                    position={
                      isMaximized && isMax
                        ? { x: 0, y: 0 }
                        : {
                            x: isDragging ? drag.x : viewPos.x,
                            y: isDragging ? drag.y : viewPos.y,
                          }
                    }
                    scale={1}
                    style={{ zIndex: isMax ? 20 : (widget.z ?? 1) }}
                    bounds="parent"
                    disableDragging={!canInteract || Boolean(maximizedId)}
                    enableResizing={false}
                    dragHandleClassName="board-widget-frame__header"
                    onDragStart={() => handleDragStart(widget)}
                    onDrag={(_e, data) => {
                      handleDrag(widget, data.x, data.y);
                    }}
                    onDragStop={() => {
                      handleDragStop(widget);
                    }}
                  >
                    <div className="board-free-item__inner" data-widget-mount={widget.i}>
                      <BoardWidgetFrame
                        widgetId={widget.i}
                        type={widget.type}
                        editMode={isEdit}
                        maximized={isMax}
                        sizeId={widget.sizeId}
                        onSizeChange={(next) => handleSizeChange(widget.i, next)}
                        onMaximize={() => onMaximize(widget.i)}
                        onMinimize={() => onMaximize(null)}
                        onRemove={() => handleRemove(widget.i)}
                      >
                        <Comp active={active} widgetId={widget.i} />
                      </BoardWidgetFrame>
                    </div>
                  </Rnd>
                );
              })
            : null}
          {chrome}
        </div>
      </div>
    </div>
  );
}
