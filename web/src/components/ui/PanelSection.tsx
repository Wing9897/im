import type { ReactNode } from "react";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CountBadge } from "./CountBadge";
import { Button } from "./Button";
import { sectionTitleClass } from "./pageTypography";

interface PanelSectionProps {
  title: string;
  /** Optional leading Lucide (or other) mark before the title. */
  icon?: ReactNode;
  itemCount?: number;
  /** When true, renders the count badge (caller decides loading/empty logic). */
  showCount?: boolean;
  headerActions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  "aria-label"?: string;
  /**
   * ``panel`` (default) — frosted shell via ``im-surface-panel``.
   * ``none`` — layout/header only; nest inside an outer board/panel (avoid double blur).
   */
  surface?: "panel" | "none";
  /** When set, body can be toggled. */
  collapsible?: boolean;
  /** Uncontrolled initial open state (ignored when ``open`` is provided). */
  defaultOpen?: boolean;
  /** Controlled open state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Panel container with header row (title + optional count badge + actions) and body slot.
 * Spacing uses Tailwind utilities backed by @theme spacing tokens.
 */
export function PanelSection({
  title,
  icon,
  itemCount = 0,
  showCount = false,
  headerActions,
  children,
  className,
  bodyClassName,
  "aria-label": ariaLabel,
  surface = "panel",
  collapsible = false,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
}: PanelSectionProps) {
  const { t } = useTranslation("common");
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : uncontrolledOpen;

  const setOpen = (next: boolean) => {
    if (!controlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const bodyVisible = !collapsible || open;

  const rootCls = [
    /* Header above body; min-h-fit stops flex/grid shrink from collapsing glass bars. */
    "flex min-h-fit min-w-0 flex-col overflow-visible",
    surface === "panel"
      ? "im-surface-panel rounded-xl border border-surface-border shadow-sm"
      : "rounded-none border-0 bg-transparent shadow-none",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const bodyCls = ["min-w-0 flex-1 p-card-inner", bodyClassName ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={rootCls} aria-label={ariaLabel ?? title}>
      <div className="flex flex-wrap items-center justify-between gap-md border-b border-surface-border/80 px-card-inner py-panel-header-y">
        <div className="flex min-w-0 items-center gap-sm">
          {collapsible ? (
            <Button
              type="button"
              variant="ghost"
              size="inline"
              className="text-left"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-label={
                open
                  ? t("ui.collapseTitle", { title })
                  : t("ui.expandTitle", { title })
              }
              title={open ? t("ui.collapse") : t("ui.expand")}
            >
              <span className="inline-flex min-w-0 items-center gap-sm">
                {icon}
                <h2 className={sectionTitleClass}>{title}</h2>
                {showCount ? (
                  <CountBadge
                    count={itemCount}
                    aria-label={t("ui.itemsCount", { count: itemCount })}
                  />
                ) : null}
                {open ? (
                  <ChevronUp size={14} strokeWidth={2.2} className="shrink-0 text-text-muted" aria-hidden="true" />
                ) : (
                  <ChevronDown size={14} strokeWidth={2.2} className="shrink-0 text-text-muted" aria-hidden="true" />
                )}
              </span>
            </Button>
          ) : (
            <>
              {icon}
              <h2 className={sectionTitleClass}>{title}</h2>
              {showCount ? (
                <CountBadge count={itemCount} aria-label={t("ui.itemsCount", { count: itemCount })} />
              ) : null}
            </>
          )}
        </div>
        {headerActions ? (
          <div className="flex flex-wrap items-center gap-sm">{headerActions}</div>
        ) : null}
      </div>
      {bodyVisible ? <div className={bodyCls}>{children}</div> : null}
    </section>
  );
}
