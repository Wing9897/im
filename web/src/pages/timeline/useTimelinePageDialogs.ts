import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import {
  createUserEvent,
  updateUserEvent,
} from "../../api/userEvents";
import {
  dismissTimelineEvent,
  restoreTimelineEvent,
  timelineItemDismissalSource,
} from "../../api/timelineDismissals";
import { useToast } from "../../context/ToastContext";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import { createRecurringTimelineEvent } from "../../domain/timeline/createRecurringTimelineEvent";
import { toUserEventFormWorksetId } from "../../domain/timeline/userEvents";
import type { TimelineItem } from "../../types";
import type { AnalysisTask } from "../../types/tasks";
import type { UserEventFormValues } from "../../components/calendar/UserEventDialog";

export type PendingTimelineConfirm =
  | { kind: "dismiss"; event: TimelineItem }
  | { kind: "restore"; event: TimelineItem };

type Args = {
  refreshEvents: (catalogOverride?: readonly AnalysisTask[]) => Promise<void>;
  selectedEvent: TimelineItem | null;
  setSelectedEvent: (event: TimelineItem | null) => void;
};

/** User-event create/edit + dismiss/restore confirm state for TimelinePage. */
export function useTimelinePageDialogs({
  refreshEvents,
  selectedEvent,
  setSelectedEvent,
}: Args) {
  const { t } = useTranslation("timeline");
  const navigate = useNavigate();
  const { tasks, refreshTasks } = useTaskCatalog();
  const { showToast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingEvent, setEditingEvent] = useState<TimelineItem | null>(null);
  const [createWorksetId, setCreateWorksetId] = useState<string | null>(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [userEventActionBusy, setUserEventActionBusy] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingTimelineConfirm | null>(null);

  const openCreateDialog = useCallback((worksetId?: string | null) => {
    setDialogMode("create");
    setEditingEvent(null);
    setCreateWorksetId(worksetId?.trim() || null);
    setDialogError(null);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((event: TimelineItem) => {
    setDialogMode("edit");
    setEditingEvent(event);
    setDialogError(null);
    setDialogOpen(true);
  }, []);

  const openEditItem = useCallback(
    (event: TimelineItem) => {
      const itemId = event.itemId?.trim();
      if (!itemId) return;
      const params = new URLSearchParams({ itemId });
      if (event.itemDateKind) params.set("itemDateKind", event.itemDateKind);
      void navigate(`/items?${params.toString()}`);
    },
    [navigate],
  );

  const closeDialog = useCallback(() => {
    if (dialogBusy) return;
    setDialogOpen(false);
    setEditingEvent(null);
    setCreateWorksetId(null);
    setDialogError(null);
  }, [dialogBusy]);

  const handleDialogSubmit = useCallback(
    async (values: UserEventFormValues) => {
      setDialogBusy(true);
      setDialogError(null);
      try {
        const worksetId = toUserEventFormWorksetId(values.worksetId);
        let catalogForRefresh: Awaited<ReturnType<typeof refreshTasks>> | undefined;
        if (dialogMode === "create" && values.kind === "recurring") {
          const created = await createRecurringTimelineEvent({
            title: values.title,
            worksetId,
            isAllDay: values.isAllDay,
            eventStartTime: values.eventStartTime,
            eventEndTime: values.eventEndTime,
            location: values.location,
            body: values.body,
            rrule: values.rrule,
          });
          // Await the refreshed catalog so the filter plan includes the new
          // recurring task (workset-only filters otherwise skip calendar fetch).
          // If catalog refresh fails, stitch the created task into the current
          // snapshot so the same race does not resurface.
          catalogForRefresh =
            (await refreshTasks().catch(() => undefined)) ?? [...tasks, created];
          showToast(t("messages.recurringCreated"), "success");
        } else if (dialogMode === "create") {
          await createUserEvent({
            title: values.title,
            startTime: values.startTime,
            endTime: values.endTime || null,
            body: values.body,
            location: values.location,
            isAllDay: values.isAllDay,
            worksetId,
          });
        } else if (editingEvent) {
          await updateUserEvent(editingEvent.id, {
            title: values.title,
            startTime: values.startTime,
            endTime: values.endTime || null,
            body: values.body,
            location: values.location,
            isAllDay: values.isAllDay,
            worksetId,
          });
        }
        setDialogOpen(false);
        setEditingEvent(null);
        await refreshEvents(catalogForRefresh);
      } catch (error) {
        setDialogError(error instanceof Error ? error.message : t("messages.saveFailed"));
      } finally {
        setDialogBusy(false);
      }
    },
    [dialogMode, editingEvent, refreshEvents, refreshTasks, showToast, t, tasks],
  );

  const handleDismissTimelineEvent = useCallback((event: TimelineItem) => {
    setPendingConfirm({ kind: "dismiss", event });
  }, []);

  const handleRestoreTimelineEvent = useCallback((event: TimelineItem) => {
    setPendingConfirm({ kind: "restore", event });
  }, []);

  const confirmPendingAction = useCallback(async () => {
    if (!pendingConfirm) return;
    const { kind, event } = pendingConfirm;
    setUserEventActionBusy(true);
    try {
      if (kind === "dismiss") {
        await dismissTimelineEvent(timelineItemDismissalSource(event.source), event.id);
        if (selectedEvent?.id === event.id) {
          setSelectedEvent(null);
        }
      } else {
        await restoreTimelineEvent(timelineItemDismissalSource(event.source), event.id);
      }
      setPendingConfirm(null);
      await refreshEvents();
    } catch (error) {
      const fallback =
        kind === "dismiss" ? t("messages.dismissFailed") : t("messages.restoreFailed");
      showToast(error instanceof Error ? error.message : fallback, "error");
    } finally {
      setUserEventActionBusy(false);
    }
  }, [pendingConfirm, refreshEvents, selectedEvent, setSelectedEvent, showToast, t]);

  const cancelPendingConfirm = useCallback(() => {
    if (!userEventActionBusy) setPendingConfirm(null);
  }, [userEventActionBusy]);

  return {
    dialogOpen,
    dialogMode,
    editingEvent,
    createWorksetId,
    dialogBusy,
    dialogError,
    userEventActionBusy,
    pendingConfirm,
    openCreateDialog,
    openEditDialog,
    openEditItem,
    closeDialog,
    handleDialogSubmit,
    handleDismissTimelineEvent,
    handleRestoreTimelineEvent,
    confirmPendingAction,
    cancelPendingConfirm,
  };
}
