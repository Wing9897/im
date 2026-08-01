import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { ModalDialog } from "../../components/ModalDialog";
import {
  AlertBanner,
  Button,
  FormActions,
  FormStack,
  SettingsRow,
  TextField,
  captionClass,
} from "../../components/ui";
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

  const handleClose = () => {
    if (!busy) onClose();
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

  return (
    <ModalDialog
      open
      size="wide"
      title={t("manageCategories")}
      onClose={handleClose}
      bodyClassName="flex flex-col gap-md"
      footer={
        <FormActions inline>
          <Button variant="secondary" onClick={handleClose} disabled={busy}>
            {t("done")}
          </Button>
        </FormActions>
      }
    >
      <div className="mb-sm flex items-center justify-between gap-sm">
        <p className={`m-0 ${captionClass}`}>{t("categoriesHint")}</p>
        <Button variant="secondary" size="sm" onClick={startCreate} disabled={busy}>
          <Plus size={14} aria-hidden />
          {t("addCategory")}
        </Button>
      </div>

      <ul className="m-0 flex list-none flex-col gap-xs p-0">
        {categories.map((cat) => (
          <li
            key={cat.id}
            className="flex items-center justify-between gap-sm rounded-lg border border-surface-border/70 px-sm py-xs"
          >
            <button
              type="button"
              className="min-w-0 flex-1 border-none bg-transparent p-0 text-left text-body text-text-primary hover:text-accent"
              onClick={() => startEdit(cat)}
              disabled={busy}
            >
              {cat.slug ? t(`seed.${cat.slug}`, { defaultValue: cat.name }) : cat.name}
            </button>
            <Button
              variant="danger"
              size="sm"
              disabled={busy}
              onClick={() => confirmDelete(cat)}
            >
              {t("deleteCategory")}
            </Button>
          </li>
        ))}
      </ul>

      {editingId ? (
        <div className="rounded-lg border border-surface-border/80 bg-[color-mix(in_srgb,var(--surface-raised)_40%,transparent)] p-md">
          <FormStack gap="lg">
            <SettingsRow label={t("categoryName")} htmlFor="cat-name">
              <TextField
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                autoFocus
              />
            </SettingsRow>
            <SettingsRow label={t("defaultRemind")} htmlFor="cat-remind">
              <TextField
                id="cat-remind"
                type="number"
                min={0}
                value={defaultRemind ?? ""}
                onChange={(e) =>
                  setDefaultRemind(e.target.value === "" ? null : Number(e.target.value))
                }
                disabled={busy}
              />
            </SettingsRow>

            <div className="flex flex-col gap-sm">
              <p className="m-0 text-caption font-medium text-text-primary">
                {t("fieldSchema")}
              </p>
              <p className={`m-0 ${captionClass}`}>{t("fieldSchemaHint")}</p>
              {schema.map((entry, idx) => (
                <div key={`${entry.key}-${idx}`} className="flex gap-xs">
                  <TextField
                    className="flex-1"
                    value={entry.key}
                    aria-label={t("attributeKey")}
                    onChange={(e) => {
                      const next = [...schema];
                      next[idx] = { ...entry, key: e.target.value };
                      setSchema(next);
                    }}
                    disabled={busy}
                  />
                  <TextField
                    className="flex-1"
                    value={entry.label}
                    aria-label={t("schemaFieldLabel")}
                    onChange={(e) => {
                      const next = [...schema];
                      next[idx] = { ...entry, label: e.target.value };
                      setSchema(next);
                    }}
                    disabled={busy}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setSchema(schema.filter((_, i) => i !== idx))}
                    aria-label={t("removeSchemaField")}
                  >
                    ×
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-xs">
                <TextField
                  className="min-w-[100px] flex-1"
                  placeholder={t("attributeKey")}
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  disabled={busy}
                />
                <TextField
                  className="min-w-[100px] flex-1"
                  placeholder={t("schemaFieldLabel")}
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  disabled={busy}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    const key = newKey.trim();
                    if (!key) return;
                    setSchema([...schema, { key, label: newLabel.trim() || key }]);
                    setNewKey("");
                    setNewLabel("");
                  }}
                >
                  {t("addSchemaField")}
                </Button>
              </div>
            </div>

            {error ? (
              <AlertBanner variant="error" role="alert" className="mb-0">
                {error}
              </AlertBanner>
            ) : null}

            <FormActions inline>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditingId(null)}
                disabled={busy}
              >
                {t("cancel")}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void save()}
                disabled={busy || !name.trim()}
              >
                {t("save")}
              </Button>
            </FormActions>
          </FormStack>
        </div>
      ) : error ? (
        <AlertBanner variant="error" role="alert" className="mb-0">
          {error}
        </AlertBanner>
      ) : null}
    </ModalDialog>
  );
}
