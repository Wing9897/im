import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useEffect,
  useId,
  useMemo,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import {
  controlBaseClass,
  controlSizeClass,
  pageOpsControlClass,
} from "../../components/ui/controlStyles";
import { useAnchoredMenu } from "../../hooks/useAnchoredMenu";
import { PIPELINE_MAX_VISIBLE_WORKSETS } from "../../domain/worksets/worksetPipelineGraph";
import {
  defaultGraphWorksetIds,
  graphWorksetIdSetEquals,
  resolveGraphWorksetIds,
  selectAllGraphWorksetIds,
  clearGraphWorksetIds,
  toggleGraphWorksetId,
} from "../../domain/worksets/worksetGraphFilter";
import {
  parseWorksetGraphFilter,
  serializeWorksetGraphFilter,
  WORKSET_GRAPH_FILTER_PARAM,
} from "../../domain/worksets/worksetRoutes";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { spacing } from "../../styles/tokens";

type WorksetGraphFilterRow = {
  id: string;
  name: string;
  updatedAt?: string | null;
};

type WorksetGraphFilterControlProps = {
  worksets: readonly WorksetGraphFilterRow[];
};

const FOCUSABLE_SELECTOR = [
  "[data-checklist-initial-focus]",
  "button:not([disabled])",
  "input:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const controlChromeClass = controlBaseClass.replace(/\bw-full\b/, "").replace(/\s+/g, " ").trim();
const toolbarTriggerClass = `${controlChromeClass} ${controlSizeClass.md} w-auto cursor-pointer text-left disabled:cursor-not-allowed`;

const toolbarTriggerStyle: CSSProperties = {
  display: "inline-flex",
  width: "auto",
  minWidth: 0,
  maxWidth: "100%",
  boxSizing: "border-box",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  cursor: "pointer",
  textAlign: "left",
};

function worksetFilterLabel(row: WorksetGraphFilterRow, generalName: string): string {
  return row.id === SYSTEM_WORKSET_ID ? generalName : row.name;
}

/** Toolbar checklist: pick ≤10 worksets to render on the household graph. */
export function WorksetGraphFilterControl({ worksets }: WorksetGraphFilterControlProps) {
  const { t } = useTranslation("workset");
  const [searchParams, setSearchParams] = useSearchParams();
  const reactId = useId();
  const idSuffix = reactId.replace(/:/g, "");
  const triggerId = `workset-graph-filter-trigger-${idSuffix}`;
  const menuId = `workset-graph-filter-menu-${idSuffix}`;
  const titleId = `workset-graph-filter-title-${idSuffix}`;
  const focusedForCurrentOpen = useRef(false);
  const generalName = t("generalName");

  const filterParam = searchParams.get(WORKSET_GRAPH_FILTER_PARAM);
  const selectedIds = useMemo(
    () => resolveGraphWorksetIds(parseWorksetGraphFilter(filterParam), worksets),
    [filterParam, worksets],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const atCap = selectedIds.length >= PIPELINE_MAX_VISIBLE_WORKSETS;
  const defaultIds = useMemo(() => defaultGraphWorksetIds(worksets), [worksets]);
  const allSelected = worksets.length > 0 && selectedIds.length === worksets.length;
  const triggerLabel = allSelected
    ? t("graphFilterAll")
    : t("graphFilterSelectedCount", { count: selectedIds.length });

  const { open, toggle, menuPos, anchorRef, menuRef, rootRef } = useAnchoredMenu({
    align: "start",
    gap: spacing.xs,
    edge: 8,
    fallbackMenuWidth: 200,
    flip: true,
    dismissPointerEvent: "pointerdown",
    restoreFocusOnEscape: true,
    contentKey: worksets.length,
  });

  useEffect(() => {
    if (!open || !menuPos || !menuRef.current || focusedForCurrentOpen.current) return;
    const initialFocus = menuRef.current.querySelector<HTMLElement>("[data-checklist-initial-focus]");
    (initialFocus ?? menuRef.current).focus();
    focusedForCurrentOpen.current = true;
  }, [menuPos, menuRef, open]);

  useEffect(() => {
    if (!open) focusedForCurrentOpen.current = false;
  }, [open]);

  const writeSelection = (nextIds: string[]) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", "graph");
        if (graphWorksetIdSetEquals(nextIds, defaultIds)) {
          next.delete(WORKSET_GRAPH_FILTER_PARAM);
        } else {
          next.set(WORKSET_GRAPH_FILTER_PARAM, serializeWorksetGraphFilter(nextIds));
        }
        return next;
      },
      { replace: true },
    );
  };

  const onToggle = (worksetId: string) => {
    writeSelection(toggleGraphWorksetId(selectedIds, worksetId, worksets));
  };

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !menuRef.current) return;
    const focusable = Array.from(menuRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) {
      event.preventDefault();
      menuRef.current.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === menuRef.current)
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef as RefObject<HTMLDivElement>}
            id={menuId}
            className="board-source-filter__menu board-source-filter__menu--portal im-ws-graph-filter-menu"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={onMenuKeyDown}
            data-testid="workset-graph-filter-list"
            style={
              menuPos
                ? { top: menuPos.top, left: menuPos.left }
                : { top: -9999, left: -9999, visibility: "hidden" }
            }
          >
            <div className="board-source-filter__menu-head">
              <span id={titleId}>{t("graphFilterMenuTitle")}</span>
              <div className="im-ws-graph-filter-actions">
                <button
                  type="button"
                  className="im-ws-graph-filter-action"
                  data-testid="workset-graph-filter-select-all"
                  disabled={worksets.length === 0 || allSelected}
                  onClick={() => writeSelection(selectAllGraphWorksetIds(worksets))}
                >
                  {t("graphFilterSelectAll")}
                </button>
                <button
                  type="button"
                  className="im-ws-graph-filter-action"
                  data-testid="workset-graph-filter-clear"
                  disabled={selectedIds.length === 0}
                  onClick={() => writeSelection(clearGraphWorksetIds())}
                >
                  {t("graphFilterClear")}
                </button>
              </div>
            </div>
            {atCap && worksets.length > PIPELINE_MAX_VISIBLE_WORKSETS && !allSelected ? (
              <p className="im-ws-graph-filter-hint" data-testid="workset-graph-filter-cap-hint">
                {t("graphFilterCapHint")}
              </p>
            ) : null}
            <ul className="board-source-filter__list">
              {worksets.map((row, index) => {
                const checked = selectedSet.has(row.id);
                const disabled = atCap && !checked;
                const label = worksetFilterLabel(row, generalName);
                return (
                  <li key={row.id}>
                    <label className="board-source-filter__item">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        data-testid={`workset-graph-filter-option-${row.id}`}
                        data-checklist-initial-focus={index === 0 ? "" : undefined}
                        onChange={() => {
                          if (!disabled) onToggle(row.id);
                        }}
                      />
                      <span>{label}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={rootRef as RefObject<HTMLDivElement>}
      className="relative inline-flex w-auto shrink-0 box-border min-w-[6.5rem] max-w-[12rem]"
      data-testid="workset-graph-filter"
    >
      <button
        ref={anchorRef as RefObject<HTMLButtonElement>}
        id={triggerId}
        type="button"
        className={`${toolbarTriggerClass} ${pageOpsControlClass}`}
        style={toolbarTriggerStyle}
        aria-label={t("graphFilterAria")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={menuId}
        data-testid="workset-graph-filter-value"
        title={triggerLabel}
        onClick={toggle}
      >
        <span className="block min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {triggerLabel}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={2.2}
          aria-hidden="true"
          className={`shrink-0 text-text-secondary transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {menu}
    </div>
  );
}
