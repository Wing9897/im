import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Package, Tags } from "lucide-react";
import { EmptyState } from "../../components/common/EmptyState";
import {
  AlertBanner,
  AppPageShell,
  Button,
  CardGrid,
  FilterChip,
  OpsControlBar,
  PanelSection,
  TextField,
  captionClass,
  pageTitleClass,
} from "../../components/ui";
import {
  createItem,
  deleteItem,
  listItemCategories,
  listItems,
  updateItem,
  type ItemCategory,
  type TrackableItem,
} from "../../api/items";
import { listWorksets } from "../../api/worksets";
import type { Workset } from "../../types/worksets";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import {
  ALL_CATEGORIES_ID,
  UNCATEGORIZED_CATEGORY_ID,
  buildCategorySummaries,
  categoryLabel,
  filterItemsByCategoryRoute,
  isSyntheticCategoryId,
} from "../../domain/items/categoryAggregates";
import {
  daysUntil,
  itemsEmptyKind,
  partitionItemAttributes,
  resolveRemindOnCategoryChange,
} from "../../domain/items/itemAttributes";
import { resolveItemEmoji } from "../../domain/items/itemCalendarProjection";
import { formatItemsError } from "../../domain/items/itemErrors";
import { ItemFormDialog } from "./ItemFormDialog";
import { CategoryManageDialog } from "./CategoryManageDialog";
import { ItemsCategoryCard } from "./ItemsCategoryCard";
import { ItemsEntryCard } from "./ItemsEntryCard";

type FilterKey = "all" | "expiring" | "overdue" | "archived";

export function ItemsPage() {
  const { t } = useTranslation("items");
  const navigate = useNavigate();
  const { categoryId: routeCategoryId } = useParams<{ categoryId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<TrackableItem[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [worksets, setWorksets] = useState<Workset[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TrackableItem | null | "new">(null);
  const [createWorksetId, setCreateWorksetId] = useState<string | null>(null);
  const [manageCategories, setManageCategories] = useState(false);
  const deepLinkHandled = useRef<string | null>(null);
  const createLinkHandled = useRef(false);

  // Support /items?category=… → list layer
  useEffect(() => {
    if (routeCategoryId) return;
    const q = searchParams.get("category")?.trim();
    if (!q) return;
    const next = new URLSearchParams(searchParams);
    next.delete("category");
    const qs = next.toString();
    navigate(`/items/category/${encodeURIComponent(q)}${qs ? `?${qs}` : ""}`, {
      replace: true,
    });
  }, [routeCategoryId, searchParams, navigate]);

  const listLayer = Boolean(routeCategoryId);
  const categoryRouteId = routeCategoryId ?? null;

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemRows, categoryRows, worksetRows] = await Promise.all([
        listItems(),
        listItemCategories(),
        listWorksets(),
      ]);
      setItems(itemRows);
      setCategories(categoryRows);
      setWorksets(worksetRows);
    } catch (err) {
      setError(formatItemsError(err, t));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Deep-link from Timeline: /items?itemId=…&itemDateKind=purchased|expires|remind
  useEffect(() => {
    if (loading) return;
    const itemId = searchParams.get("itemId")?.trim();
    if (!itemId) {
      deepLinkHandled.current = null;
      return;
    }
    if (deepLinkHandled.current === itemId) return;
    const match = items.find((row) => row.id === itemId);
    if (!match) return;
    deepLinkHandled.current = itemId;
    // If on type layer, jump into the item's category list first.
    if (!listLayer) {
      const catId = match.categoryId ?? UNCATEGORIZED_CATEGORY_ID;
      const next = new URLSearchParams(searchParams);
      navigate(`/items/category/${encodeURIComponent(catId)}?${next.toString()}`, {
        replace: true,
      });
      return;
    }
    setEditing(match);
    const next = new URLSearchParams(searchParams);
    next.delete("itemId");
    next.delete("itemDateKind");
    setSearchParams(next, { replace: true });
  }, [loading, items, searchParams, setSearchParams, listLayer, navigate]);

  // Deep-link from workset detail: /items?new=1&worksetId=…
  useEffect(() => {
    if (loading) return;
    const wantsNew = searchParams.get("new") === "1";
    if (!wantsNew) {
      createLinkHandled.current = false;
      return;
    }
    if (createLinkHandled.current) return;
    createLinkHandled.current = true;
    const wid = searchParams.get("worksetId")?.trim() || null;
    setCreateWorksetId(wid);
    setEditing("new");
    const next = new URLSearchParams(searchParams);
    next.delete("new");
    next.delete("worksetId");
    setSearchParams(next, { replace: true });
  }, [loading, searchParams, setSearchParams]);

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

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return scopedItems.filter((item) => {
      if (filter === "archived") {
        if (item.status !== "archived") return false;
      } else if (item.status === "archived") {
        return false;
      }
      if (filter === "overdue") {
        const days = daysUntil(item.expiresAt);
        if (days == null || days >= 0) return false;
      }
      if (filter === "expiring") {
        const days = daysUntil(item.expiresAt);
        const remind = item.remindBeforeDays ?? 7;
        if (days == null || days < 0 || days > remind) return false;
      }
      if (!needle) return true;
      const hay = `${item.title} ${item.notes} ${JSON.stringify(item.attributes)}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [scopedItems, filter, search]);

  const grouped = useMemo(() => {
    const byWorkset = new Map<string, TrackableItem[]>();
    for (const item of filtered) {
      const wid = item.worksetId || SYSTEM_WORKSET_ID;
      const list = byWorkset.get(wid) ?? [];
      list.push(item);
      byWorkset.set(wid, list);
    }
    const worksetOrder = worksets.map((w) => w.id);
    const ids = [
      ...worksetOrder.filter((id) => byWorkset.has(id)),
      ...[...byWorkset.keys()].filter((id) => !worksetOrder.includes(id)),
    ];
    return ids.map((worksetId) => {
      const rows = (byWorkset.get(worksetId) ?? []).slice().sort((a, b) => {
        const ca = a.categoryId ?? "";
        const cb = b.categoryId ?? "";
        if (ca !== cb) return ca.localeCompare(cb);
        return (a.expiresAt ?? "").localeCompare(b.expiresAt ?? "");
      });
      return { worksetId, rows };
    });
  }, [filtered, worksets]);

  const emptyKind = itemsEmptyKind({
    totalCount: scopedItems.length,
    filteredCount: filtered.length,
  });

  const listTitle = useMemo(() => {
    if (!categoryRouteId || categoryRouteId === ALL_CATEGORIES_ID) {
      return t("allCategories");
    }
    if (categoryRouteId === UNCATEGORIZED_CATEGORY_ID) {
      return t("noCategory");
    }
    return categoryLabel(categoryById.get(categoryRouteId), t);
  }, [categoryRouteId, categoryById, t]);

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
            <Tags size={14} aria-hidden />
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
      <div className="mb-md flex items-start gap-sm">
        <Package className="mt-0.5 shrink-0 text-accent" size={18} aria-hidden />
        <div className="min-w-0 flex-1">
          {listLayer ? (
            <>
              <div className="mb-xs flex flex-wrap items-center gap-sm">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/items")}
                  aria-label={t("backToCategories")}
                >
                  <ArrowLeft size={14} aria-hidden />
                  {t("backToCategories")}
                </Button>
              </div>
              <h1 className={pageTitleClass}>{listTitle}</h1>
              <p className={`${captionClass} mt-xs`}>{t("listSubtitle")}</p>
            </>
          ) : (
            <>
              <h1 className={pageTitleClass}>{t("title")}</h1>
              <p className={`${captionClass} mt-xs`}>{t("typesSubtitle")}</p>
            </>
          )}
        </div>
      </div>

      {error ? (
        <AlertBanner variant="error" role="alert">
          {error}
        </AlertBanner>
      ) : null}
      {loading ? <p className={captionClass}>…</p> : null}

      {!listLayer && !loading ? (
        <>
          {categories.length === 0 && items.length === 0 ? (
            <EmptyState
              compact
              title={t("emptyCategories")}
              description={t("emptyCategoriesHint")}
              illustration={
                <Tags size={40} color="var(--accent)" strokeWidth={1.5} aria-hidden />
              }
              actions={
                <div className="flex flex-wrap gap-sm">
                  <Button variant="secondary" size="sm" onClick={() => setManageCategories(true)}>
                    {t("addCategory")}
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
                    {t("addItem")}
                  </Button>
                </div>
              }
            />
          ) : (
            <CardGrid data-testid="items-category-grid">
              <ItemsCategoryCard
                summary={allTypesSummary}
                title={t("allCategories")}
                onOpen={() => openCategory(ALL_CATEGORIES_ID)}
              />
              {categorySummaries.map((summary) => (
                <ItemsCategoryCard
                  key={summary.id}
                  summary={summary}
                  onOpen={() => openCategory(summary.id)}
                />
              ))}
            </CardGrid>
          )}
        </>
      ) : null}

      {listLayer ? (
        <>
          <OpsControlBar
            ariaLabel={t("filterBarAria")}
            className="mb-md flex-wrap"
          >
            <FilterChip
              size="sm"
              active={false}
              onClick={() => navigate("/items")}
            >
              {t("allCategories")}
            </FilterChip>
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
                onClick={() => setFilter(key)}
              >
                {t(labelKey)}
              </FilterChip>
            ))}
            <TextField
              className="min-w-[160px] flex-1"
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t("searchPlaceholder")}
            />
          </OpsControlBar>

          {!loading && emptyKind !== "none" ? (
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
                  <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
                    {t("addItem")}
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
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
                        onOpen={() => setEditing(item)}
                        actions={
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                void updateItem(item.id, {
                                  status:
                                    item.status === "archived" ? "active" : "archived",
                                }).then(reload)
                              }
                            >
                              {item.status === "archived" ? t("unarchive") : t("archive")}
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => {
                                if (!window.confirm(t("deleteItemConfirm"))) return;
                                void deleteItem(item.id).then(reload);
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
          onChanged={reload}
        />
      ) : null}
    </AppPageShell>
  );
}
