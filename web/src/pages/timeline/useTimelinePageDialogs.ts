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
import {
  markTimelineImportant,
  unmarkTimelineImportant,
  timelineItemImportanceSource,
} from "../../api/timelineImportance";
import { useToast } from "../../context/ToastContext";
import { createRecurringTimelineEvent } from "../../domain/timeline/createRecurringTimelineEvent";
import {
  createTimedRangeOnDay,
  defaultCreateTimedRange,
} from "../../domain/timeline/dateUtils";
import { parseRemindBeforeDays } from "../../domain/timeline/parseRemindBeforeDays";
import {
  normalizeOptionalWorksetId,
  toUserEventFormWorksetId,
} from "../../domain/timeline/userEvents";
import type { TimelineItem } from "../../types";
import type { AnalysisTask } from "../../types/tasks";
import type { UserEventFormValues } from "../../components/calendar/UserEventDialog";
import { handleCommandError } from "../../utils/errors";

export type PendingTimelineConfirm =
  | { kind: "dismiss"; event: TimelineItem }
  | { kind: "restore"; event: TimelineItem };

export type OpenCreateDialogOptions = {
  worksetId?: string | null;
  /** Prefill start on this wall day (month cell right-click). */
  day?: Date;
  itemId?: string | null;
};

type Args = {
  refreshEvents: (catalogOverride?: readonly AnalysisTask[]) => Promise<void>;
  selectedEvent: TimelineItem | null;
  setSelectedEvent: (event: TimelineItem | null) => void;
};

function isOpenCreateOptions(value: unknown): value is OpenCreateDialogOptions {
  return (
    typeof value === "object" &&
    value !== null &&
    !("nativeEvent" in value) &&
    !(value instanceof Date)
  );
}

/** User-event create/edit + dismiss/restore confirm state for TimelinePage. */
export function useTimelinePageDialogs({
  refreshEvents,
  selectedEvent,
  setSelectedEvent,
}: Args) {
  const { t } = useTranslation("timeline");
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingEvent, setEditingEvent] = useState<TimelineItem | null>(null);
  const [createInitial, setCreateInitial] = useState<Partial<UserEventFormValues> | null>(
    null,
  );
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [userEventActionBusy, setUserEventActionBusy] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingTimelineConfirm | null>(null);

  const openCreateDialog = useCallback(
    (worksetIdOrOpts?: string | null | OpenCreateDialogOptions) => {
      setDialogMode("create");
      setEditingEvent(null);
      let worksetId: string | null = null;
      let day: Date | undefined;
      let itemId = "";
      if (isOpenCreateOptions(worksetIdOrOpts)) {
        worksetId = normalizeOptionalWorksetId(worksetIdOrOpts.worksetId);
        day = worksetIdOrOpts.day;
        itemId = (worksetIdOrOpts.itemId ?? "").trim();
      } else {
        // Toolbar may pass a React synthetic event if wired as onClick={openCreateDialog}.
        worksetId = normalizeOptionalWorksetId(worksetIdOrOpts);
      }
      const range = day ? createTimedRangeOnDay(day) : defaultCreateTimedRange();
      setCreateInitial({
        worksetId: toUserEventFormWorksetId(worksetId),
        startTime: range.startTime,
        endTime: range.endTime,
        isAllDay: false,
        itemId,
        remindBeforeDays: "",
      });
      setDialogError(null);
      setDialogOpen(true);
    },
    [],
  );

  const openEditDialog = useCallback((event: TimelineItem) => {
    setDialogMode("edit");
    setEditingEvent(event);
    setCreateInitial(null);
    setDialogError(null);
    setDialogOpen(true);
  }, []);

  const openEditItem = useCallback(
    (event: TimelineItem) => {
      const itemId = event.itemId?.trim();
      if (!itemId) return;
      void navigate(`/items/${encodeURIComponent(itemId)}/edit`);
    },
    [navigate],
  );

  const closeDialog = useCallback(() => {
    if (dialogBusy) return;
    setDialogOpen(false);
    setEditingEvent(null);
    setCreateInitial(null);
    setDialogError(null);
  }, [dialogBusy]);

  const handleDialogSubmit = useCallback(
    async (values: UserEventFormValues) => {
      setDialogBusy(true);
      setDialogError(null);
      try {
        const worksetId = toUserEventFormWorksetId(values.worksetId);
        let remindBeforeDays: number | null = null;
        try {
          remindBeforeDays = parseRemindBeforeDays(values.remindBeforeDays);
        } catch {
          setDialogError(t("userEvent.errors.remindInvalid"));
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
          showToast(t("messages.recurringCreated"), "success");
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
            // Omit kind/amount — preserve special kinds; title-only edits stay non-finance.
            notifyPref: values.notifyPref,
          });
        }
        await refreshEvents();
        setDialogOpen(false);
        setEditingEvent(null);
        setCreateInitial(null);
      } catch (error) {
        const message = handleCommandError(error, showToast) || t("messages.saveFailed");
        setDialogError(message);
      } finally {
        setDialogBusy(false);
      }
    },
    [dialogMode, editingEvent, refreshEvents, showToast, t],
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
      showToast(handleCommandError(error) || fallback, "error");
    } finally {
      setUserEventActionBusy(false);
    }
  }, [pendingConfirm, refreshEvents, selectedEvent, setSelectedEvent, showToast, t]);

  const cancelPendingConfirm = useCallback(() => {
    if (!userEventActionBusy) setPendingConfirm(null);
  }, [userEventActionBusy]);

  const handleToggleImportantEvent = useCallback(
    async (event: TimelineItem) => {
      setUserEventActionBusy(true);
      try {
        const source = timelineItemImportanceSource(event.source);
        if (event.important) {
          await unmarkTimelineImportant(source, event.id);
        } else {
          await markTimelineImportant(source, event.id);
        }
        await refreshEvents();
        if (selectedEvent?.id === event.id) {
          setSelectedEvent({ ...selectedEvent, important: !event.important });
        }
      } catch (error) {
        showToast(
          handleCommandError(error) || t("messages.importantFailed"),
          "error",
        );
      } finally {
        setUserEventActionBusy(false);
      }
    },
    [refreshEvents, selectedEvent, setSelectedEvent, showToast, t],
  );

  return {
    dialogOpen,
    dialogMode,
    editingEvent,
    createInitial,
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
    handleToggleImportantEvent,
    confirmPendingAction,
    cancelPendingConfirm,
  };
}
