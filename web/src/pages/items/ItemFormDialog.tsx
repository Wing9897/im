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
  TextArea,
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

        <section
          className="flex flex-col gap-md rounded-lg border border-surface-border/70 bg-[color-mix(in_srgb,var(--surface-raised)_40%,transparent)] p-md"
          aria-label={t("sectionDates")}
        >
          <h3 className="m-0 text-caption font-semibold text-text-primary">
            {t("sectionDates")}
          </h3>
          <FormGrid>
            <SettingsRow label={t("purchasedAt")} htmlFor="item-purchased">
              <TextField
                id="item-purchased"
                type="date"
                value={purchasedAt}
                onChange={(e) => setPurchasedAt(e.target.value)}
                disabled={saving}
              />
            </SettingsRow>
            <SettingsRow label={t("expiresAt")} htmlFor="item-expires">
              <TextField
                id="item-expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                disabled={saving}
              />
            </SettingsRow>
          </FormGrid>
          <SettingsRow label={t("remindBeforeDays")} htmlFor="item-remind">
            <TextField
              id="item-remind"
              type="number"
              min={0}
              value={remindBeforeDays ?? ""}
              onChange={(e) =>
                setRemindBeforeDays(e.target.value === "" ? null : Number(e.target.value))
              }
              disabled={saving}
            />
          </SettingsRow>
        </section>

        {(partitions.suggested.length > 0 || partitions.other.length > 0) ? (
          <section
            className="flex flex-col gap-md rounded-lg border border-dashed border-surface-border/80 p-md"
            aria-label={t("sectionExtras")}
          >
            <div>
              <h3 className="m-0 text-caption font-semibold text-text-primary">
                {t("sectionExtras")}
              </h3>
              <p className={`${captionClass} mt-xs`}>{t("sectionExtrasHint")}</p>
            </div>

            {partitions.suggested.length > 0 ? (
              <div className="flex flex-col gap-md">
                <p className="m-0 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                  {t("attributesSuggested")}
                </p>
                {partitions.suggested.map((field) => (
                  <SettingsRow
                    key={field.key}
                    label={field.label}
                    htmlFor={`item-attr-${field.key}`}
                  >
                    <TextField
                      id={`item-attr-${field.key}`}
                      value={field.value}
                      onChange={(e) => setAttr(field.key, e.target.value)}
                      disabled={saving}
                    />
                  </SettingsRow>
                ))}
              </div>
            ) : null}

            {partitions.other.length > 0 ? (
              <div className="flex flex-col gap-md">
                <p className="m-0 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                  {t("attributesOther")}
                </p>
                {partitions.other.map((field) => (
                  <SettingsRow
                    key={field.key}
                    label={field.key}
                    htmlFor={`item-other-${field.key}`}
                  >
                    <TextField
                      id={`item-other-${field.key}`}
                      value={field.value}
                      onChange={(e) => setAttr(field.key, e.target.value)}
                      disabled={saving}
                    />
                  </SettingsRow>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="flex flex-wrap items-end gap-sm">
          <div className="min-w-[120px] flex-1">
            <SettingsRow label={t("attributeKey")} htmlFor="item-extra-key">
              <TextField
                id="item-extra-key"
                placeholder={t("attributeKey")}
                value={extraKey}
                onChange={(e) => setExtraKey(e.target.value)}
                disabled={saving}
              />
            </SettingsRow>
          </div>
          <div className="min-w-[120px] flex-1">
            <SettingsRow label={t("attributeValue")} htmlFor="item-extra-value">
              <TextField
                id="item-extra-value"
                placeholder={t("attributeValue")}
                value={extraValue}
                onChange={(e) => setExtraValue(e.target.value)}
                disabled={saving}
              />
            </SettingsRow>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="mb-0.5"
            disabled={saving}
            onClick={() => {
              const key = extraKey.trim();
              if (!key) return;
              setAttr(key, extraValue);
              setExtraKey("");
              setExtraValue("");
            }}
          >
            {t("addAttribute")}
          </Button>
        </div>

        <SettingsRow label={t("notes")} htmlFor="item-notes">
          <TextArea
            id="item-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={saving}
            className="min-h-[88px]"
          />
        </SettingsRow>

        {error ? (
          <AlertBanner variant="error" role="alert" className="mb-0">
            {error}
          </AlertBanner>
        ) : null}
      </FormStack>
    </ModalDialog>
  );
}
