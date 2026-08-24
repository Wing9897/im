import { CalendarDays, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "../../../components/common/EmptyState";
import { Badge, Button, PanelSection } from "../../../components/ui";
import { captionClass } from "../../../components/ui/pageTypography";
import type { RecurringSeries } from "../../../types/recurring";

type Props = {
  series: RecurringSeries[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditChild: (child: RecurringSeries) => void;
};

export function AgentDetailChildrenSection({
  series,
  open,
  onOpenChange,
  onEditChild,
}: Props) {
  const { t } = useTranslation("common");

  return (
    <PanelSection
      title={t("tasks:agentDetail.childrenTitle")}
      showCount
      itemCount={series.length}
      collapsible
      open={open}
      onOpenChange={onOpenChange}
    >
      {series.length === 0 ? (
        <EmptyState
          title={t("tasks:agentDetail.childrenEmptyTitle")}
          description={t("tasks:agentDetail.childrenEmptyDescription")}
        />
      ) : (
        <ul className="flex flex-col gap-sm" data-testid="project-detail-children">
          {series.map((child) => (
            <li
              key={child.id}
              className="flex min-w-0 items-center justify-between gap-sm rounded-lg border border-surface-border/70 px-sm py-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-xs">
                  <CalendarDays size={14} className="shrink-0 text-text-muted" aria-hidden="true" />
                  <span className="truncate font-medium text-text-primary">{child.name}</span>
                  {!child.isActive ? (
                    <Badge tone="neutral" className="shrink-0 normal-case tracking-normal">
                      {t("tasks:card.disabled")}
                    </Badge>
                  ) : null}
                </div>
                {child.rrule.trim() ? (
                  <p className={`${captionClass} mt-0.5 truncate`}>
                    {child.rrule}
                  </p>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEditChild(child)}
                aria-label={t("tasks:card.editAria", { name: child.name })}
              >
                <Pencil size={14} aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </PanelSection>
  );
}
