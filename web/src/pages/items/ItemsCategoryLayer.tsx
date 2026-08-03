import { Tags } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../../components/common/EmptyState";
import { Button, CardGrid } from "../../components/ui";
import type { CategorySummary } from "../../domain/items/categoryAggregates";
import { ItemsCategoryCard } from "./ItemsCategoryCard";

type Props = {
  categoriesEmpty: boolean;
  allTypesSummary: CategorySummary;
  categorySummaries: CategorySummary[];
  onOpenCategory: (id: string) => void;
  onManageCategories: () => void;
  onAddItem: () => void;
};

/** Category overview grid (non-list layer of ItemsPage). */
export function ItemsCategoryLayer({
  categoriesEmpty,
  allTypesSummary,
  categorySummaries,
  onOpenCategory,
  onManageCategories,
  onAddItem,
}: Props) {
  const { t } = useTranslation("items");

  if (categoriesEmpty) {
    return (
      <EmptyState
        compact
        title={t("emptyCategories")}
        description={t("emptyCategoriesHint")}
        illustration={
          <Tags size={40} color="var(--accent)" strokeWidth={1.5} aria-hidden />
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

  return (
    <CardGrid data-testid="items-category-grid">
      <ItemsCategoryCard
        summary={allTypesSummary}
        title={t("allCategories")}
        onOpen={() => onOpenCategory(allTypesSummary.id)}
      />
      {categorySummaries.map((summary) => (
        <ItemsCategoryCard
          key={summary.id}
          summary={summary}
          onOpen={() => onOpenCategory(summary.id)}
        />
      ))}
    </CardGrid>
  );
}
