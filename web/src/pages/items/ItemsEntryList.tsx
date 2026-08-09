import { Package } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../../components/common/EmptyState";
import { Button, CardGrid, PanelSection } from "../../components/ui";
import {
  createItem,
  deleteItem,
  updateItem,
  type ItemCategory,
  type TrackableItem,
} from "../../api/items";
import { useToast } from "../../context/ToastContext";
import { categoryLabel } from "../../domain/items/categoryAggregates";
import { buildDuplicateItemBody } from "../../domain/items/itemDuplicate";
import { formatItemsError } from "../../domain/items/itemErrors";
import { resolveItemEmoji } from "../../domain/items/itemCalendarProjection";
import type { Workset } from "../../types/worksets";
import { ItemsEntryCard } from "../../components/items/ItemsEntryCard";

type GroupedRows = Array<{ worksetId: string; rows: TrackableItem[] }>;

type Props = {
  emptyKind: "none" | "true-empty" | "filtered-empty";
  /** When filtered-empty and search is active, use search-specific copy. */
  searchActive?: boolean;
  /** Default false: flat card grid; true: PanelSection per workset. */
  groupByWorkset?: boolean;
  /** Flat sorted rows when not grouping by workset. */
  items: TrackableItem[];
  grouped: GroupedRows;
  categoryById: Map<string, ItemCategory>;
  worksetById: Map<string, Workset>;
  onClearFilters: () => void;
  onAddItem: () => void;
  onOpenItem: (item: TrackableItem) => void;
  onDuplicateItem?: (item: TrackableItem) => void | Promise<void>;
  onRefresh: () => Promise<void>;
};

/** Entry list body (cards / empty) — chrome lives in ItemsEntryToolbar / ItemsPage. */
export function ItemsEntryList({
  emptyKind,
  searchActive = false,
  groupByWorkset = false,
  items,
  grouped,
  categoryById,
  worksetById,
  onClearFilters,
  onAddItem,
  onOpenItem,
  onDuplicateItem,
  onRefresh,
}: Props) {
  const { t } = useTranslation("items");
  const { showToast } = useToast();

  const persistItemEmoji = async (itemId: string, emoji: string) => {
    try {
      await updateItem(itemId, { emoji: emoji.trim() || null });
      await onRefresh();
    } catch (err) {
      showToast(formatItemsError(err, t), "error");
      throw err;
    }
  };

  const toggleArchive = async (item: TrackableItem) => {
    try {
      await updateItem(item.id, {
        status: item.status === "archived" ? "active" : "archived",
      });
      await onRefresh();
    } catch (err) {
      showToast(formatItemsError(err, t), "error");
    }
  };

  const duplicateItem = async (item: TrackableItem) => {
    if (onDuplicateItem) {
      await onDuplicateItem(item);
      return;
    }
    try {
      const created = await createItem(buildDuplicateItemBody(item, t("duplicateItemSuffix")));
      await onRefresh();
      onOpenItem({ ...item, id: created.id, title: created.title, status: "active" });
    } catch (err) {
      showToast(formatItemsError(err, t), "error");
    }
  };

  const renderCard = (item: TrackableItem) => {
    const cat = item.categoryId
      ? categoryById.get(item.categoryId)
      : undefined;
    return (
      <ItemsEntryCard
        key={item.id}
        item={item}
        emoji={resolveItemEmoji(item, cat)}
        categoryLabel={categoryLabel(cat, t)}
        emojiBackgroundColor={cat?.color}
        onOpen={() => onOpenItem(item)}
        onEmojiChange={(emoji) => persistItemEmoji(item.id, emoji)}
        onArchive={() => {
          void toggleArchive(item);
        }}
        onDuplicate={() => {
          void duplicateItem(item);
        }}
        onDelete={() => {
          if (!window.confirm(t("deleteItemConfirm"))) return;
          void deleteItem(item.id)
            .then(onRefresh)
            .catch((err) => {
              showToast(formatItemsError(err, t), "error");
            });
        }}
      />
    );
  };

  const filteredEmptyTitle =
    searchActive ? t("emptySearch") : t("emptyFiltered");
  const filteredEmptyHint =
    searchActive ? t("emptySearchHint") : t("emptyFilteredHint");
  const clearLabel = searchActive ? t("clearSearch") : t("clearFilters");

  return (
    <>
      {emptyKind !== "none" ? (
        <EmptyState
          compact
          title={emptyKind === "true-empty" ? t("empty") : filteredEmptyTitle}
          description={
            emptyKind === "true-empty" ? t("emptyHint") : filteredEmptyHint
          }
          illustration={
            <Package size={22} color="var(--accent)" strokeWidth={1.5} aria-hidden />
          }
          actions={
            emptyKind === "true-empty" ? (
              <Button variant="primary" size="sm" onClick={onAddItem}>
                {t("addItem")}
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={onClearFilters}>
                {clearLabel}
              </Button>
            )
          }
        />
      ) : null}

      {emptyKind === "none" && !groupByWorkset ? (
        <CardGrid density="spacious" data-testid="items-entry-grid">
          {items.map(renderCard)}
        </CardGrid>
      ) : null}

      {emptyKind === "none" && groupByWorkset ? (
        <div className="flex flex-col gap-sm" data-testid="items-entry-sections">
          {grouped.map(({ worksetId, rows }) => (
            <PanelSection
              key={worksetId}
              title={worksetById.get(worksetId)?.name || worksetId}
              showCount
              itemCount={rows.length}
            >
              <CardGrid density="spacious" data-testid={`items-entry-grid-${worksetId}`}>
                {rows.map(renderCard)}
              </CardGrid>
            </PanelSection>
          ))}
        </div>
      ) : null}
    </>
  );
}
