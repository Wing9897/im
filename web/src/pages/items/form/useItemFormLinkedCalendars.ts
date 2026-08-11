import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { UserEventFormValues } from "../../../components/calendar/UserEventDialog";
import {
  createUserEvent,
  deleteUserEvent,
  updateUserEvent,
  type UserEvent,
} from "../../../api/userEvents";
import { deleteRecurringSeries } from "../../../api/recurringSeries";
import type { TrackableItem } from "../../../api/items";
import { useToast } from "../../../context/ToastContext";
import { createRecurringTimelineEvent } from "../../../domain/timeline/createRecurringTimelineEvent";
import {
  buildLinkedCalendarCreateInitial,
  buildLinkedCalendarEditInitial,
  linkedCalendarQuickLabelKey,
  type LinkedCalendarFormInitial,
  type LinkedCalendarQuickKind,
} from "../../../domain/items/linkedCalendarQuickCreate";
import { parseRemindBeforeDays } from "../../../domain/timeline/parseRemindBeforeDays";
import { toUserEventFormWorksetId } from "../../../domain/timeline/userEvents";
import { parseOptionalNumberInput } from "../../../domain/items/itemInventoryDisplay";

function linkedOneOffWriteParams(
  values: UserEventFormValues,
  itemId: string,
  worksetId: string,
  remindBeforeDays: number | null,
) {
  const isPurchase = values.calendarKind === "purchase_effective";
  const amount = isPurchase ? parseOptionalNumberInput(values.amountInput) : null;
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
    kind: values.calendarKind,
    amount,
    direction: amount == null ? null : values.direction,
  };
}

type Options = {
  item: TrackableItem | null;
  /** Current item-form workset — linked calendars always follow this value. */
  worksetId: string;
  /** Selected category preset for remind-before-days on create. */
  defaultRemindBeforeDays?: number | null;
  /** When true, refuse to open / submit linked calendar dialogs. */
  formBusy: boolean;
  /** Create mode: persist draft and return saved row before first linked calendar. */
  ensureItem?: () => Promise<TrackableItem | null>;
};

/**
 * Linked-calendar dialog orchestration for ItemForm
 * (create / edit / refresh — form fields stay in ItemForm).
 */
export function useItemFormLinkedCalendars({
  item,
  worksetId,
  defaultRemindBeforeDays = null,
  formBusy,
  ensureItem,
}: Options) {
  const { t } = useTranslation("items");
  const { t: tt } = useTranslation("timeline");
  const { showToast } = useToast();

  const [linkedCalendarOpen, setLinkedCalendarOpen] = useState(false);
  const [linkedCalendarMode, setLinkedCalendarMode] = useState<"create" | "edit">("create");
  const [linkedCalendarBusy, setLinkedCalendarBusy] = useState(false);
  const [linkedCalendarError, setLinkedCalendarError] = useState<string | null>(null);
  const [linkedCalendarRefreshKey, setLinkedCalendarRefreshKey] = useState(0);
  const [linkedCalendarInitial, setLinkedCalendarInitial] =
    useState<LinkedCalendarFormInitial | null>(null);
  const [editingLinkedEvent, setEditingLinkedEvent] = useState<UserEvent | null>(null);
  const [activeLinkedExpiry, setActiveLinkedExpiry] = useState<UserEvent | null>(null);

  const clearLinkedCalendarDialog = () => {
    setLinkedCalendarOpen(false);
    setLinkedCalendarInitial(null);
    setEditingLinkedEvent(null);
    setLinkedCalendarError(null);
  };

  const resolveItem = async (): Promise<TrackableItem | null> => {
    if (item) return item;
    return ensureItem?.() ?? null;
  };

  const openLinkedCalendarCreate = async (kind?: LinkedCalendarQuickKind) => {
    if (formBusy) return;
    const resolvedItem = await resolveItem();
    if (!resolvedItem) return;
    setLinkedCalendarMode("create");
    setEditingLinkedEvent(null);
    const quickKind = kind ?? "other";
    const prefillTitle =
      quickKind === "other"
        ? ""
        : t(linkedCalendarQuickLabelKey(quickKind));
    setLinkedCalendarInitial(
      buildLinkedCalendarCreateInitial({
        itemId: resolvedItem.id,
        worksetId: worksetId || resolvedItem.worksetId,
        title: prefillTitle,
        kind: quickKind,
        defaultRemindBeforeDays: quickKind === "expires" ? defaultRemindBeforeDays : null,
      }),
    );
    setLinkedCalendarError(null);
    setLinkedCalendarOpen(true);
  };

  const openLinkedCalendarEdit = (event: UserEvent) => {
    if (!item || formBusy) return;
    setLinkedCalendarMode("edit");
    setEditingLinkedEvent(event);
    setLinkedCalendarInitial(
      buildLinkedCalendarEditInitial({
        event,
        itemId: item.id,
        fallbackWorksetId: worksetId || item.worksetId,
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
    const resolvedItem = item ?? (await ensureItem?.());
    if (!resolvedItem) return;
    setLinkedCalendarBusy(true);
    setLinkedCalendarError(null);
    try {
      const lockedItemId = resolvedItem.id;
      // Linked calendars inherit the item workset; dialog hides the workset picker.
      const ownedWorksetId = toUserEventFormWorksetId(worksetId || resolvedItem.worksetId);
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

  const deleteLinkedOneOff = async (event: UserEvent) => {
    if (!item || formBusy || linkedCalendarBusy) return;
    const name = event.title.trim() || event.id;
    if (!window.confirm(t("deleteLinkedCalendarConfirm", { name }))) return;
    setLinkedCalendarBusy(true);
    try {
      await deleteUserEvent(event.id);
      showToast(t("linkedCalendarDeleted"), "success");
      setLinkedCalendarRefreshKey((n) => n + 1);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : tt("messages.saveFailed"),
        "error",
      );
    } finally {
      setLinkedCalendarBusy(false);
    }
  };

  const deleteLinkedRecurring = async (seriesId: string, title: string) => {
    if (!item || formBusy || linkedCalendarBusy) return;
    const name = title.trim() || seriesId;
    if (!window.confirm(t("deleteLinkedCalendarConfirm", { name }))) return;
    setLinkedCalendarBusy(true);
    try {
      await deleteRecurringSeries(seriesId);
      showToast(t("linkedCalendarDeleted"), "success");
      setLinkedCalendarRefreshKey((n) => n + 1);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : tt("messages.saveFailed"),
        "error",
      );
    } finally {
      setLinkedCalendarBusy(false);
    }
  };

  return {
    linkedCalendarOpen,
    linkedCalendarMode,
    linkedCalendarBusy,
    linkedCalendarError,
    linkedCalendarRefreshKey,
    linkedCalendarInitial,
    openLinkedCalendarCreate,
    openLinkedCalendarEdit,
    closeLinkedCalendarDialog,
    submitLinkedCalendar,
    deleteLinkedOneOff,
    deleteLinkedRecurring,
    activeLinkedExpiry,
    setActiveLinkedExpiry,
  };
}
