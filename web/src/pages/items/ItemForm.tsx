import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  UserEventDialog,
  type UserEventFormValues,
} from "../../components/calendar/UserEventDialog";
import {
  AlertBanner,
  FormGrid,
  FormStack,
  SelectField,
  SettingsRow,
  TextField,
} from "../../components/ui";
import { EmojiPickerField } from "./EmojiPickerField";
import { createUserEvent, updateUserEvent, type UserEvent } from "../../api/userEvents";
import type { ItemCategory, TrackableItem } from "../../api/items";
import { useToast } from "../../context/ToastContext";
import { createRecurringTimelineEvent } from "../../domain/timeline/createRecurringTimelineEvent";
import {
  buildLinkedCalendarCreateInitial,
  buildLinkedCalendarEditInitial,
  linkedCalendarQuickLabelKey,
  type LinkedCalendarFormInitial,
  type LinkedCalendarQuickKind,
} from "../../domain/items/linkedCalendarQuickCreate";
import { parseRemindBeforeDays } from "../../domain/timeline/parseRemindBeforeDays";
import { toUserEventFormWorksetId } from "../../domain/timeline/userEvents";
import type { Workset } from "../../types/worksets";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import {
  partitionItemAttributes as defaultPartition,
  type AttributePartitions,
} from "../../domain/items/itemAttributes";
import { formatItemsError } from "../../domain/items/itemErrors";
import { ItemFormLinkedCalendarsSection } from "./ItemFormLinkedCalendarsSection";
import {
  ItemFormAttributesSection,
  ItemFormNotesSection,
} from "./ItemFormSections";

function linkedOneOffWriteParams(
  values: UserEventFormValues,
  itemId: string,
  worksetId: string,
  remindBeforeDays: number | null,
) {
  return {
    title: values.title,
    startTime: values.startTime,
    endTime: values.endTime || null,
    body: values.body,
    location: values.location,
    isAllDay: values.isAllDay,
    remindBeforeDays,
    itemId,
    worksetId,
  };
}

export type ItemSaveDraft = {
  id?: string;
  title: string;
  worksetId: string;
  categoryId: string | null;
  notes: string;
  emoji: string | null;
  attributes: Record<string, string>;
  status: "active" | "archived";
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
  onSave: (draft: ItemSaveDraft) => Promise<void>;
  onToolbarStateChange?: (state: { canSubmit: boolean; busy: boolean }) => void;
  partitionItemAttributes?: typeof defaultPartition;
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
    partitionItemAttributes = defaultPartition,
  },
  ref,
) {
  const { t } = useTranslation("items");
  const { t: tt } = useTranslation("timeline");
  const { showToast } = useToast();
  const [title, setTitle] = useState(item?.title ?? "");
  const [worksetId, setWorksetId] = useState(
    item?.worksetId || initialWorksetId || SYSTEM_WORKSET_ID,
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    item?.categoryId ?? initialCategoryId ?? null,
  );
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [emoji, setEmoji] = useState(item?.emoji ?? "");
  const [attributes, setAttributes] = useState<Record<string, string>>(item?.attributes ?? {});
  const [extraKey, setExtraKey] = useState("");
  const [extraValue, setExtraValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [linkedCalendarOpen, setLinkedCalendarOpen] = useState(false);
  const [linkedCalendarMode, setLinkedCalendarMode] = useState<"create" | "edit">("create");
  const [linkedCalendarBusy, setLinkedCalendarBusy] = useState(false);
  const [linkedCalendarError, setLinkedCalendarError] = useState<string | null>(null);
  const [linkedCalendarRefreshKey, setLinkedCalendarRefreshKey] = useState(0);
  const [linkedCalendarInitial, setLinkedCalendarInitial] =
    useState<LinkedCalendarFormInitial | null>(null);
  const [editingLinkedEvent, setEditingLinkedEvent] = useState<UserEvent | null>(null);

  const clearLinkedCalendarDialog = () => {
    setLinkedCalendarOpen(false);
    setLinkedCalendarInitial(null);
    setEditingLinkedEvent(null);
    setLinkedCalendarError(null);
  };

  const category = categoryId ? categories.find((c) => c.id === categoryId) : undefined;
  const partitions: AttributePartitions = useMemo(
    () => partitionItemAttributes(attributes, category?.fieldSchema),
    [attributes, category?.fieldSchema, partitionItemAttributes],
  );

  const worksetOptions = useMemo(
    () => worksets.map((w) => ({ id: w.id, name: w.name })),
    [worksets],
  );

  const busy = saving || linkedCalendarBusy;
  const canSubmit = Boolean(title.trim()) && !busy;

  const setAttr = (key: string, value: string) => {
    setAttributes((prev) => {
      const next = { ...prev };
      if (!value) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  const onCategoryChange = (nextId: string) => {
    setCategoryId(nextId || null);
  };

  const buildDraft = (): ItemSaveDraft => ({
    id: item?.id,
    title: title.trim(),
    worksetId,
    categoryId,
    notes,
    emoji: emoji.trim() || null,
    attributes,
    status: item?.status === "archived" ? "archived" : "active",
  });

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
  }, [busy, onSave, t, title, worksetId, categoryId, notes, emoji, attributes, item?.id, item?.status]);

  useImperativeHandle(ref, () => ({ submit, canSubmit, busy }), [canSubmit, busy, submit]);

  useEffect(() => {
    onToolbarStateChange?.({ canSubmit, busy });
  }, [canSubmit, busy, onToolbarStateChange]);

  const openLinkedCalendarCreate = (kind?: LinkedCalendarQuickKind) => {
    if (!item || busy) return;
    setLinkedCalendarMode("create");
    setEditingLinkedEvent(null);
    setLinkedCalendarInitial(
      buildLinkedCalendarCreateInitial({
        itemId: item.id,
        worksetId: item.worksetId || worksetId,
        title: kind ? t(linkedCalendarQuickLabelKey(kind)) : "",
        kind: kind ?? null,
      }),
    );
    setLinkedCalendarError(null);
    setLinkedCalendarOpen(true);
  };

  const openLinkedCalendarEdit = (event: UserEvent) => {
    if (!item || busy) return;
    setLinkedCalendarMode("edit");
    setEditingLinkedEvent(event);
    setLinkedCalendarInitial(
      buildLinkedCalendarEditInitial({
        event,
        itemId: item.id,
        fallbackWorksetId: item.worksetId || worksetId,
      }),
    );
    setLinkedCalendarError(null);
    setLinkedCalendarOpen(true);
  };

  const closeLinkedCalendarDialog = () => {
    if (linkedCalendarBusy) return;
    clearLinkedCalendarDialog();
  };

  const submitLinkedCalendar = async (values: UserEventFormValues) => {
    if (!item) return;
    setLinkedCalendarBusy(true);
    setLinkedCalendarError(null);
    try {
      const lockedItemId = item.id;
      const ownedWorksetId = toUserEventFormWorksetId(
        values.worksetId || item.worksetId || worksetId,
      );
      let remind: number | null = null;
      try {
        remind = parseRemindBeforeDays(values.remindBeforeDays);
      } catch {
        setLinkedCalendarError(tt("userEvent.errors.remindInvalid"));
        return;
      }
      if (linkedCalendarMode === "edit" && editingLinkedEvent) {
        await updateUserEvent(
          editingLinkedEvent.id,
          linkedOneOffWriteParams(values, lockedItemId, ownedWorksetId, remind),
        );
        showToast(t("linkedCalendarUpdated"), "success");
      } else if (values.kind === "recurring") {
        await createRecurringTimelineEvent({
          title: values.title,
          worksetId: ownedWorksetId,
          isAllDay: values.isAllDay,
          eventStartTime: values.eventStartTime,
          eventEndTime: values.eventEndTime,
          location: values.location,
          body: values.body,
          rrule: values.rrule,
          itemId: lockedItemId,
        });
        showToast(tt("messages.recurringCreated"), "success");
      } else {
        await createUserEvent(
          linkedOneOffWriteParams(values, lockedItemId, ownedWorksetId, remind),
        );
        showToast(t("linkedCalendarCreated"), "success");
      }
      clearLinkedCalendarDialog();
      setLinkedCalendarRefreshKey((n) => n + 1);
    } catch (err) {
      setLinkedCalendarError(
        err instanceof Error ? err.message : tt("messages.saveFailed"),
      );
    } finally {
      setLinkedCalendarBusy(false);
    }
  };

  return (
    <>
      <FormStack gap="md" data-testid="item-form">
        <SettingsRow dense label={t("titleField")} htmlFor="item-title">
          <TextField
            id="item-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
            autoFocus
          />
        </SettingsRow>

        <SettingsRow dense label={t("emoji")} htmlFor="item-emoji">
          <EmojiPickerField
            id="item-emoji"
            value={emoji}
            onChange={setEmoji}
            disabled={busy}
            placeholder={category?.emoji ?? undefined}
          />
        </SettingsRow>

        <FormGrid>
          <SettingsRow dense label={t("workset")} htmlFor="item-workset">
            <SelectField
              id="item-workset"
              value={worksetId}
              onChange={(e) => setWorksetId(e.target.value)}
              disabled={busy}
            >
              {worksets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </SelectField>
          </SettingsRow>
          <SettingsRow dense label={t("category")} htmlFor="item-category">
            <SelectField
              id="item-category"
              value={categoryId ?? ""}
              onChange={(e) => onCategoryChange(e.target.value)}
              disabled={busy}
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

        {item ? (
          <ItemFormLinkedCalendarsSection
            itemId={item.id}
            refreshKey={linkedCalendarRefreshKey}
            disabled={busy}
            onAdd={() => openLinkedCalendarCreate()}
            onQuickAdd={openLinkedCalendarCreate}
            onEditOneOff={openLinkedCalendarEdit}
          />
        ) : null}

        <ItemFormAttributesSection
          partitions={partitions}
          extraKey={extraKey}
          extraValue={extraValue}
          saving={busy}
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

        <ItemFormNotesSection notes={notes} saving={busy} onNotesChange={setNotes} />

        {error ? (
          <AlertBanner variant="error" role="alert" className="mb-0">
            {error}
          </AlertBanner>
        ) : null}
      </FormStack>

      <UserEventDialog
        open={linkedCalendarOpen}
        mode={linkedCalendarMode}
        worksetOptions={worksetOptions}
        initial={linkedCalendarInitial}
        parentItemMode="readonly"
        busy={linkedCalendarBusy}
        error={linkedCalendarError}
        onClose={closeLinkedCalendarDialog}
        onSubmit={(values) => void submitLinkedCalendar(values)}
      />
    </>
  );
});
