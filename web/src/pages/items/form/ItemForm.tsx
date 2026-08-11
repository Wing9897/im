import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";
import { UserEventDialog } from "../../../components/calendar/UserEventDialog";
import { AlertBanner, FormStack } from "../../../components/ui";
import type { ItemCategory, TrackableItem } from "../../../api/items";
import { formatItemsError } from "../../../domain/items/itemErrors";
import type { Workset } from "../../../types/worksets";
import { SYSTEM_WORKSET_ID } from "../../../types/worksets";
import { ItemFormCvBelonging } from "./ItemFormCvBelonging";
import {
  quantityInputFromValue,
  wireQuantityFromInput,
} from "./ItemFormCvInventory";
import { ItemFormCvHeader } from "./ItemFormCvHeader";
import { ItemFormLinkedCalendarsSection } from "./ItemFormLinkedCalendarsSection";
import { ItemFormNotesSection } from "./ItemFormSections";
import { useItemFormLinkedCalendars } from "./useItemFormLinkedCalendars";

export type ItemSaveDraft = {
  id?: string;
  title: string;
  worksetId: string;
  categoryId: string | null;
  notes: string;
  emoji: string | null;
  quantity: number | null;
  unit: string | null;
  status: "active" | "archived";
};

export type ItemSaveOptions = {
  /** When false, persist the draft and stay on the form (e.g. before linked calendar). */
  leaveAfterSave?: boolean;
};

export type ItemFormHandle = {
  submit: () => Promise<void>;
  canSubmit: boolean;
  busy: boolean;
};

type Props = {
  item: TrackableItem | null;
  categories: ItemCategory[];
  worksets: Workset[];
  categoryLabel: (
    category: ItemCategory | null | undefined,
    t: (key: string) => string,
  ) => string;
  initialCategoryId?: string | null;
  initialWorksetId?: string | null;
  onSave: (draft: ItemSaveDraft, options?: ItemSaveOptions) => Promise<TrackableItem | void>;
  onToolbarStateChange?: (state: { canSubmit: boolean; busy: boolean }) => void;
};

export const ItemForm = forwardRef<ItemFormHandle, Props>(function ItemForm(
  {
    item,
    categories,
    worksets,
    categoryLabel,
    initialCategoryId = null,
    initialWorksetId = null,
    onSave,
    onToolbarStateChange,
  },
  ref,
) {
  const { t } = useTranslation("items");
  const [title, setTitle] = useState(item?.title ?? "");
  const [worksetId, setWorksetId] = useState(
    item?.worksetId || initialWorksetId || SYSTEM_WORKSET_ID,
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    item?.categoryId ?? initialCategoryId ?? null,
  );
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [emoji, setEmoji] = useState(item?.emoji ?? "");
  const [quantityInput, setQuantityInput] = useState(quantityInputFromValue(item?.quantity));
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set after create-mode auto-save before parent item prop catches up. */
  const [persistedItem, setPersistedItem] = useState<TrackableItem | null>(null);

  const effectiveItem = item ?? persistedItem;

  useEffect(() => {
    if (item) setPersistedItem(null);
  }, [item]);

  const category = categoryId ? categories.find((c) => c.id === categoryId) : undefined;

  const buildDraft = useCallback((): ItemSaveDraft => ({
    id: effectiveItem?.id,
    title: title.trim(),
    worksetId,
    categoryId,
    notes,
    emoji: emoji.trim() || null,
    quantity: wireQuantityFromInput(quantityInput),
    unit: unit.trim() || null,
    status: effectiveItem?.status === "archived" ? "archived" : "active",
  }), [
    effectiveItem,
    title,
    worksetId,
    categoryId,
    notes,
    emoji,
    quantityInput,
    unit,
  ]);

  const ensureSavedItem = useCallback(async (): Promise<TrackableItem | null> => {
    if (effectiveItem) return effectiveItem;
    if (!title.trim() || saving) return null;
    setSaving(true);
    setError(null);
    try {
      const saved = await onSave(buildDraft(), { leaveAfterSave: false });
      if (saved) setPersistedItem(saved);
      return saved ?? null;
    } catch (err) {
      setError(formatItemsError(err, t));
      return null;
    } finally {
      setSaving(false);
    }
  }, [effectiveItem, title, saving, onSave, t, buildDraft]);

  const linkedCalendarRemindHint =
    category?.defaultRemindBeforeDays != null && category.defaultRemindBeforeDays > 0
      ? t("linkedCalendarRemindPrefillDialogHint", { days: category.defaultRemindBeforeDays })
      : undefined;

  const linked = useItemFormLinkedCalendars({
    item: effectiveItem,
    worksetId,
    defaultRemindBeforeDays: category?.defaultRemindBeforeDays ?? null,
    formBusy: saving,
    ensureItem: ensureSavedItem,
  });

  const busy = saving || linked.linkedCalendarBusy;
  const canSubmit = Boolean(title.trim()) && !busy;
  const canAddLinkedCalendar = Boolean(effectiveItem?.id || title.trim());

  const onCategoryChange = (nextId: string) => {
    setCategoryId(nextId || null);
  };

  const submit = useCallback(async () => {
    if (!title.trim() || busy) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(buildDraft());
    } catch (err) {
      setError(formatItemsError(err, t));
      setSaving(false);
    }
  }, [busy, onSave, t, title, buildDraft]);

  useImperativeHandle(ref, () => ({ submit, canSubmit, busy }), [canSubmit, busy, submit]);

  useEffect(() => {
    onToolbarStateChange?.({ canSubmit, busy });
  }, [canSubmit, busy, onToolbarStateChange]);

  return (
    <>
      <FormStack gap="md" className="min-h-0 flex-1" data-testid="item-form">
        <div
          className="flex min-h-0 flex-1 flex-col rounded-xl border border-surface-border/80 bg-[color-mix(in_srgb,var(--surface-card)_72%,transparent)] shadow-sm"
          data-testid="item-form-cv"
        >
          <div className="px-md py-sm sm:px-lg sm:py-md">
            <ItemFormCvHeader
              title={title}
              emoji={emoji}
              categoryEmojiPlaceholder={category?.emoji}
              item={item}
              busy={busy}
              quantityInput={quantityInput}
              unit={unit}
              onTitleChange={setTitle}
              onEmojiChange={setEmoji}
              onQuantityInputChange={setQuantityInput}
              onUnitChange={setUnit}
            />
          </div>

          <div className="border-t border-surface-border/55 px-md py-sm sm:px-lg">
            <ItemFormCvBelonging
              worksetId={worksetId}
              categoryId={categoryId}
              categories={categories}
              worksets={worksets}
              categoryLabel={categoryLabel}
              busy={busy}
              onWorksetChange={setWorksetId}
              onCategoryChange={onCategoryChange}
            />
          </div>

          <div
            className="min-h-0 min-w-0 flex-1 border-t border-surface-border/55 px-md py-sm sm:px-lg sm:pb-md"
            data-testid="item-form-cv-body"
          >
            <ItemFormLinkedCalendarsSection
              itemId={effectiveItem?.id ?? null}
              refreshKey={linked.linkedCalendarRefreshKey}
              disabled={busy}
              canAdd={canAddLinkedCalendar}
              categoryDefaultRemindBeforeDays={category?.defaultRemindBeforeDays ?? null}
              onQuickAdd={(kind) => void linked.openLinkedCalendarCreate(kind)}
              onEditOneOff={(event) => {
                linked.openLinkedCalendarEdit(event);
              }}
              onDeleteOneOff={(event) => {
                void linked.deleteLinkedOneOff(event);
              }}
              onDeleteRecurring={(taskId, title) => {
                void linked.deleteLinkedRecurring(taskId, title);
              }}
              onActiveExpiryChange={linked.setActiveLinkedExpiry}
            />
          </div>

          <div className="border-t border-surface-border/55 px-md py-sm sm:px-lg sm:pb-md">
            <ItemFormNotesSection notes={notes} saving={busy} onNotesChange={setNotes} />
          </div>
        </div>

        {error ? (
          <AlertBanner variant="error" role="alert" className="mb-0">
            {error}
          </AlertBanner>
        ) : null}
      </FormStack>

      <UserEventDialog
        open={linked.linkedCalendarOpen}
        mode={linked.linkedCalendarMode}
        initial={linked.linkedCalendarInitial}
        parentItemMode="readonly"
        worksetMode="hidden"
        busy={linked.linkedCalendarBusy}
        error={linked.linkedCalendarError}
        remindBeforeDaysHint={
          linked.linkedCalendarMode === "create" ? linkedCalendarRemindHint : undefined
        }
        onClose={linked.closeLinkedCalendarDialog}
        onSubmit={(values) => void linked.submitLinkedCalendar(values)}
      />
    </>
  );
});
