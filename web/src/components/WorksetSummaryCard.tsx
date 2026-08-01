/**
 * Compact ownership workset card for the dashboard「工作集」grouping view.
 */

import { useTranslation } from "react-i18next";
import { AccentBarCard, Badge, Button } from "./ui";
import { cardBodyClass, cardTitleClass } from "./ui/pageTypography";

export interface WorksetSummaryCardProps {
  id: string;
  title: string;
  isSystem: boolean;
  taskCount: number;
  onRename?: () => void;
  onDelete?: () => void;
}

/** First-class workset entity card (system「一般」or user-created). */
export function WorksetSummaryCard({
  id,
  title,
  isSystem,
  taskCount,
  onRename,
  onDelete,
}: WorksetSummaryCardProps) {
  const { t } = useTranslation("common");

  return (
    <AccentBarCard
      accentClass={isSystem ? "bg-info" : "bg-accent"}
      enter="rise"
      data-testid={`workset-card-${id}`}
    >
      <div className="flex items-start justify-between gap-sm">
        <span className={`min-w-0 flex-1 truncate ${cardTitleClass}`} title={title}>
          {title}
        </span>
        {isSystem ? (
          <Badge tone="info">{t("workset.systemBadge")}</Badge>
        ) : (
          <Badge tone="neutral">{t("workset.label")}</Badge>
        )}
      </div>
      <p className={cardBodyClass}>
        {isSystem ? t("workset.systemDescription") : t("workset.taskCount", { count: taskCount })}
      </p>
      {!isSystem && id !== "__unassigned__" ? (
        <div className="mt-auto flex flex-wrap gap-1 pt-xs">
          {onRename ? (
            <Button variant="secondary" size="sm" onClick={onRename}>
              {t("workset.rename")}
            </Button>
          ) : null}
          {onDelete ? (
            <Button variant="secondary" size="sm" onClick={onDelete}>
              {t("workset.delete")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {isSystem ? (
        <p className={`${cardBodyClass} mt-xs opacity-80`}>
          {t("workset.taskCount", { count: taskCount })}
        </p>
      ) : null}
    </AccentBarCard>
  );
}
