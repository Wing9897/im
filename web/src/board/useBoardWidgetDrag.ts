import { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from "react";
import {
  bringWidgetToFront,
  updateWidgetPlacement,
  widgetDesignRect,
} from "./boardLayoutStore";
import { gridToPixels, pixelsToGrid } from "./boardSizePresets";
import type { BoardConfig, BoardWidgetItem } from "./types";

/** Active drag in viewport pixels + last snap target (commit uses snap grid). */
export interface DragSession {
  id: string;
  x: number;
  y: number;
  snapCol: number;
  snapRow: number;
  snapX: number;
  snapY: number;
  w: number;
  h: number;
}

type ViewFn = (designX: number, designY: number) => { x: number; y: number };
type ViewSizeFn = (designW: number, designH: number) => { w: number; h: number };

export function useBoardWidgetDrag(options: {
  isEdit: boolean;
  maximizedId: string | null;
  onConfigChange: (config: BoardConfig) => void;
  configRef: MutableRefObject<BoardConfig>;
  scaleXRef: RefObject<number>;
  scaleYRef: RefObject<number>;
  toView: ViewFn;
  toViewSize: ViewSizeFn;
}): {
  drag: DragSession | null;
  handleDragStart: (widget: BoardWidgetItem) => void;
  handleDrag: (widget: BoardWidgetItem, viewX: number, viewY: number) => void;
  handleDragStop: (widget: BoardWidgetItem) => void;
} {
  const {
    isEdit,
    maximizedId,
    onConfigChange,
    configRef,
    scaleXRef,
    scaleYRef,
    toView,
    toViewSize,
  } = options;

  const [drag, setDrag] = useState<DragSession | null>(null);
  const dragRef = useRef<DragSession | null>(null);

  useEffect(() => {
    if (!isEdit) {
      dragRef.current = null;
      setDrag(null);
    }
  }, [isEdit]);

  const handleDragStart = useCallback(
    (widget: BoardWidgetItem) => {
      if (!isEdit || maximizedId) {
        return;
      }
      const rect = widgetDesignRect(widget);
      const pos = toView(rect.x, rect.y);
      const size = toViewSize(rect.w, rect.h);
      const session: DragSession = {
        id: widget.i,
        x: pos.x,
        y: pos.y,
        snapCol: widget.col,
        snapRow: widget.row,
        snapX: pos.x,
        snapY: pos.y,
        w: size.w,
        h: size.h,
      };
      dragRef.current = session;
      setDrag(session);
      onConfigChange(bringWidgetToFront(configRef.current, widget.i));
    },
    [isEdit, maximizedId, onConfigChange, toView, toViewSize, configRef],
  );

  const handleDrag = useCallback(
    (widget: BoardWidgetItem, viewX: number, viewY: number) => {
      if (!isEdit || maximizedId) {
        return;
      }
      const scaleXv = scaleXRef.current || 1;
      const scaleYv = scaleYRef.current || 1;
      const designX = viewX / scaleXv;
      const designY = viewY / scaleYv;
      const rect = widgetDesignRect(widget);
      const size = {
        w: rect.w * scaleXv,
        h: rect.h * scaleYv,
      };
      const grid = pixelsToGrid(designX, designY);
      const snappedDesign = gridToPixels(grid.col, grid.row);
      const session: DragSession = {
        id: widget.i,
        x: viewX,
        y: viewY,
        snapCol: grid.col,
        snapRow: grid.row,
        snapX: snappedDesign.x * scaleXv,
        snapY: snappedDesign.y * scaleYv,
        w: size.w,
        h: size.h,
      };
      dragRef.current = session;
      setDrag(session);
    },
    [isEdit, maximizedId, scaleXRef, scaleYRef],
  );

  const handleDragStop = useCallback(
    (widget: BoardWidgetItem) => {
      const session = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!isEdit || maximizedId) {
        return;
      }
      if (session && session.id === widget.i) {
        onConfigChange(
          updateWidgetPlacement(configRef.current, widget.i, {
            col: session.snapCol,
            row: session.snapRow,
          }),
        );
      }
    },
    [isEdit, maximizedId, onConfigChange, configRef],
  );

  return { drag, handleDragStart, handleDrag, handleDragStop };
}
