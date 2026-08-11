import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import {
  createUserEvent,
  deleteUserEvent,
  updateUserEvent,
  type UserEvent,
} from "../../api/userEvents";
import { deleteTask } from "../../api/tasks";
import type { UserEventFormValues } from "../../components/calendar/UserEventDialog";
import { useTaskCatalog, useWorksetNameById } from "../../context/TaskCatalogContext";
import { useToast } from "../../context/ToastContext";
import { createRecurringTimelineEvent } from "../../domain/timeline/createRecurringTimelineEvent";
import { parseRemindBeforeDays } from "../../domain/timeline/parseRemindBeforeDays";
import { toUserEventFormWorksetId } from "../../domain/timeline/userEvents";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { toErrorMessage } from "../../utils/errors";
import type { ScheduleTab } from "./scheduleConfig";
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
    itemId: event.itemId ?? "",
    amountInput: event.amount == null ? "" : String(event.amount),
    direction: event.direction === "income" ? "income" : "expense",
  };
}

export function useSchedulePageDialogs(opts: {
  tab: ScheduleTab;
  reloadOneOff: () => Promise<void>;
  reloadRecurring: () => Promise<void>;
}) {
  const { tab, reloadOneOff, reloadRecurring } = opts;
  const { t } = useTranslation("schedule");
  const { t: tTimeline } = useTranslation("timeline");
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { worksets, refreshTasks } = useTaskCatalog();
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

  const openCreate = useCallback(() => {
    setDialogMode("create");
    setEditingEvent(null);
    setDialogError(null);
    setDialogInitial({
      kind: tab === "recurring" ? "recurring" : "one_off",
      worksetId: SYSTEM_WORKSET_ID,
    });
    setDialogOpen(true);
  }, [tab]);

  const openEditOneOff = useCallback((event: UserEvent) => {
    setDialogMode("edit");
    setEditingEvent(event);
    setDialogError(null);
    setDialogInitial(userEventToFormValues(event));
    setDialogOpen(true);
  }, []);

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

        if (dialogMode === "create" && (tab === "recurring" || values.kind === "recurring")) {
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
          });
          await refreshTasks().catch(() => undefined);
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
          });
          showToast(t("toast.oneOffUpdated"), "success");
          await reloadOneOff();
        }
        setDialogOpen(false);
        setEditingEvent(null);
        setDialogInitial(null);
      } catch (error) {
        setDialogError(toErrorMessage(error) || t("toast.saveFailed"));
      } finally {
        setDialogBusy(false);
      }
    },
    [
      dialogMode,
      editingEvent,
      refreshTasks,
      reloadOneOff,
      reloadRecurring,
      showToast,
      t,
      tTimeline,
      tab,
    ],
  );

  const requestDeleteOneOff = useCallback((event: UserEvent) => {
    setDeleteTarget({ kind: "oneOff", id: event.id, title: event.title });
  }, []);

  const requestDeleteRecurring = useCallback((task: ScheduleRecurringItem) => {
    setDeleteTarget({ kind: "recurring", id: task.id, title: task.name });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === "oneOff") {
        await deleteUserEvent(deleteTarget.id);
        showToast(t("toast.oneOffDeleted"), "success");
        await reloadOneOff();
      } else {
        await deleteTask(deleteTarget.id);
        await refreshTasks().catch(() => undefined);
        showToast(t("toast.recurringDeleted"), "success");
        await reloadRecurring();
      }
      setDeleteTarget(null);
    } catch (error) {
      showToast(toErrorMessage(error) || t("toast.deleteFailed"), "error");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, refreshTasks, reloadOneOff, reloadRecurring, showToast, t]);

  const dialogTitleOverride =
    dialogMode === "create"
      ? tab === "recurring"
        ? t("createRecurring")
        : t("createOneOff")
      : undefined;

  return {
    worksetOptions,
    worksetNameById,
    dialogOpen,
    dialogMode,
    dialogInitial,
    dialogBusy,
    dialogError,
    dialogTitleOverride,
    openCreate,
    openEditOneOff,
    openEditRecurring,
    closeDialog,
    handleSubmit,
    deleteTarget,
    deleting,
    requestDeleteOneOff,
    requestDeleteRecurring,
    confirmDelete,
    cancelDelete: () => setDeleteTarget(null),
  };
}
