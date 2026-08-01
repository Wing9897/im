import type { ReactNode } from "react";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CountBadge } from "./CountBadge";
import { Button } from "./Button";
import { sectionTitleClass } from "./pageTypography";

interface PanelSectionProps {
  title: string;
  itemCount?: number;
  /** When true, renders the count badge (caller decides loading/empty logic). */
  showCount?: boolean;
  headerActions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  "aria-label"?: string;
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
  itemCount = 0,
  showCount = false,
  headerActions,
  children,
  className,
  bodyClassName,
  "aria-label": ariaLabel,
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
    "rounded-xl border border-surface-border bg-[color-mix(in_srgb,var(--surface-card)_55%,transparent)] shadow-sm",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const bodyCls = ["min-w-0 p-card-inner", bodyClassName ?? ""].filter(Boolean).join(" ");

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
