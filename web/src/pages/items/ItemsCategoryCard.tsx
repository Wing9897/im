/**
 * Category (type) tile for the /items first layer.
 */

import { useTranslation } from "react-i18next";
import { AccentBarCard, Badge } from "../../components/ui";
import { cardBodyClass, cardTitleClass, captionClass } from "../../components/ui/pageTypography";
import type { CategorySummary } from "../../domain/items/categoryAggregates";
import {
  ALL_CATEGORIES_ID,
  categoryLabel,
  isSyntheticCategoryId,
} from "../../domain/items/categoryAggregates";
import { resolveCategoryCardEmoji } from "../../domain/items/itemCalendarProjection";
import { ItemCardEmojiPicker } from "./emoji/ItemCardEmojiPicker";

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

const categoryCardTitleClass = `m-0 min-w-0 truncate ${cardTitleClass}`;

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
  const hasBadges =
    summary.expiringCount > 0 || summary.overdueCount > 0 || summary.itemCount === 0;

  return (
    <AccentBarCard
      accentStyle={{ backgroundColor: accentColor(summary) }}
      material="elevated"
      interactive
      enter="rise"
      density="default"
      className="min-h-[10.5rem]"
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
      <div className="flex h-full min-h-0 flex-col gap-sm">
        <div className="flex items-start gap-md">
          <ItemCardEmojiPicker
            emoji={emoji}
            name={label}
            avatarSize="card"
            backgroundColor={
              summary.id === ALL_CATEGORIES_ID
                ? "var(--accent)"
                : summary.category?.color
            }
            onSelect={canEditEmoji ? onEmojiChange : undefined}
            testId={`items-category-emoji-${summary.id}`}
          />
          <div className="min-w-0 flex-1">
            <h3 className={categoryCardTitleClass} title={label}>
              {label}
            </h3>
            <p className={`mt-1 mb-0 ${cardBodyClass}`}>
              {t("categoryItemCount", { count: summary.itemCount })}
            </p>
          </div>
        </div>

        {hasBadges ? (
          <div className="mt-auto flex flex-wrap items-center gap-xs pt-xs">
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
        ) : null}
      </div>
    </AccentBarCard>
  );
}
