import { useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  RotateCcw,
  Upload,
} from "lucide-react";
import { ConfirmDialog } from "../components/dialogs/ConfirmDialog";
import { Button, PillButton } from "../components/ui";
import { useTranslation } from "react-i18next";
import { BOARD_WIDGET_TYPES, getWidgetMeta } from "./widgetRegistry";
import type { BoardEditMode, BoardWidgetType } from "./types";
import { useBoardChromeReveal } from "./useBoardChromeReveal";

interface BoardChromeProps {
  editMode: BoardEditMode;
  isFullscreen?: boolean;
  onEditModeChange: (mode: BoardEditMode) => void;
  onAddWidget: (type: BoardWidgetType) => void;
  onResetLayout: () => void;
  onExportLayout: () => void;
  onImportLayout: (file: File) => void | Promise<void>;
  onToggleFullscreen?: () => void;
}

/**
 * Corner FAB: fullscreen + edit sit on the stack (view + edit).
 * View mode auto-hides after idle; edit mode keeps tools pinned until Done.
 */
export function BoardChrome({
  editMode,
  isFullscreen = false,
  onEditModeChange,
  onAddWidget,
  onResetLayout,
  onExportLayout,
  onImportLayout,
  onToggleFullscreen,
}: BoardChromeProps) {
  const { t } = useTranslation("common");
  const [addOpen, setAddOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const isEdit = editMode === "edit";
  const {
    revealed,
    onHotspotPointerEnter,
    onHotspotPointerLeave,
    onHotspotFocusCapture,
    onHotspotBlurCapture,
  } = useBoardChromeReveal(isEdit);

  useEffect(() => {
    if (!addOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) {
        // Outside click only dismisses the add submenu — edit tools stay pinned.
        setAddOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [addOpen]);

  useEffect(() => {
    if (!isEdit) {
      setAddOpen(false);
      setResetConfirmOpen(false);
    }
  }, [isEdit]);

  const handleAnchorClick = () => {
    if (!isEdit) {
      onEditModeChange("edit");
    }
    // While editing, tools stay open; exit via Done only.
  };

  const chromeClass = [
    "board-chrome",
    isEdit ? "board-chrome--open" : "",
    !isEdit && !revealed ? "board-chrome--idle" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={rootRef}
      className={chromeClass}
      data-testid="board-chrome"
      data-chrome-revealed={revealed || isEdit ? "true" : "false"}
      aria-label={t("board:shell.toolsAria")}
    >
      <div
        className="board-chrome__hotspot"
        data-testid="board-fab-hotspot"
        onMouseEnter={onHotspotPointerEnter}
        onMouseLeave={onHotspotPointerLeave}
        onFocusCapture={onHotspotFocusCapture}
        onBlurCapture={onHotspotBlurCapture}
      >
        <div className="board-chrome__fab-stack" role="toolbar" aria-label={t("board:shell.toolbarAria")}>
          {isEdit ? (
            <div
              className="board-chrome__fab-actions board-chrome__fab-actions--open"
              data-testid="board-fab-actions"
            >
              <div className="board-chrome__add">
                <PillButton
                  padding="square"
                  className="board-chrome__fab"
                  data-testid="board-add-widget"
                  title={t("board:shell.addWidget")}
                  aria-label={t("board:shell.addWidget")}
                  aria-expanded={addOpen}
                  onClick={() => setAddOpen((v) => !v)}
                >
                  <Plus size={18} strokeWidth={2} aria-hidden="true" />
                </PillButton>
                {addOpen ? (
                  <div className="board-chrome__menu" role="menu" data-testid="board-add-menu">
                    {BOARD_WIDGET_TYPES.map((type) => {
                      const meta = getWidgetMeta(type);
                      return (
                        <button
                          key={type}
                          type="button"
                          role="menuitem"
                          className="board-chrome__menu-item"
                          onClick={() => {
                            onAddWidget(type);
                            setAddOpen(false);
                          }}
                        >
                          <span>{meta.title}</span>
                          <span className="board-chrome__menu-desc">{meta.description}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="board-chrome__fab"
                data-testid="board-export-layout"
                title={t("board:shell.exportLayout")}
                aria-label={t("board:shell.exportLayout")}
                onClick={onExportLayout}
              >
                <Download size={16} strokeWidth={2} aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="board-chrome__fab"
                data-testid="board-import-layout"
                title={t("board:shell.importLayout")}
                aria-label={t("board:shell.importLayout")}
                onClick={() => importInputRef.current?.click()}
              >
                <Upload size={16} strokeWidth={2} aria-hidden="true" />
              </Button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                aria-label={t("board:shell.importFileAria")}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) void onImportLayout(file);
                  event.currentTarget.value = "";
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="board-chrome__fab"
                data-testid="board-reset-layout"
                title={t("board:shell.resetLayout")}
                aria-label={t("board:shell.resetLayoutAria")}
                onClick={() => setResetConfirmOpen(true)}
              >
                <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="board-chrome__fab board-chrome__fab--primary"
                data-testid="board-done-edit"
                title={t("board:shell.doneEdit")}
                aria-label={t("board:shell.doneEdit")}
                onClick={() => {
                  onEditModeChange("view");
                  setAddOpen(false);
                }}
              >
                <Check size={18} strokeWidth={2} aria-hidden="true" />
              </Button>
            </div>
          ) : null}

          {onToggleFullscreen ? (
            <Button
              variant="ghost"
              size="icon"
              className="board-chrome__fab"
              data-testid="board-toggle-fullscreen"
              title={isFullscreen ? t("board:shell.exitFullscreen") : t("board:shell.fullscreen")}
              aria-label={
                isFullscreen ? t("board:shell.exitFullscreen") : t("board:shell.fullscreen")
              }
              aria-pressed={isFullscreen}
              onClick={() => onToggleFullscreen()}
            >
              {isFullscreen ? (
                <Minimize2 size={16} strokeWidth={2} aria-hidden="true" />
              ) : (
                <Maximize2 size={16} strokeWidth={2} aria-hidden="true" />
              )}
            </Button>
          ) : null}

          <PillButton
            padding="square"
            active={isEdit}
            className={
              isEdit
                ? "board-chrome__fab board-chrome__fab--anchor board-chrome__fab--active"
                : "board-chrome__fab board-chrome__fab--anchor"
            }
            data-testid="board-fab-toggle"
            title={t("board:shell.edit")}
            aria-label={t("board:shell.edit")}
            aria-pressed={isEdit}
            aria-expanded={isEdit}
            onClick={handleAnchorClick}
          >
            <Pencil size={16} strokeWidth={2} aria-hidden="true" />
          </PillButton>
        </div>
      </div>
      {resetConfirmOpen ? (
        <ConfirmDialog
          title={t("board:shell.resetConfirmTitle")}
          accentColor="var(--warning)"
          body={t("board:shell.resetConfirmBody")}
          confirmLabel={t("board:shell.resetConfirm")}
          confirmBusyLabel={t("board:shell.resetConfirmBusy")}
          onCancel={() => setResetConfirmOpen(false)}
          onConfirm={() => {
            onResetLayout();
            setResetConfirmOpen(false);
            setAddOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
