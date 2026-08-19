import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import {
  createUserEvent,
  deleteUserEvent,
  updateUserEvent,
  type UserEvent,
} from "../../api/userEvents";
import {
  deleteRecurringSeries,
  patchRecurringSeries,
} from "../../api/recurringSeries";
import type { UserEventFormValues } from "../../components/calendar/UserEventDialog";
import { useTaskCatalog, useWorksetNameById } from "../../context/TaskCatalogContext";
import { useToast } from "../../context/ToastContext";
import { createRecurringTimelineEvent } from "../../domain/timeline/createRecurringTimelineEvent";
import { defaultCreateTimedRange } from "../../domain/timeline/dateUtils";
import { parseRemindBeforeDays } from "../../domain/timeline/parseRemindBeforeDays";
import { toUserEventFormWorksetId } from "../../domain/timeline/userEvents";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { handleCommandError } from "../../utils/errors";
import type { ScheduleRecurringItem } from "./useScheduleRecurringFeed";

function userEventToFormValues(event: UserEvent): Partial<UserEventFormValues> {
  return {
    kind: "one_off",
    calendarKind: event.kind ?? "normal",
    title: event.title,
    startTime: event.startTime,
    endTime: event.endTime ?? "",
    location: event.location ?? "",
    body: event.body ?? "",
    worksetId: event.worksetId || SYSTEM_WORKSET_ID,
    isAllDay: Boolean(event.isAllDay),
    remindBeforeDays:
      event.remindBeforeDays == null ? "" : String(event.remindBeforeDays),
    notifyPref: event.notifyPref ?? "inherit",
    itemId: event.itemId ?? "",
    amountInput: event.amount == null ? "" : String(event.amount),
    direction: event.direction === "income" ? "income" : "expense",
  };
}

export function useSchedulePageDialogs(opts: {
  reloadOneOff: () => Promise<void>;
  reloadRecurring: () => Promise<void>;
}) {
  const { reloadOneOff, reloadRecurring } = opts;
  const { t } = useTranslation("schedule");
  const { t: tTimeline } = useTranslation("timeline");
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { worksets } = useTaskCatalog();
  const worksetNameById = useWorksetNameById();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogInitial, setDialogInitial] = useState<Partial<UserEventFormValues> | null>(
    null,
  );
  const [editingEvent, setEditingEvent] = useState<UserEvent | null>(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: "oneOff"; id: string; title: string }
    | { kind: "recurring"; id: string; title: string }
    | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  const worksetOptions = useMemo(
    () =>
      worksets.map((ws) => ({
        id: ws.id,
        name: ws.name,
      })),
    [worksets],
  );

  /** Mirror Timeline create: UserEventDialog with one_off | recurring kind switch. */
  const openCreate = useCallback(() => {
    setDialogMode("create");
    setEditingEvent(null);
    setDialogError(null);
    const range = defaultCreateTimedRange();
    setDialogInitial({
      worksetId: toUserEventFormWorksetId(null),
      startTime: range.startTime,
      endTime: range.endTime,
      isAllDay: false,
      remindBeforeDays: "",
    });
    setDialogOpen(true);
  }, []);

  const openEditOneOff = useCallback((event: UserEvent) => {
    setDialogMode("edit");
    setEditingEvent(event);
    setDialogError(null);
    setDialogInitial(userEventToFormValues(event));
    setDialogOpen(true);
  }, []);

  /** Series edit stays on RecurringSeriesEditor (same as Timeline create → series edit elsewhere). */
  const openEditRecurring = useCallback(
    (task: ScheduleRecurringItem) => {
      navigate(`/schedule/recurring/${task.id}/edit`);
    },
    [navigate],
  );

  const closeDialog = useCallback(() => {
    if (dialogBusy) return;
    setDialogOpen(false);
    setEditingEvent(null);
    setDialogInitial(null);
    setDialogError(null);
  }, [dialogBusy]);

  const handleSubmit = useCallback(
    async (values: UserEventFormValues) => {
      setDialogBusy(true);
      setDialogError(null);
      try {
        const worksetId = toUserEventFormWorksetId(values.worksetId);
        let remindBeforeDays: number | null = null;
        try {
          remindBeforeDays = parseRemindBeforeDays(values.remindBeforeDays);
        } catch {
          setDialogError(tTimeline("userEvent.errors.remindInvalid"));
          return;
        }
        const itemId = (values.itemId ?? "").trim() || null;

        if (dialogMode === "create" && values.kind === "recurring") {
          await createRecurringTimelineEvent({
            title: values.title,
            worksetId,
            isAllDay: values.isAllDay,
            eventStartTime: values.eventStartTime,
            eventEndTime: values.eventEndTime,
            location: values.location,
            body: values.body,
            rrule: values.rrule,
            itemId,
            notifyPref: values.notifyPref,
          });
          showToast(t("toast.recurringCreated"), "success");
          await reloadRecurring();
        } else if (dialogMode === "create") {
          await createUserEvent({
            title: values.title,
            startTime: values.startTime,
            endTime: values.endTime || null,
            body: values.body,
            location: values.location,
            isAllDay: values.isAllDay,
            remindBeforeDays,
            itemId,
            worksetId,
            kind: "normal",
            notifyPref: values.notifyPref,
          });
          showToast(t("toast.oneOffCreated"), "success");
          await reloadOneOff();
        } else if (editingEvent) {
          await updateUserEvent(editingEvent.id, {
            title: values.title,
            startTime: values.startTime,
            endTime: values.endTime || null,
            body: values.body,
            location: values.location,
            isAllDay: values.isAllDay,
            remindBeforeDays,
            itemId,
            worksetId,
            notifyPref: values.notifyPref,
          });
          showToast(t("toast.oneOffUpdated"), "success");
          await reloadOneOff();
        }
        setDialogOpen(false);
        setEditingEvent(null);
        setDialogInitial(null);
      } catch (error) {
        const message = handleCommandError(error, showToast) || t("toast.saveFailed");
        setDialogError(message);
      } finally {
        setDialogBusy(false);
      }
    },
    [
      dialogMode,
      editingEvent,
      reloadOneOff,
      reloadRecurring,
      showToast,
      t,
      tTimeline,
    ],
  );

  const requestDeleteOneOff = useCallback((event: UserEvent) => {
    setDeleteTarget({ kind: "oneOff", id: event.id, title: event.title });
  }, []);

  const requestDeleteRecurring = useCallback((task: ScheduleRecurringItem) => {
    setDeleteTarget({ kind: "recurring", id: task.id, title: task.name });
  }, []);

  const toggleRecurringActive = useCallback(
    async (series: ScheduleRecurringItem) => {
      try {
        await patchRecurringSeries(series.id, { isActive: !series.isActive });
        showToast(
          series.isActive ? t("toast.recurringPaused") : t("toast.recurringResumed"),
          "success",
        );
        await reloadRecurring();
      } catch (error) {
        showToast(handleCommandError(error) || t("toast.saveFailed"), "error");
      }
    },
    [reloadRecurring, showToast, t],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === "oneOff") {
        await deleteUserEvent(deleteTarget.id);
        showToast(t("toast.oneOffDeleted"), "success");
        await reloadOneOff();
      } else {
        await deleteRecurringSeries(deleteTarget.id);
        showToast(t("toast.recurringDeleted"), "success");
        await reloadRecurring();
      }
      setDeleteTarget(null);
    } catch (error) {
      showToast(handleCommandError(error) || t("toast.deleteFailed"), "error");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, reloadOneOff, reloadRecurring, showToast, t]);

  return {
    worksetOptions,
    worksetNameById,
    dialogOpen,
    dialogMode,
    dialogInitial,
    dialogBusy,
    dialogError,
    openCreate,
    openEditOneOff,
    openEditRecurring,
    closeDialog,
    handleSubmit,
    deleteTarget,
    deleting,
    requestDeleteOneOff,
    requestDeleteRecurring,
    toggleRecurringActive,
    confirmDelete,
    cancelDelete: () => setDeleteTarget(null),
  };
}
