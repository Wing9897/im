import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ItemCategory, TrackableItem } from "../../api/items";
import type { Workset } from "../../types/worksets";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import {
  partitionItemAttributes as defaultPartition,
  resolveRemindOnCategoryChange as defaultResolveRemind,
  type AttributePartitions,
} from "../../domain/items/itemAttributes";
import { formatItemsError } from "../../domain/items/itemErrors";

type SaveDraft = {
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
};

type Props = {
  item: TrackableItem | null;
  categories: ItemCategory[];
  worksets: Workset[];
  categoryLabel: (
    category: ItemCategory | undefined,
    t: (key: string) => string,
  ) => string;
  onClose: () => void;
  onSave: (draft: SaveDraft) => Promise<void>;
  partitionItemAttributes?: typeof defaultPartition;
  resolveRemindOnCategoryChange?: typeof defaultResolveRemind;
};

export function ItemFormDialog({
  item,
  categories,
  worksets,
  categoryLabel,
  onClose,
  onSave,
  partitionItemAttributes = defaultPartition,
  resolveRemindOnCategoryChange = defaultResolveRemind,
}: Props) {
  const { t } = useTranslation("items");
  const [title, setTitle] = useState(item?.title ?? "");
  const [worksetId, setWorksetId] = useState(item?.worksetId || SYSTEM_WORKSET_ID);
  const [categoryId, setCategoryId] = useState<string | null>(item?.categoryId ?? null);
  const [purchasedAt, setPurchasedAt] = useState(item?.purchasedAt ?? "");
  const [expiresAt, setExpiresAt] = useState(item?.expiresAt ?? "");
  const [remindBeforeDays, setRemindBeforeDays] = useState<number | null>(
    item?.remindBeforeDays ?? null,
  );
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [attributes, setAttributes] = useState<Record<string, string>>(item?.attributes ?? {});
  const [extraKey, setExtraKey] = useState("");
  const [extraValue, setExtraValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const category = categoryId ? categories.find((c) => c.id === categoryId) : undefined;
  const partitions: AttributePartitions = useMemo(
    () => partitionItemAttributes(attributes, category?.fieldSchema),
    [attributes, category?.fieldSchema, partitionItemAttributes],
  );

  const setAttr = (key: string, value: string) => {
    setAttributes((prev) => {
      const next = { ...prev };
      if (!value) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  const onCategoryChange = (nextId: string) => {
    const id = nextId || null;
    setCategoryId(id);
    const nextCat = id ? categories.find((c) => c.id === id) : undefined;
    setRemindBeforeDays(
      resolveRemindOnCategoryChange({
        currentRemind: remindBeforeDays,
        categoryDefault: nextCat?.defaultRemindBeforeDays ?? null,
      }),
    );
  };

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        id: item?.id,
        title: title.trim(),
        worksetId,
        categoryId,
        purchasedAt: purchasedAt || null,
        expiresAt: expiresAt || null,
        remindBeforeDays,
        notes,
        attributes,
        status: item?.status ?? "active",
      });
    } catch (err) {
      setError(formatItemsError(err, t));
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || saving) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-lg">
        <h2 className="m-0 mb-3 text-[15px] font-semibold text-text-primary">
          {item ? t("editItem") : t("addItem")}
        </h2>

        <label className="mb-2 block text-[11px] text-text-muted">
          {t("titleField")}
          <input
            className="mt-1 w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-[13px] text-text-primary"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <div className="mb-2 grid grid-cols-2 gap-2">
          <label className="block text-[11px] text-text-muted">
            {t("workset")}
            <select
              className="mt-1 w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-[13px]"
              value={worksetId}
              onChange={(e) => setWorksetId(e.target.value)}
            >
              {worksets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[11px] text-text-muted">
            {t("category")}
            <select
              className="mt-1 w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-[13px]"
              value={categoryId ?? ""}
              onChange={(e) => onCategoryChange(e.target.value)}
            >
              <option value="">{t("noCategory")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryLabel(c, t)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mb-2 grid grid-cols-2 gap-2">
          <label className="block text-[11px] text-text-muted">
            {t("purchasedAt")}
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-[13px]"
              value={purchasedAt}
              onChange={(e) => setPurchasedAt(e.target.value)}
            />
          </label>
          <label className="block text-[11px] text-text-muted">
            {t("expiresAt")}
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-[13px]"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </label>
        </div>

        <label className="mb-2 block text-[11px] text-text-muted">
          {t("remindBeforeDays")}
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-[13px]"
            value={remindBeforeDays ?? ""}
            onChange={(e) =>
              setRemindBeforeDays(e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </label>

        {partitions.suggested.length > 0 ? (
          <fieldset className="mb-2 rounded-md border border-border p-2">
            <legend className="px-1 text-[11px] text-text-muted">{t("attributesSuggested")}</legend>
            {partitions.suggested.map((field) => (
              <label key={field.key} className="mb-1 block text-[11px] text-text-muted">
                {field.label}
                <input
                  className="mt-1 w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-[13px]"
                  value={field.value}
                  onChange={(e) => setAttr(field.key, e.target.value)}
                />
              </label>
            ))}
          </fieldset>
        ) : null}

        {partitions.other.length > 0 ? (
          <fieldset className="mb-2 rounded-md border border-border p-2">
            <legend className="px-1 text-[11px] text-text-muted">{t("attributesOther")}</legend>
            {partitions.other.map((field) => (
              <label key={field.key} className="mb-1 block text-[11px] text-text-muted">
                {field.key}
                <input
                  className="mt-1 w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-[13px]"
                  value={field.value}
                  onChange={(e) => setAttr(field.key, e.target.value)}
                />
              </label>
            ))}
          </fieldset>
        ) : null}

        <div className="mb-2 flex gap-2">
          <input
            className="flex-1 rounded-md border border-border bg-transparent px-2 py-1.5 text-[12px]"
            placeholder={t("attributeKey")}
            value={extraKey}
            onChange={(e) => setExtraKey(e.target.value)}
          />
          <input
            className="flex-1 rounded-md border border-border bg-transparent px-2 py-1.5 text-[12px]"
            placeholder={t("attributeValue")}
            value={extraValue}
            onChange={(e) => setExtraValue(e.target.value)}
          />
          <button
            type="button"
            className="rounded-md border border-border px-2 text-[11px]"
            onClick={() => {
              const key = extraKey.trim();
              if (!key) return;
              setAttr(key, extraValue);
              setExtraKey("");
              setExtraValue("");
            }}
          >
            {t("addAttribute")}
          </button>
        </div>

        <label className="mb-3 block text-[11px] text-text-muted">
          {t("notes")}
          <textarea
            className="mt-1 w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-[13px]"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        {error ? (
          <p className="mb-2 text-[12px] text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-[12px]"
            onClick={onClose}
            disabled={saving}
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white"
            onClick={() => void submit()}
            disabled={saving || !title.trim()}
          >
            {t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
