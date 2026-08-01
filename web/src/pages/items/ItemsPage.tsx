import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Package } from "lucide-react";
import { AppPageShell } from "../../components/ui";
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-border px-2.5 py-1.5 text-[12px] text-text-secondary hover:text-text-primary"
            onClick={() => setManageCategories(true)}
          >
            {t("manageCategories")}
          </button>
          <button
            type="button"
            className="rounded-md bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white"
            onClick={() => setEditing("new")}
          >
            {t("addItem")}
          </button>
        </div>
      }
    >
      <div className="mb-4 flex items-start gap-3">
        <Package className="mt-0.5 shrink-0 text-accent" size={20} aria-hidden />
        <div>
          <h1 className="m-0 text-[18px] font-semibold text-text-primary">{t("title")}</h1>
          <p className="m-0 mt-1 text-[12px] text-text-muted">{t("subtitle")}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ["all", "filterAll"],
            ["expiring", "filterExpiring"],
            ["overdue", "filterOverdue"],
            ["archived", "filterArchived"],
          ] as const
        ).map(([key, labelKey]) => (
          <button
            key={key}
            type="button"
            className={[
              "rounded-md border px-2.5 py-1 text-[12px]",
              filter === key
                ? "border-accent bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-text-primary"
                : "border-border text-text-secondary",
            ].join(" ")}
            onClick={() => setFilter(key)}
          >
            {t(labelKey)}
          </button>
        ))}
        <input
          className="min-w-[200px] flex-1 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-[12px] text-text-primary"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error ? (
        <p className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="text-[13px] text-text-muted">…</p> : null}

      {!loading && emptyKind !== "none" ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
          <p className="m-0 text-[14px] text-text-secondary">
            {emptyKind === "true-empty" ? t("empty") : t("emptyFiltered")}
          </p>
          <p className="m-0 mt-2 text-[12px] text-text-muted">
            {emptyKind === "true-empty" ? t("emptyHint") : t("emptyFilteredHint")}
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        {grouped.map(({ worksetId, rows }) => (
          <section key={worksetId}>
            <h2 className="mb-2 text-[13px] font-semibold text-text-primary">
              {worksetById.get(worksetId)?.name || worksetId}
            </h2>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {rows.map((item) => {
                const days = daysUntil(item.expiresAt);
                const tone = expiryTone(days, item.remindBeforeDays);
                const cat = item.categoryId ? categoryById.get(item.categoryId) : undefined;
                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 border-none bg-transparent p-0 text-left"
                      onClick={() => setEditing(item)}
                    >
                      <div className="truncate text-[13px] font-medium text-text-primary">
                        {item.title}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-text-muted">
                        <span>{categoryLabel(cat, t)}</span>
                        {item.expiresAt ? <span>{item.expiresAt}</span> : <span>{t("noExpiry")}</span>}
                        {days != null ? (
                          <span
                            className={
                              tone === "overdue"
                                ? "text-danger"
                                : tone === "soon"
                                  ? "text-warning"
                                  : "text-text-secondary"
                            }
                          >
                            {days < 0
                              ? t("daysOverdue", { count: Math.abs(days) })
                              : t("daysLeft", { count: days })}
                          </span>
                        ) : null}
                      </div>
                    </button>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="rounded border border-border px-2 py-1 text-[11px] text-text-secondary"
                        onClick={() =>
                          void updateItem(item.id, {
                            status: item.status === "archived" ? "active" : "archived",
                          }).then(reload)
                        }
                      >
                        {item.status === "archived" ? t("unarchive") : t("archive")}
                      </button>
                      <button
                        type="button"
                        className="rounded border border-border px-2 py-1 text-[11px] text-danger"
                        onClick={() => {
                          if (!window.confirm(t("deleteItemConfirm"))) return;
                          void deleteItem(item.id).then(reload);
                        }}
                      >
                        {t("deleteItem")}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
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
