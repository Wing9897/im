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
  /** Active trackable items in this workset (optional count badge). */
  itemCount?: number;
  onOpen?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}

/** First-class workset entity card (system「一般」or user-created). */
export function WorksetSummaryCard({
  id,
  title,
  isSystem,
  taskCount,
  itemCount,
  onOpen,
  onRename,
  onDelete,
}: WorksetSummaryCardProps) {
  const { t } = useTranslation("common");

  return (
    <AccentBarCard
      accentClass={isSystem ? "bg-info" : "bg-accent"}
      enter="rise"
      interactive={Boolean(onOpen)}
      data-testid={`workset-card-${id}`}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
      aria-label={t("workset.openDetailAria", { name: title })}
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
      {isSystem ? (
        <p className={cardBodyClass}>{t("workset.systemDescription")}</p>
      ) : null}
      <p className={`${cardBodyClass} ${isSystem ? "opacity-90" : ""}`}>
        {t("workset.assetSummary", {
          tasks: taskCount,
          items: itemCount ?? 0,
        })}
      </p>
      {!isSystem && id !== "__unassigned__" ? (
        <div
          className="mt-auto flex flex-wrap gap-1 pt-xs"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
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
    </AccentBarCard>
  );
}
