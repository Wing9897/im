import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tags } from "lucide-react";
import { AlertBanner, Button } from "../../components/ui";
import { SkeletonScreen } from "../../components/common/SkeletonScreen";
import { contentFadeClass } from "../../components/ui/pageLayout";
import { updateItemCategory, type TrackableItem } from "../../api/items";
import { useToast } from "../../context/ToastContext";
import { useSlashFocusSearch } from "../../hooks/useSlashFocusSearch";
import {
  ALL_CATEGORIES_ID,
  UNCATEGORIZED_CATEGORY_ID,
  buildCategorySummaries,
  categoryLabel,
  filterItemsByCategoryRoute,
  isSyntheticCategoryId,
} from "../../domain/items/categoryAggregates";
import { itemsEmptyKind } from "../../domain/items/itemAttributes";
import { formatItemsError } from "../../domain/items/itemErrors";
import { CategoryManageDialog } from "./CategoryManageDialog";
import { scheduleEmojiPickerPreload } from "./emojiPickerLoader";
import { ItemsCategoryLayer } from "./ItemsCategoryLayer";
import { ItemsChromeSearch } from "./ItemsChromeSearch";
import { ItemsEntryList } from "./ItemsEntryList";
import { ItemsEntryToolbar } from "./ItemsEntryToolbar";
import { ItemsPageChrome } from "./ItemsPageChrome";
import { itemsPageFillClass } from "./itemsPageChromeClasses";
import {
  filterItemsList,
  groupItemsByWorkset,
  sortItemsList,
  type ItemsFilterKey,
  type ItemsSortKey,
} from "./itemsListModel";
import { buildItemsEditPath, buildItemsNewPath } from "./itemsNavigation";
import { useItemsData } from "./useItemsData";
import { useItemsDeepLinks } from "./useItemsDeepLinks";

export function ItemsPage() {
  const { t } = useTranslation("items");
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { categoryId: routeCategoryId } = useParams<{ categoryId?: string }>();
  const { items, categories, worksets, loading, error, refresh } = useItemsData();
  const [filter, setFilter] = useState<ItemsFilterKey>("all");
  const [search, setSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [sort, setSort] = useState<ItemsSortKey>("expiry");
  /** Entry list: flat cards by default; optional workset sections. */
  const [groupByWorkset, setGroupByWorkset] = useState(false);
  const [manageCategories, setManageCategories] = useState(false);

  const listLayer = Boolean(routeCategoryId);
  const categoryRouteId = routeCategoryId ?? null;

  useItemsDeepLinks({ loading, items, listLayer });
  useSlashFocusSearch(!loading);

  // Warm emoji-picker-react after first paint so card/form open is not blocked.
  useEffect(() => {
    if (loading) return;
    return scheduleEmojiPickerPreload(2500);
  }, [loading]);

  // Drop entry-list search/filter/layout when leaving a category route.
  useEffect(() => {
    if (listLayer) return;
    setFilter("all");
    setSearch("");
    setSort("expiry");
    setGroupByWorkset(false);
  }, [listLayer]);

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

  const filteredCategorySummaries = useMemo(() => {
    const needle = categorySearch.trim().toLowerCase();
    if (!needle) return categorySummaries;
    return categorySummaries.filter((summary) => {
      const label = categoryLabel(summary.category, t).toLowerCase();
      const emoji = (summary.category?.emoji ?? "").toLowerCase();
      const name = (summary.category?.name ?? "").toLowerCase();
      return label.includes(needle) || emoji.includes(needle) || name.includes(needle);
    });
  }, [categorySummaries, categorySearch, t]);

  const categorySearchActive = categorySearch.trim().length > 0;
  const categorySearchEmpty =
    categorySearchActive && filteredCategorySummaries.length === 0;

  const scopedItems = useMemo(
    () => filterItemsByCategoryRoute(items, categoryRouteId),
    [items, categoryRouteId],
  );

  const filtered = useMemo(
    () => filterItemsList(scopedItems, filter, search),
    [scopedItems, filter, search],
  );

  const grouped = useMemo(
    () => groupItemsByWorkset(filtered, worksets.map((w) => w.id), sort),
    [filtered, worksets, sort],
  );

  const sortedItems = useMemo(
    () => sortItemsList(filtered, sort),
    [filtered, sort],
  );

  const emptyKind = itemsEmptyKind({
    totalCount: scopedItems.length,
    filteredCount: filtered.length,
  });

  const searchActive = search.trim().length > 0;

  const listTitle = useMemo(() => {
    if (!categoryRouteId || categoryRouteId === ALL_CATEGORIES_ID) {
      return t("allCategories");
    }
    if (categoryRouteId === UNCATEGORIZED_CATEGORY_ID) {
      return t("noCategory");
    }
    return categoryLabel(categoryById.get(categoryRouteId), t);
  }, [categoryRouteId, categoryById, t]);

  const clearFilters = useCallback(() => {
    setFilter("all");
    setSearch("");
  }, []);

  const openCategory = (id: string) => {
    navigate(`/items/category/${encodeURIComponent(id)}`);
  };

  const openCreate = () => {
    navigate(buildItemsNewPath({ categoryId: categoryRouteId }));
  };

  const openEdit = (item: TrackableItem) => {
    navigate(buildItemsEditPath(item.id, { categoryId: categoryRouteId }));
  };

  const onCategoryEmojiChange = async (categoryId: string, emoji: string) => {
    if (isSyntheticCategoryId(categoryId)) return;
    try {
      await updateItemCategory(categoryId, { emoji: emoji.trim() || null });
      await refresh();
    } catch (err) {
      showToast(formatItemsError(err, t), "error");
      throw err;
    }
  };

  const paneClass = `im-animate-in min-w-0 ${contentFadeClass}`;

  const primaryActions = (
    <>
      <Button variant="secondary" size="sm" onClick={() => setManageCategories(true)}>
        <Tags size={14} strokeWidth={2} aria-hidden />
        {t("manageCategories")}
      </Button>
      <Button variant="primary" size="sm" onClick={openCreate}>
        {t("addItem")}
      </Button>
    </>
  );

  return (
    <div className={itemsPageFillClass} data-testid="items-page">
      {listLayer ? (
        <ItemsEntryToolbar
          listTitle={listTitle}
          filter={filter}
          search={search}
          sort={sort}
          groupByWorkset={groupByWorkset}
          onFilterChange={setFilter}
          onSearchChange={setSearch}
          onSortChange={setSort}
          onGroupByWorksetChange={setGroupByWorkset}
          onBack={() => navigate("/items")}
          onAddItem={openCreate}
          onManageCategories={() => setManageCategories(true)}
        />
      ) : (
        <ItemsPageChrome
          title={t("pageTitle")}
          controlsAriaLabel={t("categorySearchAria")}
          controls={
            <ItemsChromeSearch
              value={categorySearch}
              onChange={setCategorySearch}
              placeholderKey="categorySearchPlaceholder"
              ariaKey="categorySearchAria"
              data-testid="items-category-search"
            />
          }
          actions={primaryActions}
          data-testid="items-category-toolbar"
        />
      )}

      <div className="im-auto-scrollbar min-h-0 overflow-y-auto">
        <div className="mx-auto w-full min-w-0 max-w-[1280px] px-page-x py-md max-[780px]:px-sm max-[780px]:py-sm">
          {error ? (
            <AlertBanner variant="error" role="alert">
              {error}
            </AlertBanner>
          ) : null}
          {loading ? (
            <div className="min-h-[12rem]" aria-busy="true">
              <SkeletonScreen variant="card-grid" count={6} columns={3} />
            </div>
          ) : null}

          {!listLayer && !loading ? (
            <div
              className={paneClass}
              data-allow-opacity-transition
              data-testid="items-category-pane"
            >
              <ItemsCategoryLayer
                categoriesEmpty={categories.length === 0 && items.length === 0}
                searchEmpty={categorySearchEmpty}
                showAllTypes={!categorySearchActive}
                allTypesSummary={allTypesSummary}
                categorySummaries={
                  categorySearchActive ? filteredCategorySummaries : categorySummaries
                }
                onOpenCategory={openCategory}
                onManageCategories={() => setManageCategories(true)}
                onAddItem={openCreate}
                onClearSearch={() => setCategorySearch("")}
                onCategoryEmojiChange={onCategoryEmojiChange}
              />
            </div>
          ) : null}

          {listLayer && !loading ? (
            <div
              className={paneClass}
              data-allow-opacity-transition
              data-testid="items-entry-pane"
              key={categoryRouteId ?? "list"}
            >
              <ItemsEntryList
                emptyKind={emptyKind}
                searchActive={searchActive}
                groupByWorkset={groupByWorkset}
                items={sortedItems}
                grouped={grouped}
                categoryById={categoryById}
                worksetById={worksetById}
                onClearFilters={clearFilters}
                onAddItem={openCreate}
                onOpenItem={openEdit}
                onRefresh={refresh}
              />
            </div>
          ) : null}
        </div>
      </div>

      {manageCategories ? (
        <CategoryManageDialog
          categories={categories}
          onClose={() => setManageCategories(false)}
          onChanged={refresh}
        />
      ) : null}
    </div>
  );
}
