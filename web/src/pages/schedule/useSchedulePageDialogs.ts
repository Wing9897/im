import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import {
  deleteUserEvent,
  type UserEvent,
} from "../../api/userEvents";
import {
  deleteRecurringSeries,
  patchRecurringSeries,
} from "../../api/recurringSeries";
import type { UserEventFormValues } from "../../components/calendar/UserEventDialog";
import { useTaskCatalog, useWorksetNameById } from "../../context/TaskCatalogContext";
import { useToast } from "../../context/ToastContext";
import { defaultCreateTimedRange } from "../../domain/timeline/dateUtils";
import { submitStandardUserEvent } from "../../domain/timeline/submitUserEventForm";
import { userEventToFormValues } from "../../domain/timeline/userEventFormMapping";
import { toUserEventFormWorksetId } from "../../domain/timeline/userEvents";
import { handleCommandError } from "../../utils/errors";
import type { ScheduleRecurringItem } from "./useScheduleRecurringFeed";

export function useSchedulePageDialogs(opts: {
  reloadOneOff: () => Promise<void>;
  reloadRecurring: () => Promise<void>;
}) {
  const { reloadOneOff, reloadRecurring } = opts;
  const { t } = useTranslation("schedule");
  const { t: tTimeline } = useTranslation("timeline");
  const { showToast } = useToast();
  const { worksets } = useTaskCatalog();
  const worksetNameById = useWorksetNameById();

  const [searchParams, setSearchParams] = useSearchParams();
  const seriesFromUrl = searchParams.get("series")?.trim() ?? "";
  const [localSeriesId, setLocalSeriesId] = useState<string | null>(null);
  const editingSeriesId: string | null =
    localSeriesId ?? (seriesFromUrl.length > 0 ? seriesFromUrl : null);
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

  /** Series edit stays in RecurringSeriesDialog, on this page. */
  const openEditRecurring = useCallback((task: ScheduleRecurringItem) => {
    setLocalSeriesId(task.id);
  }, []);

  const closeEditRecurring = useCallback(() => {
    setLocalSeriesId(null);
    if (seriesFromUrl) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("series");
          return next;
        },
        { replace: true },
      );
    }
    void reloadRecurring();
  }, [reloadRecurring, seriesFromUrl, setSearchParams]);

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
        const status = await submitStandardUserEvent({
          mode: dialogMode,
          values,
          editingEventId: editingEvent?.id ?? null,
        });
        if (status === "remindInvalid") {
          setDialogError(tTimeline("userEvent.errors.remindInvalid"));
          return;
        }
        if (status === "recurringCreated") {
          showToast(t("toast.recurringCreated"), "success");
          await reloadRecurring();
        } else if (status === "oneOffCreated") {
          showToast(t("toast.oneOffCreated"), "success");
          await reloadOneOff();
        } else if (status === "oneOffUpdated") {
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
    editingSeriesId,
    openCreate,
    openEditOneOff,
    openEditRecurring,
    closeEditRecurring,
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
