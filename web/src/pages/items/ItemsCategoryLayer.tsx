import { Tags } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../../components/common/EmptyState";
import { Button, CardGrid } from "../../components/ui";
import type { CategorySummary } from "../../domain/items/categoryAggregates";
import { ItemsCategoryCard } from "./ItemsCategoryCard";

type Props = {
  categoriesEmpty: boolean;
  /** Search miss on category overview (types exist but none match). */
  searchEmpty?: boolean;
  /** Hide the synthetic “all types” card while a category search is active. */
  showAllTypes?: boolean;
  allTypesSummary: CategorySummary;
  categorySummaries: CategorySummary[];
  onOpenCategory: (id: string) => void;
  onManageCategories: () => void;
  onAddItem: () => void;
  onClearSearch?: () => void;
  /** Persist category emoji from the type card avatar. */
  onCategoryEmojiChange?: (categoryId: string, emoji: string) => void | Promise<void>;
};

/** Category overview grid (non-list layer of ItemsPage). */
export function ItemsCategoryLayer({
  categoriesEmpty,
  searchEmpty = false,
  showAllTypes = true,
  allTypesSummary,
  categorySummaries,
  onOpenCategory,
  onManageCategories,
  onAddItem,
  onClearSearch,
  onCategoryEmojiChange,
}: Props) {
  const { t } = useTranslation("items");

  if (categoriesEmpty) {
    return (
      <EmptyState
        compact
        title={t("emptyCategories")}
        description={t("emptyCategoriesHint")}
        illustration={
          <Tags size={22} color="var(--accent)" strokeWidth={1.5} aria-hidden />
        }
        actions={
          <div className="flex flex-wrap gap-sm">
            <Button variant="secondary" size="sm" onClick={onManageCategories}>
              {t("addCategory")}
            </Button>
            <Button variant="primary" size="sm" onClick={onAddItem}>
              {t("addItem")}
            </Button>
          </div>
        }
      />
    );
  }

  if (searchEmpty) {
    return (
      <EmptyState
        compact
        title={t("emptyCategorySearch")}
        description={t("emptyCategorySearchHint")}
        illustration={
          <Tags size={22} color="var(--accent)" strokeWidth={1.5} aria-hidden />
        }
        actions={
          onClearSearch ? (
            <Button variant="secondary" size="sm" onClick={onClearSearch}>
              {t("clearSearch")}
            </Button>
          ) : null
        }
      />
    );
  }

  return (
    <CardGrid data-testid="items-category-grid">
      {showAllTypes ? (
        <ItemsCategoryCard
          summary={allTypesSummary}
          title={t("allCategories")}
          onOpen={() => onOpenCategory(allTypesSummary.id)}
        />
      ) : null}
      {categorySummaries.map((summary) => (
        <ItemsCategoryCard
          key={summary.id}
          summary={summary}
          onOpen={() => onOpenCategory(summary.id)}
          onEmojiChange={
            onCategoryEmojiChange
              ? (emoji) => onCategoryEmojiChange(summary.id, emoji)
              : undefined
          }
        />
      ))}
    </CardGrid>
  );
}
