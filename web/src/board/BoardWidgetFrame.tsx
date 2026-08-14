import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, X } from "lucide-react";
import { BOARD_SIZE_PRESETS } from "./boardSizePresets";
import { getWidgetMeta } from "./widgetRegistry";
import { useTranslation } from "react-i18next";
import type { BoardSizePresetId } from "./boardSizePresets";
import type { BoardWidgetType } from "./types";

interface BoardWidgetFrameProps {
  widgetId: string;
  type: BoardWidgetType;
  editMode: boolean;
  maximized: boolean;
  sizeId: BoardSizePresetId;
  onSizeChange: (sizeId: BoardSizePresetId) => void;
  onMaximize: () => void;
  onMinimize: () => void;
  onRemove: () => void;
  children: ReactNode;
}

type HeaderActionsSetter = (actions: ReactNode) => void;

const BoardWidgetHeaderActionsContext = createContext<HeaderActionsSetter | null>(null);

/**
 * Lets a widget place its own compact controls alongside the frame chrome.
 * The frame owns the header so controls stay discoverable without consuming
 * the already-limited widget body.
 */
export function useBoardWidgetHeaderActions(actions: ReactNode) {
  const setHeaderActions = useContext(BoardWidgetHeaderActionsContext);

  useEffect(() => {
    if (!setHeaderActions) {
      return;
    }
    setHeaderActions(actions);
    return () => setHeaderActions(null);
  }, [actions, setHeaderActions]);
}

export function BoardWidgetFrame({
  widgetId,
  type,
  editMode,
  maximized,
  sizeId,
  onSizeChange,
  onMaximize,
  onMinimize,
  onRemove,
  children,
}: BoardWidgetFrameProps) {
  const { t } = useTranslation("common");
  const meta = getWidgetMeta(type);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [headerActions, setHeaderActions] = useState<ReactNode>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const sizeBtnRef = useRef<HTMLButtonElement>(null);
  const sizeMenuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!sizeOpen || !sizeBtnRef.current) {
      setMenuPos(null);
      return;
    }
    const menuWidth = 84;
    const gap = 4;

    const place = () => {
      const btn = sizeBtnRef.current;
      if (!btn) {
        return;
      }
      const rect = btn.getBoundingClientRect();
      const left = Math.max(
        8,
        Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8),
      );
      // Prefer glued below the trigger; only flip above using *measured* height
      // so an overestimate cannot leave a large gap.
      const menu = sizeMenuRef.current;
      const height = menu?.offsetHeight ?? 0;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      let top = rect.bottom + gap;
      if (height > 0 && height > spaceBelow && spaceAbove > spaceBelow) {
        top = rect.top - height - gap;
      }
      setMenuPos({ top: Math.max(8, top), left });
    };

    // First paint below the button so the menu can measure itself, then refine.
    const rect = sizeBtnRef.current.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + gap,
      left: Math.max(
        8,
        Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8),
      ),
    });
    const raf = window.requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [sizeOpen, meta.sizeOptions.length]);

  useEffect(() => {
    if (!sizeOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (sizeBtnRef.current?.contains(target) || sizeMenuRef.current?.contains(target)) {
        return;
      }
      setSizeOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [sizeOpen]);

  useEffect(() => {
    if (!editMode) {
      setSizeOpen(false);
    }
  }, [editMode]);

  const sizeMenu =
    sizeOpen && menuPos
      ? createPortal(
          <div
            ref={sizeMenuRef}
            className="board-widget-frame__size-menu board-widget-frame__size-menu--portal"
            role="menu"
            data-testid={`board-size-menu-${widgetId}`}
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            {meta.sizeOptions.map((id) => (
              <button
                key={id}
                type="button"
                role="menuitemradio"
                aria-checked={id === sizeId}
                className={
                  id === sizeId
                    ? "board-widget-frame__size-item board-widget-frame__size-item--active"
                    : "board-widget-frame__size-item"
                }
                onClick={() => {
                  onSizeChange(id);
                  setSizeOpen(false);
                }}
              >
                {BOARD_SIZE_PRESETS[id].label}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <section
      className="board-widget-frame"
      data-testid={`board-widget-${type}`}
      data-widget-id={widgetId}
      data-size-id={sizeId}
      aria-label={meta.title}
    >
      <BoardWidgetHeaderActionsContext.Provider value={setHeaderActions}>
        <header className="board-widget-frame__header">
          <h3 className="board-widget-frame__title">{meta.title}</h3>
          <div className="board-widget-frame__actions">
            {headerActions ? (
              <div className="board-widget-frame__widget-actions">{headerActions}</div>
            ) : null}
            {editMode ? (
              <div className="board-widget-frame__size">
                <button
                  ref={sizeBtnRef}
                  type="button"
                  className="board-widget-frame__btn board-widget-frame__size-btn"
                  title={t("board:shell.selectSize")}
                  aria-label={t("board:shell.selectSizeAria", { title: meta.title })}
                  aria-expanded={sizeOpen}
                  data-testid={`board-size-${widgetId}`}
                  onClick={() => setSizeOpen((v) => !v)}
                >
                  {BOARD_SIZE_PRESETS[sizeId]?.label ?? sizeId}
                </button>
                {sizeMenu}
              </div>
            ) : null}
            <button
              type="button"
              className="board-widget-frame__btn"
              title={maximized ? t("board:shell.restore") : t("board:shell.maximize")}
              aria-label={
                maximized ? t("board:shell.restoreWidget") : t("board:shell.maximizeWidget")
              }
              onClick={maximized ? onMinimize : onMaximize}
            >
              {maximized ? (
                <Minimize2 size={12} strokeWidth={2} aria-hidden="true" />
              ) : (
                <Maximize2 size={12} strokeWidth={2} aria-hidden="true" />
              )}
            </button>
            {editMode ? (
              <button
                type="button"
                className="board-widget-frame__btn board-widget-frame__btn--danger"
                title={t("board:shell.removeWidget")}
                aria-label={t("board:shell.removeWidgetAria", { title: meta.title })}
                data-testid={`board-remove-${widgetId}`}
                onClick={onRemove}
              >
                <X size={12} strokeWidth={2} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </header>
        <div className="board-widget-frame__body">{children}</div>
      </BoardWidgetHeaderActionsContext.Provider>
    </section>
  );
}
