/**
 * Global host for Desktop .ics / deep-link calendar import.
 *
 * Opens the shared UserEventDialog so the user can confirm fields and pick a task.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { createUserEvent } from "../../api/userEvents";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import { useToast } from "../../context/ToastContext";
import {
  filterAssignableTimelineTasks,
  toUserEventFormTaskId,
  toUserEventWriteTaskId,
} from "../../domain/timeline/userEvents";
import {
  getElectronCalendarImport,
  type CalendarImportDraft,
  type CalendarImportMessage,
} from "../../electron/calendarImport";
import { isElectronDesktop } from "../../electron/electronWindow";
import {
  UserEventDialog,
  type UserEventFormValues,
} from "./UserEventDialog";

function draftToInitial(draft: CalendarImportDraft): Partial<UserEventFormValues> {
  return {
    title: draft.title,
    startTime: draft.startTime,
    endTime: draft.endTime,
    location: draft.location,
    body: draft.body,
    taskId: toUserEventFormTaskId(draft.taskId || null),
  };
}

/** Outer gate — no TaskCatalog dependency when not in the Desktop shell. */
export function CalendarImportHost() {
  if (!isElectronDesktop()) return null;
  return <CalendarImportHostInner />;
}

function CalendarImportHostInner() {
  const { t } = useTranslation("timeline");
  const { showToast } = useToast();
  const { tasks } = useTaskCatalog();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initial, setInitial] = useState<Partial<UserEventFormValues> | null>(null);

  const taskOptions = useMemo(
    () =>
      filterAssignableTimelineTasks(tasks, { activeOnly: true }).map((task) => ({
        id: task.id,
        name: task.name,
      })),
    [tasks],
  );

  const applyMessage = useCallback(
    (message: CalendarImportMessage) => {
      if (!message.ok) {
        showToast(message.error || t("userEvent.importFailed"), "error");
        return;
      }
      setInitial(draftToInitial(message.draft));
      setError(null);
      setOpen(true);
    },
    [showToast, t],
  );

  useEffect(() => {
    const api = getElectronCalendarImport();
    if (!api) return;

    let cancelled = false;
    void api.getPending().then((pending) => {
      if (!cancelled && pending) applyMessage(pending);
    });
    const unsubscribe = api.onImport((message) => {
      applyMessage(message);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [applyMessage]);

  const close = useCallback(() => {
    if (busy) return;
    setOpen(false);
    setInitial(null);
    setError(null);
  }, [busy]);

  const submit = useCallback(
    async (values: UserEventFormValues) => {
      setBusy(true);
      setError(null);
      try {
        await createUserEvent({
          title: values.title,
          startTime: values.startTime,
          endTime: values.endTime || null,
          body: values.body,
          location: values.location,
          taskId: toUserEventWriteTaskId(values.taskId),
        });
        setOpen(false);
        setInitial(null);
        showToast(t("userEvent.importSaved"), "success");
      } catch (err) {
        setError(err instanceof Error ? err.message : t("messages.saveFailed"));
      } finally {
        setBusy(false);
      }
    },
    [showToast, t],
  );

  return (
    <UserEventDialog
      open={open}
      mode="create"
      titleOverride={t("userEvent.importTitle")}
      introOverride={t("userEvent.importIntro")}
      taskOptions={taskOptions}
      initial={initial}
      busy={busy}
      error={error}
      onClose={close}
      onSubmit={(values) => {
        void submit(values);
      }}
    />
  );
}
