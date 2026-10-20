import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { UserEventDialog } from "../../components/calendar/UserEventDialog";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import { useToast } from "../../context/ToastContext";
import { defaultCreateTimedRange } from "../../domain/timeline/dateUtils";
import { submitStandardUserEvent } from "../../domain/timeline/submitUserEventForm";
import type { UserEventFormValues } from "../../domain/timeline/userEventFormModel";
import { toUserEventFormWorksetId } from "../../domain/timeline/userEvents";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { handleCommandError } from "../../utils/errors";

/** App-level event create (`?event=`). Series edit stays on the schedule sheet. */
export function UserEventEditorHost() {
  const { t } = useTranslation("timeline");
  const { showToast } = useToast();
  const { worksets } = useTaskCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const event = searchParams.get("event");
  const isOpen = event === "new" || event === "recurring";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const worksetOptions = useMemo(
    () =>
      worksets.map((row) => ({
        id: row.id,
        name: row.id === SYSTEM_WORKSET_ID ? t("workset:generalName") : row.name,
      })),
    [t, worksets],
  );

  const initial = useMemo<Partial<UserEventFormValues> | null>(() => {
    if (!isOpen) return null;
    const range = defaultCreateTimedRange();
    return {
      kind: event === "recurring" ? "recurring" : "one_off",
      worksetId: toUserEventFormWorksetId(null),
      startTime: range.startTime,
      endTime: range.endTime,
      isAllDay: false,
      remindBeforeDays: "",
    };
  }, [event, isOpen]);

  const clearParam = (key: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  const closeEvent = () => {
    if (busy) return;
    setError(null);
    clearParam("event");
  };

  const onSubmit = async (values: UserEventFormValues) => {
    setBusy(true);
    setError(null);
    try {
      const status = await submitStandardUserEvent({ mode: "create", values });
      if (status === "remindInvalid") {
        setError(t("userEvent.errors.remindInvalid"));
        return;
      }
      if (status === "recurringCreated") {
        showToast(t("messages.recurringCreated"), "success");
      }
      setError(null);
      clearParam("event");
    } catch (err) {
      const message = handleCommandError(err, showToast) || t("messages.saveFailed");
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <UserEventDialog
      open={isOpen}
      mode="create"
      initial={initial}
      worksetOptions={worksetOptions}
      busy={busy}
      error={error}
      onClose={closeEvent}
      onSubmit={(values) => {
        void onSubmit(values);
      }}
    />
  );
}
