import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Package } from "lucide-react";
import { EmptyState } from "../../components/common/EmptyState";
import {
  AlertBanner,
  AppPageShell,
  Badge,
  Button,
  FilterChip,
  OpsControlBar,
  PanelSection,
  TextField,
  captionClass,
  pageTitleClass,
  type BadgeTone,
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
  daysUntil,
  expiryTone,
  itemsEmptyKind,
  partitionItemAttributes,
  resolveRemindOnCategoryChange,
} from "../../domain/items/itemAttributes";
import { formatItemsError } from "../../domain/items/itemErrors";
import { ItemFormDialog } from "./ItemFormDialog";
import { CategoryManageDialog } from "./CategoryManageDialog";

type FilterKey = "all" | "expiring" | "overdue" | "archived";

function categoryLabel(
  category: ItemCategory | undefined,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (!category) return t("noCategory");
  if (category.slug) {
    const key = `seed.${category.slug}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return category.name;
}

function toneBadge(tone: ReturnType<typeof expiryTone>): BadgeTone {
  if (tone === "overdue") return "danger";
  if (tone === "soon") return "warning";
  if (tone === "ok") return "success";
  return "neutral";
}

function toneBorderClass(tone: ReturnType<typeof expiryTone>): string {
  if (tone === "overdue") return "border-l-error";
  if (tone === "soon") return "border-l-warning";
  if (tone === "ok") return "border-l-success";
  return "border-l-surface-border";
}

export function ItemsPage() {
  const { t } = useTranslation("items");
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<TrackableItem[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [worksets, setWorksets] = useState<Workset[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TrackableItem | null | "new">(null);
  const [manageCategories, setManageCategories] = useState(false);
  const deepLinkHandled = useRef<string | null>(null);

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

  // Deep-link from Timeline: /items?itemId=…&itemDateKind=purchased|expires
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
    setEditing(match);
    const next = new URLSearchParams(searchParams);
    next.delete("itemId");
    next.delete("itemDateKind");
    setSearchParams(next, { replace: true });
  }, [loading, items, searchParams, setSearchParams]);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const worksetById = useMemo(
    () => new Map(worksets.map((w) => [w.id, w])),
    [worksets],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((item) => {
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
  }, [items, filter, search]);

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
    totalCount: items.length,
    filteredCount: filtered.length,
  });

  const clearFilters = () => {
    setFilter("all");
    setSearch("");
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

  return (
    <AppPageShell
      width="fluid"
      actions={
        <div className="flex flex-wrap items-center gap-sm">
          <Button variant="secondary" size="sm" onClick={() => setManageCategories(true)}>
            {t("manageCategories")}
          </Button>
          <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
            {t("addItem")}
          </Button>
        </div>
      }
    >
      <div className="mb-md flex items-start gap-sm">
        <Package className="mt-0.5 shrink-0 text-accent" size={18} aria-hidden />
        <div className="min-w-0">
          <h1 className={pageTitleClass}>{t("title")}</h1>
          <p className={`${captionClass} mt-xs`}>{t("subtitle")}</p>
        </div>
      </div>

      <OpsControlBar
        ariaLabel={t("filterBarAria")}
        className="mb-md flex-wrap"
      >
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

      {error ? (
        <AlertBanner variant="error" role="alert">
          {error}
        </AlertBanner>
      ) : null}
      {loading ? <p className={captionClass}>…</p> : null}

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

      <div className="flex flex-col gap-md">
        {grouped.map(({ worksetId, rows }) => (
          <PanelSection
            key={worksetId}
            title={worksetById.get(worksetId)?.name || worksetId}
            showCount
            itemCount={rows.length}
          >
            <ul className="m-0 flex list-none flex-col gap-sm p-0">
              {rows.map((item) => {
                const days = daysUntil(item.expiresAt);
                const tone = expiryTone(days, item.remindBeforeDays);
                const cat = item.categoryId ? categoryById.get(item.categoryId) : undefined;
                return (
                  <li
                    key={item.id}
                    className={[
                      "flex flex-wrap items-center justify-between gap-sm rounded-lg border border-surface-border/70 border-l-[3px] bg-[color-mix(in_srgb,var(--surface-card)_40%,transparent)] px-sm py-xs",
                      toneBorderClass(tone),
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 border-none bg-transparent p-0 text-left"
                      onClick={() => setEditing(item)}
                    >
                      <div className="truncate text-body font-medium text-text-primary">
                        {item.title}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-xs">
                        <Badge
                          tone="neutral"
                          className="normal-case tracking-normal"
                        >
                          {categoryLabel(cat, t)}
                        </Badge>
                        <span className={captionClass}>
                          {item.expiresAt ? item.expiresAt : t("noExpiry")}
                        </span>
                        {days != null ? (
                          <Badge
                            tone={toneBadge(tone)}
                            className="normal-case tracking-normal"
                          >
                            {days < 0
                              ? t("daysOverdue", { count: Math.abs(days) })
                              : t("daysLeft", { count: days })}
                          </Badge>
                        ) : null}
                      </div>
                    </button>
                    <div className="flex shrink-0 gap-xs">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          void updateItem(item.id, {
                            status: item.status === "archived" ? "active" : "archived",
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
                    </div>
                  </li>
                );
              })}
            </ul>
          </PanelSection>
        ))}
      </div>

      {editing != null ? (
        <ItemFormDialog
          item={editing === "new" ? null : editing}
          categories={categories}
          worksets={worksets}
          categoryLabel={categoryLabel}
          onClose={() => setEditing(null)}
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
