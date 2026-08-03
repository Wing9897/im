import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog } from "../../components/ModalDialog";
import {
  AlertBanner,
  Button,
  FormActions,
  FormGrid,
  FormStack,
  SelectField,
  SettingsRow,
  TextField,
  captionClass,
} from "../../components/ui";
import type { ItemCategory, TrackableItem } from "../../api/items";
import type { Workset } from "../../types/worksets";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import {
  partitionItemAttributes as defaultPartition,
  resolveRemindOnCategoryChange as defaultResolveRemind,
  type AttributePartitions,
} from "../../domain/items/itemAttributes";
import { formatItemsError } from "../../domain/items/itemErrors";
import {
  ItemFormAttributesSection,
  ItemFormDatesSection,
  ItemFormNotesSection,
} from "./ItemFormSections";

type SaveDraft = {
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
};

type Props = {
  item: TrackableItem | null;
  categories: ItemCategory[];
  worksets: Workset[];
  categoryLabel: (
    category: ItemCategory | null | undefined,
    t: (key: string) => string,
  ) => string;
  /** Prefill category when creating from a type list layer. */
  initialCategoryId?: string | null;
  /** Prefill workset when creating from workset detail / deep-link. */
  initialWorksetId?: string | null;
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
  initialCategoryId = null,
  initialWorksetId = null,
  onClose,
  onSave,
  partitionItemAttributes = defaultPartition,
  resolveRemindOnCategoryChange = defaultResolveRemind,
}: Props) {
  const { t } = useTranslation("items");
  const [title, setTitle] = useState(item?.title ?? "");
  const [worksetId, setWorksetId] = useState(
    item?.worksetId || initialWorksetId || SYSTEM_WORKSET_ID,
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    item?.categoryId ?? initialCategoryId ?? null,
  );
  const [purchasedAt, setPurchasedAt] = useState(item?.purchasedAt ?? "");
  const [expiresAt, setExpiresAt] = useState(item?.expiresAt ?? "");
  const [remindBeforeDays, setRemindBeforeDays] = useState<number | null>(() => {
    if (item?.remindBeforeDays != null) return item.remindBeforeDays;
    const seedId = item?.categoryId ?? initialCategoryId;
    if (!seedId) return null;
    const seed = categories.find((c) => c.id === seedId);
    return seed?.defaultRemindBeforeDays ?? null;
  });
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [emoji, setEmoji] = useState(item?.emoji ?? "");
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

  const handleClose = () => {
    if (!saving) onClose();
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
        emoji: emoji.trim() || null,
        attributes,
        status: item?.status === "archived" ? "archived" : "active",
      });
    } catch (err) {
      setError(formatItemsError(err, t));
      setSaving(false);
    }
  };

  return (
    <ModalDialog
      open
      size="wide"
      title={item ? t("editItem") : t("addItem")}
      onClose={handleClose}
      bodyClassName="flex flex-col gap-lg"
      footer={
        <FormActions inline>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={() => void submit()}
            disabled={saving || !title.trim()}
          >
            {t("save")}
          </Button>
        </FormActions>
      }
    >
      <FormStack gap="lg">
        <SettingsRow label={t("titleField")} htmlFor="item-title">
          <TextField
            id="item-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
            autoFocus
          />
        </SettingsRow>

        <SettingsRow label={t("emoji")} htmlFor="item-emoji">
          <div className="flex flex-col gap-xs">
            <TextField
              id="item-emoji"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              disabled={saving}
              maxLength={16}
              placeholder={category?.emoji ?? undefined}
            />
            <p className={`m-0 ${captionClass}`}>{t("emojiHint")}</p>
          </div>
        </SettingsRow>

        <FormGrid>
          <SettingsRow label={t("workset")} htmlFor="item-workset">
            <SelectField
              id="item-workset"
              value={worksetId}
              onChange={(e) => setWorksetId(e.target.value)}
              disabled={saving}
            >
              {worksets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </SelectField>
          </SettingsRow>
          <SettingsRow label={t("category")} htmlFor="item-category">
            <SelectField
              id="item-category"
              value={categoryId ?? ""}
              onChange={(e) => onCategoryChange(e.target.value)}
              disabled={saving}
            >
              <option value="">{t("noCategory")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji?.trim() ? `${c.emoji.trim()} ` : ""}
                  {categoryLabel(c, t)}
                </option>
              ))}
            </SelectField>
          </SettingsRow>
        </FormGrid>

        <ItemFormDatesSection
          purchasedAt={purchasedAt}
          expiresAt={expiresAt}
          remindBeforeDays={remindBeforeDays}
          saving={saving}
          onPurchasedAtChange={setPurchasedAt}
          onExpiresAtChange={setExpiresAt}
          onRemindBeforeDaysChange={setRemindBeforeDays}
        />

        <ItemFormAttributesSection
          partitions={partitions}
          extraKey={extraKey}
          extraValue={extraValue}
          saving={saving}
          onAttrChange={setAttr}
          onExtraKeyChange={setExtraKey}
          onExtraValueChange={setExtraValue}
          onAddExtra={() => {
            const key = extraKey.trim();
            if (!key) return;
            setAttr(key, extraValue);
            setExtraKey("");
            setExtraValue("");
          }}
        />

        <ItemFormNotesSection notes={notes} saving={saving} onNotesChange={setNotes} />

        {error ? (
          <AlertBanner variant="error" role="alert" className="mb-0">
            {error}
          </AlertBanner>
        ) : null}
      </FormStack>
    </ModalDialog>
  );
}
