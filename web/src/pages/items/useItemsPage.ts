import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { createItem, updateItemCategory, type TrackableItem } from "../../api/items";
import { useToast } from "../../context/ToastContext";
import { useSlashFocusSearch } from "../../hooks/useSlashFocusSearch";
import {
  ALL_CATEGORIES_ID,
  UNCATEGORIZED_CATEGORY_ID,
  buildCategorySummaries,
  categoryLabel,
  filterItemsByCategoryRoute,
  isSyntheticCategoryId,
  sortCategorySummaries,
} from "../../domain/items/categoryAggregates";
import { buildDuplicateItemBody } from "../../domain/items/itemDuplicate";
import { itemsEmptyKind } from "../../domain/items/itemExpiryTone";
import { formatItemsError } from "../../domain/items/itemErrors";
import { scheduleEmojiPickerPreload } from "../../components/items/emoji/emojiPickerLoader";
import {
  ITEMS_SORT_OPTION_KEYS,
  buildItemsListFetchParams,
  filterItemsList,
  groupItemsByWorkset,
  indexById,
  sortItemsList,
  type ItemsFilterKey,
  type ItemsSortKey,
} from "./itemsListModel";
import { buildItemsEditPath, buildItemsNewPath } from "./itemsNavigation";
import { useItemsData } from "./useItemsData";
import { useItemsDeepLinks } from "./useItemsDeepLinks";

/** List / category-layer state, derived views, and navigation handlers for ItemsPage. */
export function useItemsPage() {
  const { t } = useTranslation("items");
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { categoryId: routeCategoryId } = useParams<{ categoryId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<ItemsFilterKey>("all");
  const [search, setSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [categorySort, setCategorySort] = useState<ItemsSortKey>("expiry");
  const [sort, setSort] = useState<ItemsSortKey>("expiry");
  /** Entry list: flat cards by default; optional workset sections. */
  const [groupByWorkset, setGroupByWorkset] = useState(false);
  const [manageCategories, setManageCategories] = useState(false);

  const listLayer = Boolean(routeCategoryId);
  const categoryRouteId = routeCategoryId ?? null;
  const worksetFilterId = listLayer ? searchParams.get("worksetId")?.trim() || null : null;

  const listFetch = useMemo(
    () =>
      listLayer
        ? buildItemsListFetchParams({
            categoryRouteId,
            filter,
            search,
            worksetFilterId,
          })
        : null,
    [listLayer, categoryRouteId, filter, search, worksetFilterId],
  );

  const { items, categories, worksets, loading, error, refresh } = useItemsData({ listFetch });

  useItemsDeepLinks({ loading, items, listLayer });
  useSlashFocusSearch(!loading);

  useEffect(() => {
    if (loading) return;
    return scheduleEmojiPickerPreload(2500);
  }, [loading]);

  useEffect(() => {
    if (listLayer) return;
    setFilter("all");
    setSearch("");
    setSort("expiry");
    setGroupByWorkset(false);
    if (searchParams.has("worksetId")) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("worksetId");
          return next;
        },
        { replace: true },
      );
    }
  }, [listLayer, searchParams, setSearchParams]);

  const categoryById = useMemo(() => indexById(categories), [categories]);
  const worksetById = useMemo(() => indexById(worksets), [worksets]);

  const categorySummaries = useMemo(
    () => buildCategorySummaries(categories, items),
    [categories, items],
  );

  const sortedCategorySummaries = useMemo(
    () =>
      sortCategorySummaries(categorySummaries, categorySort, (summary) =>
        categoryLabel(summary.category, t),
      ),
    [categorySummaries, categorySort, t],
  );

  const categorySortOptions = useMemo(
    () => ITEMS_SORT_OPTION_KEYS.map(([value, labelKey]) => ({ value, label: t(labelKey) })),
    [t],
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
    if (!needle) return sortedCategorySummaries;
    return sortedCategorySummaries.filter((summary) => {
      const label = categoryLabel(summary.category, t).toLowerCase();
      const emoji = (summary.category?.emoji ?? "").toLowerCase();
      const name = (summary.category?.name ?? "").toLowerCase();
      return label.includes(needle) || emoji.includes(needle) || name.includes(needle);
    });
  }, [sortedCategorySummaries, categorySearch, t]);

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
    if (worksetFilterId) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("worksetId");
          return next;
        },
        { replace: true },
      );
    }
  }, [worksetFilterId, setSearchParams]);

  const setWorksetFilterId = useCallback(
    (worksetId: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (worksetId) next.set("worksetId", worksetId);
          else next.delete("worksetId");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const openCategory = useCallback(
    (id: string) => {
      navigate(`/items/category/${encodeURIComponent(id)}`);
    },
    [navigate],
  );

  const openCreate = useCallback(() => {
    navigate(buildItemsNewPath({ categoryId: categoryRouteId }));
  }, [navigate, categoryRouteId]);

  const openEdit = useCallback(
    (item: TrackableItem) => {
      navigate(buildItemsEditPath(item.id, { categoryId: categoryRouteId }));
    },
    [navigate, categoryRouteId],
  );

  const duplicateItem = useCallback(
    async (source: TrackableItem) => {
      try {
        const created = await createItem(buildDuplicateItemBody(source, t("duplicateItemSuffix")));
        await refresh();
        navigate(buildItemsEditPath(created.id, { categoryId: categoryRouteId }));
      } catch (err) {
        showToast(formatItemsError(err, t), "error");
      }
    },
    [categoryRouteId, navigate, refresh, showToast, t],
  );

  const onCategoryEmojiChange = useCallback(
    async (categoryId: string, emoji: string) => {
      if (isSyntheticCategoryId(categoryId)) return;
      try {
        await updateItemCategory(categoryId, { emoji: emoji.trim() || null });
        await refresh();
      } catch (err) {
        showToast(formatItemsError(err, t), "error");
        throw err;
      }
    },
    [refresh, showToast, t],
  );

  const categoriesEmpty = categories.length === 0 && items.length === 0;

  return {
    t,
    listLayer,
    categoryRouteId,
    loading,
    error,
    categories,
    categoriesEmpty,
    filter,
    setFilter,
    search,
    setSearch,
    categorySearch,
    setCategorySearch,
    categorySort,
    setCategorySort,
    sort,
    setSort,
    groupByWorkset,
    setGroupByWorkset,
    manageCategories,
    setManageCategories,
    worksetFilterId,
    worksets,
    categoryById,
    worksetById,
    categorySortOptions,
    allTypesSummary,
    filteredCategorySummaries,
    sortedCategorySummaries,
    categorySearchActive,
    categorySearchEmpty,
    emptyKind,
    searchActive,
    listTitle,
    sortedItems,
    grouped,
    clearFilters,
    setWorksetFilterId,
    openCategory,
    openCreate,
    openEdit,
    duplicateItem,
    onCategoryEmojiChange,
    refresh,
    navigate,
  };
}
