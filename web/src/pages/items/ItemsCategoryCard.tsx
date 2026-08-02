/**
 * Category (type) tile for the /items first layer.
 */

import { useTranslation } from "react-i18next";
import { Badge, SurfaceCard, captionClass } from "../../components/ui";
import { cardBodyClass, cardTitleClass } from "../../components/ui/pageTypography";
import type { CategorySummary } from "../../domain/items/categoryAggregates";
import { ALL_CATEGORIES_ID, categoryLabel } from "../../domain/items/categoryAggregates";

type Props = {
  summary: CategorySummary;
  /** Optional override label (e.g. all-types card). */
  title?: string;
  onOpen: () => void;
};

function accentColor(summary: CategorySummary): string {
  if (summary.id === ALL_CATEGORIES_ID) return "var(--accent)";
  return summary.category?.color?.trim() || "var(--text-muted)";
}

export function ItemsCategoryCard({ summary, title, onOpen }: Props) {
  const { t } = useTranslation("items");
  const label =
    title ??
    (summary.id === ALL_CATEGORIES_ID
      ? t("allCategories")
      : categoryLabel(summary.category, t));

  return (
    <SurfaceCard
      material="elevated"
      interactive
      enter="rise"
      padding="none"
      className="relative flex h-full min-w-0 overflow-hidden"
      data-testid={`items-category-card-${summary.id}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={t("openCategoryAria", { name: label })}
    >
      <span
        className="w-[2px] shrink-0 self-stretch"
        style={{ backgroundColor: accentColor(summary) }}
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 flex-col gap-sm px-card-inner py-md">
        <div className="flex items-start justify-between gap-sm">
          <span className={`min-w-0 flex-1 truncate ${cardTitleClass}`} title={label}>
            {label}
          </span>
          {summary.category?.color ? (
            <span
              className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full border border-surface-border"
              style={{ backgroundColor: summary.category.color }}
              aria-hidden
            />
          ) : null}
        </div>
        <p className={cardBodyClass}>{t("categoryItemCount", { count: summary.itemCount })}</p>
        <div className="mt-auto flex flex-wrap gap-xs pt-xs">
          {summary.expiringCount > 0 ? (
            <Badge tone="warning" className="normal-case tracking-normal">
              {t("categoryExpiringCount", { count: summary.expiringCount })}
            </Badge>
          ) : null}
          {summary.overdueCount > 0 ? (
            <Badge tone="danger" className="normal-case tracking-normal">
              {t("categoryOverdueCount", { count: summary.overdueCount })}
            </Badge>
          ) : null}
          {summary.itemCount === 0 ? (
            <span className={captionClass}>{t("categoryEmptyHint")}</span>
          ) : null}
        </div>
      </div>
    </SurfaceCard>
  );
}
