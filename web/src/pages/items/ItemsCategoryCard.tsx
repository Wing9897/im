/**
 * Category (type) tile for the /items first layer.
 */

import { useTranslation } from "react-i18next";
import { AccentBarCard, Badge, captionClass } from "../../components/ui";
import { cardBodyClass, cardTitleClass } from "../../components/ui/pageTypography";
import type { CategorySummary } from "../../domain/items/categoryAggregates";
import {
  ALL_CATEGORIES_ID,
  categoryLabel,
  isSyntheticCategoryId,
} from "../../domain/items/categoryAggregates";
import { resolveCategoryCardEmoji } from "../../domain/items/itemCalendarProjection";
import { ItemCardEmojiPicker } from "./ItemCardEmojiPicker";

type Props = {
  summary: CategorySummary;
  /** Optional override label (e.g. all-types card). */
  title?: string;
  onOpen: () => void;
  /** Persist emoji without opening the full category editor. */
  onEmojiChange?: (emoji: string) => void | Promise<void>;
};

function accentColor(summary: CategorySummary): string {
  if (summary.id === ALL_CATEGORIES_ID) return "var(--accent)";
  return summary.category?.color?.trim() || "var(--text-muted)";
}

export function ItemsCategoryCard({ summary, title, onOpen, onEmojiChange }: Props) {
  const { t } = useTranslation("items");
  const label =
    title ??
    (summary.id === ALL_CATEGORIES_ID
      ? t("allCategories")
      : categoryLabel(summary.category, t));
  const emoji = resolveCategoryCardEmoji(summary.id, summary.category);
  const canEditEmoji =
    Boolean(onEmojiChange) && !isSyntheticCategoryId(summary.id);

  return (
    <AccentBarCard
      accentStyle={{ backgroundColor: accentColor(summary) }}
      material="elevated"
      interactive
      enter="rise"
      density="compact"
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
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-sm gap-y-xs">
        <ItemCardEmojiPicker
          emoji={emoji}
          name={label}
          backgroundColor={
            summary.id === ALL_CATEGORIES_ID
              ? "var(--accent)"
              : summary.category?.color
          }
          onSelect={canEditEmoji ? onEmojiChange : undefined}
          testId={`items-category-emoji-${summary.id}`}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-xs">
            <h3 className={`m-0 min-w-0 truncate ${cardTitleClass}`} title={label}>
              {label}
            </h3>
            {summary.category?.color ? (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: summary.category.color }}
                aria-hidden
              />
            ) : null}
          </div>
          <p className={`mt-0.5 mb-0 ${cardBodyClass}`}>
            {t("categoryItemCount", { count: summary.itemCount })}
          </p>
        </div>
        <div className="col-span-2 flex flex-wrap gap-xs">
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
    </AccentBarCard>
  );
}
