import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { ModalDialog } from "../../components/ModalDialog";
import {
  AlertBanner,
  Button,
  FormActions,
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
import { resolveCategoryEmoji } from "../../domain/items/itemCalendarProjection";
import { formatItemsError } from "../../domain/items/itemErrors";
import { CategoryEditForm } from "./CategoryEditForm";
import { ItemEmojiMark } from "./ItemEmojiMark";

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
      bodyClassName="flex flex-col gap-sm"
      footer={
        <FormActions inline>
          <Button variant="secondary" size="sm" onClick={handleClose} disabled={busy}>
            {t("done")}
          </Button>
        </FormActions>
      }
    >
      <div className="mb-xs flex items-center justify-between gap-sm">
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
            className="flex items-center justify-between gap-sm rounded-md border border-surface-border/60 px-sm py-0.5"
          >
            <button
              type="button"
            className="flex min-w-0 flex-1 items-center gap-xs border-none bg-transparent p-0 text-left text-caption font-medium text-text-primary hover:text-accent"
              onClick={() => startEdit(cat)}
              disabled={busy}
            >
              <ItemEmojiMark
                emoji={resolveCategoryEmoji(cat)}
                backgroundColor={cat.color}
              />
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
        <CategoryEditForm
          name={name}
          emoji={emoji}
          color={color}
          defaultRemind={defaultRemind}
          schema={schema}
          newKey={newKey}
          newLabel={newLabel}
          error={error}
          busy={busy}
          onNameChange={setName}
          onEmojiChange={setEmoji}
          onColorChange={setColor}
          onDefaultRemindChange={setDefaultRemind}
          onSchemaChange={setSchema}
          onNewKeyChange={setNewKey}
          onNewLabelChange={setNewLabel}
          onCancel={() => setEditingId(null)}
          onSave={() => void save()}
        />
      ) : error ? (
        <AlertBanner variant="error" role="alert" className="mb-0">
          {error}
        </AlertBanner>
      ) : null}
    </ModalDialog>
  );
}
