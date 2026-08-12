import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { FormStack } from "./FormStack";
import { SurfaceCard } from "./SurfaceCard";

interface CollapsePanelProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
  /**
   * Nest inside an already-frosted parent (e.g. SettingsContentCard): skip SurfaceCard
   * fill so only inner ``im-surface-panel`` blocks frost — avoids double-muddy glass.
   */
  nested?: boolean;
}

/** Compact collapsible settings section (spacing-only; no divider chrome). */
export function CollapsePanel({
  title,
  open,
  onToggle,
  children,
  className,
  nested = false,
}: CollapsePanelProps) {
  const { t } = useTranslation("common");
  // No overflow-hidden: it clips backdrop-filter and kills frosted panels under photo BG.
  const rootCls = [className ?? ""].filter(Boolean).join(" ");

  const header = (
    <div className="flex min-h-8 items-center justify-between gap-sm">
      <div className="min-w-0 flex-1 text-caption font-semibold leading-snug text-text-primary">
        {title}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={
          open
            ? t("ui.collapseTitle", { title })
            : t("ui.expandTitle", { title })
        }
        title={open ? t("ui.collapse") : t("ui.expand")}
        className="shrink-0"
      >
        {open ? (
          <ChevronUp size={14} strokeWidth={2.2} aria-hidden="true" />
        ) : (
          <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" />
        )}
      </Button>
    </div>
  );

  const body = open ? (
    <FormStack gap="lg" className="pt-md">
      {children}
    </FormStack>
  ) : null;

  if (nested) {
    return (
      <div className={rootCls || undefined}>
        {header}
        {body}
      </div>
    );
  }

  return (
    <SurfaceCard density="field" className={rootCls}>
      {header}
      {body}
    </SurfaceCard>
  );
}
