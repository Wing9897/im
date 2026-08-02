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
import { CATEGORY_COLOR_PRESETS } from "../../domain/items/categoryAggregates";
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
  const [color, setColor] = useState<string | null>(null);
  const [emoji, setEmoji] = useState("");
  const [defaultRemind, setDefaultRemind] = useState<number | null>(null);
  const [schema, setSchema] = useState<ItemFieldSchemaEntry[]>([]);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const startEdit = (cat: ItemCategory) => {
    setEditingId(cat.id);
    setName(cat.name);
    setColor(cat.color ?? null);
    setEmoji(cat.emoji ?? "");
    setDefaultRemind(cat.defaultRemindBeforeDays ?? null);
    setSchema([...(cat.fieldSchema ?? [])]);
    setError(null);
  };

  const startCreate = () => {
    setEditingId("new");
    setName("");
    setColor(CATEGORY_COLOR_PRESETS[0]);
    setEmoji("");
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
      const emojiValue = emoji.trim() || null;
      if (editingId === "new") {
        await createItemCategory({
          name: name.trim(),
          color,
          emoji: emojiValue,
          fieldSchema: schema,
          defaultRemindBeforeDays: defaultRemind,
          sortOrder: 0,
        });
      } else if (editingId) {
        await updateItemCategory(editingId, {
          name: name.trim(),
          color,
          emoji: emojiValue,
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
              className="flex min-w-0 flex-1 items-center gap-sm border-none bg-transparent p-0 text-left text-body text-text-primary hover:text-accent"
              onClick={() => startEdit(cat)}
              disabled={busy}
            >
              {cat.emoji?.trim() ? (
                <span className="shrink-0 text-body" aria-hidden>
                  {cat.emoji.trim()}
                </span>
              ) : (
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full border border-surface-border"
                  style={{ backgroundColor: cat.color?.trim() || "var(--text-muted)" }}
                  aria-hidden
                />
              )}
              <span className="truncate">
                {cat.slug ? t(`seed.${cat.slug}`, { defaultValue: cat.name }) : cat.name}
              </span>
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
            <SettingsRow label={t("emoji")} htmlFor="cat-emoji">
              <div className="flex flex-col gap-xs">
                <TextField
                  id="cat-emoji"
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  disabled={busy}
                  maxLength={16}
                />
                <p className={`m-0 ${captionClass}`}>{t("emojiHint")}</p>
              </div>
            </SettingsRow>
            <SettingsRow label={t("categoryColor")} htmlFor="cat-color">
              <div className="flex flex-col gap-xs">
                <div className="flex flex-wrap gap-xs" role="listbox" aria-label={t("categoryColor")}>
                  {CATEGORY_COLOR_PRESETS.map((preset) => {
                    const selected = (color ?? "").toUpperCase() === preset.toUpperCase();
                    return (
                      <button
                        key={preset}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        disabled={busy}
                        className={[
                          "h-7 w-7 rounded-full border-2",
                          selected ? "border-accent" : "border-transparent",
                        ].join(" ")}
                        style={{ backgroundColor: preset }}
                        onClick={() => setColor(preset)}
                        aria-label={preset}
                      />
                    );
                  })}
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-md border border-surface-border px-xs text-caption text-text-secondary"
                    onClick={() => setColor(null)}
                  >
                    {t("categoryColorClear")}
                  </button>
                </div>
                <TextField
                  id="cat-color"
                  placeholder="#3B82F6"
                  value={color ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setColor(v || null);
                  }}
                  disabled={busy}
                  aria-label={t("categoryColorCustom")}
                />
              </div>
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
