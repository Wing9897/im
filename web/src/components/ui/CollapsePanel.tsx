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
}

/** Compact collapsible settings section (spacing-only; no divider chrome). */
export function CollapsePanel({
  title,
  open,
  onToggle,
  children,
  className,
}: CollapsePanelProps) {
  const { t } = useTranslation("common");
  const rootCls = ["overflow-hidden", className ?? ""].filter(Boolean).join(" ");

  return (
    <SurfaceCard density="field" className={rootCls}>
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
      {open ? (
        <FormStack gap="lg" className="pt-md">
          {children}
        </FormStack>
      ) : null}
    </SurfaceCard>
  );
}
