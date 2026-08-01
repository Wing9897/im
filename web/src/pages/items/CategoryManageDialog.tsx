import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createItemCategory,
  deleteItemCategory,
  updateItemCategory,
  type ItemCategory,
  type ItemFieldSchemaEntry,
} from "../../api/items";
import { formatItemsError } from "../../domain/items/itemErrors";

type Props = {
  categories: ItemCategory[];
  onClose: () => void;
  onChanged: () => Promise<void>;
};

export function CategoryManageDialog({ categories, onClose, onChanged }: Props) {
  const { t } = useTranslation("items");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [defaultRemind, setDefaultRemind] = useState<number | null>(null);
  const [schema, setSchema] = useState<ItemFieldSchemaEntry[]>([]);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const startEdit = (cat: ItemCategory) => {
    setEditingId(cat.id);
    setName(cat.name);
    setDefaultRemind(cat.defaultRemindBeforeDays ?? null);
    setSchema([...(cat.fieldSchema ?? [])]);
    setError(null);
  };

  const startCreate = () => {
    setEditingId("new");
    setName("");
    setDefaultRemind(null);
    setSchema([]);
    setError(null);
  };

  const save = async () => {
    if (!name.trim() || busy) return;
    setError(null);
    setBusy(true);
    try {
      if (editingId === "new") {
        await createItemCategory({
          name: name.trim(),
          fieldSchema: schema,
          defaultRemindBeforeDays: defaultRemind,
        });
      } else if (editingId) {
        await updateItemCategory(editingId, {
          name: name.trim(),
          fieldSchema: schema,
          defaultRemindBeforeDays: defaultRemind,
        });
      }
      setEditingId(null);
      await onChanged();
    } catch (err) {
      setError(formatItemsError(err, t));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = (cat: ItemCategory) => {
    const label = cat.slug
      ? t(`seed.${cat.slug}`, { defaultValue: cat.name })
      : cat.name;
    const message = cat.slug
      ? t("deleteSeedCategoryConfirm", { name: label })
      : t("deleteCategoryConfirm");
    if (!window.confirm(message)) return;
    setBusy(true);
    void deleteItemCategory(cat.id)
      .then(onChanged)
      .catch((err) => setError(formatItemsError(err, t)))
      .finally(() => setBusy(false));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busy) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="m-0 text-[15px] font-semibold text-text-primary">
            {t("manageCategories")}
          </h2>
          <button
            type="button"
            className="rounded-md border border-border px-2 py-1 text-[11px]"
            onClick={startCreate}
          >
            +
          </button>
        </div>

        <ul className="m-0 mb-3 list-none space-y-1 p-0">
          {categories.map((cat) => (
            <li
              key={cat.id}
              className="flex items-center justify-between rounded border border-border px-2 py-1.5 text-[12px]"
            >
              <button
                type="button"
                className="border-none bg-transparent p-0 text-left text-text-primary"
                onClick={() => startEdit(cat)}
              >
                {cat.slug ? t(`seed.${cat.slug}`, { defaultValue: cat.name }) : cat.name}
              </button>
              <button
                type="button"
                className="text-[11px] text-danger"
                disabled={busy}
                onClick={() => confirmDelete(cat)}
              >
                {t("deleteCategory")}
              </button>
            </li>
          ))}
        </ul>

        {editingId ? (
          <div className="rounded-md border border-border p-3">
            <label className="mb-2 block text-[11px] text-text-muted">
              {t("categoryName")}
              <input
                className="mt-1 w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-[13px]"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="mb-2 block text-[11px] text-text-muted">
              {t("defaultRemind")}
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-[13px]"
                value={defaultRemind ?? ""}
                onChange={(e) =>
                  setDefaultRemind(e.target.value === "" ? null : Number(e.target.value))
                }
              />
            </label>
            <div className="mb-2 text-[11px] text-text-muted">{t("fieldSchema")}</div>
            {schema.map((entry, idx) => (
              <div key={`${entry.key}-${idx}`} className="mb-1 flex gap-1">
                <input
                  className="flex-1 rounded border border-border bg-transparent px-2 py-1 text-[12px]"
                  value={entry.key}
                  onChange={(e) => {
                    const next = [...schema];
                    next[idx] = { ...entry, key: e.target.value };
                    setSchema(next);
                  }}
                />
                <input
                  className="flex-1 rounded border border-border bg-transparent px-2 py-1 text-[12px]"
                  value={entry.label}
                  onChange={(e) => {
                    const next = [...schema];
                    next[idx] = { ...entry, label: e.target.value };
                    setSchema(next);
                  }}
                />
                <button
                  type="button"
                  className="px-1 text-[11px] text-danger"
                  onClick={() => setSchema(schema.filter((_, i) => i !== idx))}
                >
                  ×
                </button>
              </div>
            ))}
            <div className="mb-2 flex gap-1">
              <input
                className="flex-1 rounded border border-border bg-transparent px-2 py-1 text-[12px]"
                placeholder={t("attributeKey")}
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
              />
              <input
                className="flex-1 rounded border border-border bg-transparent px-2 py-1 text-[12px]"
                placeholder={t("attributeValue")}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
              <button
                type="button"
                className="rounded border border-border px-2 text-[11px]"
                onClick={() => {
                  const key = newKey.trim();
                  if (!key) return;
                  setSchema([...schema, { key, label: newLabel.trim() || key }]);
                  setNewKey("");
                  setNewLabel("");
                }}
              >
                {t("addSchemaField")}
              </button>
            </div>
            {error ? <p className="text-[12px] text-danger">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-border px-3 py-1 text-[12px]"
                onClick={() => setEditingId(null)}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                className="rounded bg-accent px-3 py-1 text-[12px] text-white"
                onClick={() => void save()}
              >
                {t("save")}
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-[12px]"
            onClick={onClose}
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
