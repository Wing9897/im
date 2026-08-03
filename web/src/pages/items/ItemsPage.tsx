import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tags } from "lucide-react";
import {
  AlertBanner,
  AppPageShell,
  Button,
  captionClass,
} from "../../components/ui";
import {
  createItem,
  updateItem,
  type TrackableItem,
} from "../../api/items";
import {
  ALL_CATEGORIES_ID,
  UNCATEGORIZED_CATEGORY_ID,
  buildCategorySummaries,
  categoryLabel,
  filterItemsByCategoryRoute,
  isSyntheticCategoryId,
} from "../../domain/items/categoryAggregates";
import {
  itemsEmptyKind,
  partitionItemAttributes,
  resolveRemindOnCategoryChange,
} from "../../domain/items/itemAttributes";
import { ItemFormDialog } from "./ItemFormDialog";
import { CategoryManageDialog } from "./CategoryManageDialog";
import { ItemsCategoryLayer } from "./ItemsCategoryLayer";
import { ItemsEntryList } from "./ItemsEntryList";
import {
  filterItemsList,
  groupItemsByWorkset,
  type ItemsFilterKey,
} from "./itemsListModel";
import { useItemsData } from "./useItemsData";
import { useItemsDeepLinks } from "./useItemsDeepLinks";

export function ItemsPage() {
  const { t } = useTranslation("items");
  const navigate = useNavigate();
  const { categoryId: routeCategoryId } = useParams<{ categoryId?: string }>();
  const { items, categories, worksets, loading, error, reload, refresh } =
    useItemsData();
  const [filter, setFilter] = useState<ItemsFilterKey>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<TrackableItem | null | "new">(null);
  const [createWorksetId, setCreateWorksetId] = useState<string | null>(null);
  const [manageCategories, setManageCategories] = useState(false);

  const listLayer = Boolean(routeCategoryId);
  const categoryRouteId = routeCategoryId ?? null;

  useItemsDeepLinks({
    loading,
    items,
    listLayer,
    setEditing,
    setCreateWorksetId,
  });

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const worksetById = useMemo(
    () => new Map(worksets.map((w) => [w.id, w])),
    [worksets],
  );

  const categorySummaries = useMemo(
    () => buildCategorySummaries(categories, items),
    [categories, items],
  );

  const allTypesSummary = useMemo(() => {
    const active = items.filter((i) => i.status !== "archived");
    return {
      id: ALL_CATEGORIES_ID,
      category: null,
      itemCount: active.length,
      expiringCount: categorySummaries.reduce((n, s) => n + s.expiringCount, 0),
      overdueCount: categorySummaries.reduce((n, s) => n + s.overdueCount, 0),
    };
  }, [items, categorySummaries]);

  const scopedItems = useMemo(
    () => filterItemsByCategoryRoute(items, categoryRouteId),
    [items, categoryRouteId],
  );

  const filtered = useMemo(
    () => filterItemsList(scopedItems, filter, search),
    [scopedItems, filter, search],
  );

  const grouped = useMemo(
    () => groupItemsByWorkset(filtered, worksets.map((w) => w.id)),
    [filtered, worksets],
  );

  const emptyKind = itemsEmptyKind({
    totalCount: scopedItems.length,
    filteredCount: filtered.length,
  });

  const clearFilters = () => {
    setFilter("all");
    setSearch("");
  };

  const openCategory = (id: string) => {
    navigate(`/items/category/${encodeURIComponent(id)}`);
  };

  const handleSave = async (draft: {
    id?: string;
    title: string;
    worksetId: string;
    categoryId: string | null;
    purchasedAt: string | null;
    expiresAt: string | null;
    remindBeforeDays: number | null;
    notes: string;
    emoji: string | null;
    attributes: Record<string, string>;
    status: "active" | "archived";
  }) => {
    if (draft.id) {
      await updateItem(draft.id, draft);
    } else {
      await createItem(draft);
    }
    setEditing(null);
    await reload();
  };

  const defaultNewCategoryId = useMemo(() => {
    if (!categoryRouteId || isSyntheticCategoryId(categoryRouteId)) {
      if (categoryRouteId === UNCATEGORIZED_CATEGORY_ID) return null;
      return null;
    }
    return categoryRouteId;
  }, [categoryRouteId]);

  return (
    <AppPageShell
      width="fluid"
      actions={
        <div className="flex flex-wrap items-center gap-sm">
          <Button variant="secondary" size="sm" onClick={() => setManageCategories(true)}>
            <Tags size={14} strokeWidth={2} aria-hidden />
            {t("manageCategories")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setCreateWorksetId(null);
              setEditing("new");
            }}
          >
            {t("addItem")}
          </Button>
        </div>
      }
    >
      {error ? (
        <AlertBanner variant="error" role="alert">
          {error}
        </AlertBanner>
      ) : null}
      {loading ? <p className={captionClass}>…</p> : null}

      {!listLayer && !loading ? (
        <ItemsCategoryLayer
          categoriesEmpty={categories.length === 0 && items.length === 0}
          allTypesSummary={allTypesSummary}
          categorySummaries={categorySummaries}
          onOpenCategory={openCategory}
          onManageCategories={() => setManageCategories(true)}
          onAddItem={() => setEditing("new")}
        />
      ) : null}

      {listLayer ? (
        <ItemsEntryList
          filter={filter}
          search={search}
          emptyKind={loading ? "none" : emptyKind}
          grouped={loading ? [] : grouped}
          categoryById={categoryById}
          worksetById={worksetById}
          onFilterChange={setFilter}
          onSearchChange={setSearch}
          onBack={() => navigate("/items")}
          onClearFilters={clearFilters}
          onAddItem={() => setEditing("new")}
          onOpenItem={setEditing}
          onRefresh={refresh}
        />
      ) : null}

      {editing != null ? (
        <ItemFormDialog
          item={editing === "new" ? null : editing}
          categories={categories}
          worksets={worksets}
          categoryLabel={categoryLabel}
          initialCategoryId={editing === "new" ? defaultNewCategoryId : undefined}
          initialWorksetId={editing === "new" ? createWorksetId : undefined}
          onClose={() => {
            setEditing(null);
            setCreateWorksetId(null);
          }}
          onSave={handleSave}
          partitionItemAttributes={partitionItemAttributes}
          resolveRemindOnCategoryChange={resolveRemindOnCategoryChange}
        />
      ) : null}

      {manageCategories ? (
        <CategoryManageDialog
          categories={categories}
          onClose={() => setManageCategories(false)}
          onChanged={refresh}
        />
      ) : null}
    </AppPageShell>
  );
}
