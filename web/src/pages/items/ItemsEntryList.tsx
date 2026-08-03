import { ArrowLeft, Package } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../../components/common/EmptyState";
import {
  Button,
  CardGrid,
  FilterChip,
  OpsControlBar,
  PanelSection,
  TextField,
} from "../../components/ui";
import {
  deleteItem,
  updateItem,
  type ItemCategory,
  type TrackableItem,
} from "../../api/items";
import { categoryLabel } from "../../domain/items/categoryAggregates";
import { resolveItemEmoji } from "../../domain/items/itemCalendarProjection";
import type { Workset } from "../../types/worksets";
import { ItemsEntryCard } from "./ItemsEntryCard";
import type { ItemsFilterKey } from "./itemsListModel";

type GroupedRows = Array<{ worksetId: string; rows: TrackableItem[] }>;

type Props = {
  filter: ItemsFilterKey;
  search: string;
  emptyKind: "none" | "true-empty" | "filtered-empty";
  grouped: GroupedRows;
  categoryById: Map<string, ItemCategory>;
  worksetById: Map<string, Workset>;
  onFilterChange: (key: ItemsFilterKey) => void;
  onSearchChange: (value: string) => void;
  onBack: () => void;
  onClearFilters: () => void;
  onAddItem: () => void;
  onOpenItem: (item: TrackableItem) => void;
  onRefresh: () => Promise<void>;
};

/** List-layer filters + workset-grouped entry cards. */
export function ItemsEntryList({
  filter,
  search,
  emptyKind,
  grouped,
  categoryById,
  worksetById,
  onFilterChange,
  onSearchChange,
  onBack,
  onClearFilters,
  onAddItem,
  onOpenItem,
  onRefresh,
}: Props) {
  const { t } = useTranslation("items");

  return (
    <>
      <OpsControlBar ariaLabel={t("filterBarAria")} className="mb-md flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          aria-label={t("backToCategories")}
        >
          <ArrowLeft size={14} strokeWidth={2} aria-hidden />
          {t("backToCategories")}
        </Button>
        {(
          [
            ["all", "filterAll"],
            ["expiring", "filterExpiring"],
            ["overdue", "filterOverdue"],
            ["archived", "filterArchived"],
          ] as const
        ).map(([key, labelKey]) => (
          <FilterChip
            key={key}
            size="sm"
            active={filter === key}
            onClick={() => onFilterChange(key)}
          >
            {t(labelKey)}
          </FilterChip>
        ))}
        <TextField
          className="min-w-[160px] flex-1"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label={t("searchPlaceholder")}
        />
      </OpsControlBar>

      {emptyKind !== "none" ? (
        <EmptyState
          compact
          title={emptyKind === "true-empty" ? t("empty") : t("emptyFiltered")}
          description={
            emptyKind === "true-empty" ? t("emptyHint") : t("emptyFilteredHint")
          }
          illustration={
            <Package size={40} color="var(--accent)" strokeWidth={1.5} aria-hidden />
          }
          actions={
            emptyKind === "true-empty" ? (
              <Button variant="primary" size="sm" onClick={onAddItem}>
                {t("addItem")}
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={onClearFilters}>
                {t("clearFilters")}
              </Button>
            )
          }
        />
      ) : null}

      <div className="flex flex-col gap-md" data-testid="items-entry-sections">
        {grouped.map(({ worksetId, rows }) => (
          <PanelSection
            key={worksetId}
            title={worksetById.get(worksetId)?.name || worksetId}
            showCount
            itemCount={rows.length}
          >
            <CardGrid data-testid={`items-entry-grid-${worksetId}`}>
              {rows.map((item) => {
                const cat = item.categoryId
                  ? categoryById.get(item.categoryId)
                  : undefined;
                return (
                  <ItemsEntryCard
                    key={item.id}
                    item={item}
                    emoji={resolveItemEmoji(item, cat)}
                    categoryLabel={categoryLabel(cat, t)}
                    onOpen={() => onOpenItem(item)}
                    actions={
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            void updateItem(item.id, {
                              status:
                                item.status === "archived" ? "active" : "archived",
                            }).then(onRefresh)
                          }
                        >
                          {item.status === "archived" ? t("unarchive") : t("archive")}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            if (!window.confirm(t("deleteItemConfirm"))) return;
                            void deleteItem(item.id).then(onRefresh);
                          }}
                        >
                          {t("deleteItem")}
                        </Button>
                      </>
                    }
                  />
                );
              })}
            </CardGrid>
          </PanelSection>
        ))}
      </div>
    </>
  );
}
