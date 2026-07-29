import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { CalendarTaskTargetSelectField } from "../assistant/CalendarTaskTargetSelect";
import { ModalDialog } from "../ModalDialog";
import { Button, TextField } from "../ui";
import {
  USER_EVENTS_FILTER_ID,
  toUserEventFormTaskId,
} from "../../domain/timeline/userEvents";
import {
  fromDateTimeLocalInput,
  toDateTimeLocalInput,
} from "../../domain/timeline/dateUtils";

export type UserEventFormValues = {
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  body: string;
  /** `__user__` or a real event/recurring/calendar_task task id. */
  taskId: string;
};

export type UserEventTaskOption = {
  id: string;
  name: string;
};

type UserEventDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  initial?: Partial<UserEventFormValues> | null;
  /** Assignable event/recurring/calendar_task tasks (excludes the virtual __user__ row). */
  taskOptions?: readonly UserEventTaskOption[];
  busy?: boolean;
  error?: string | null;
  /** Optional dialog title (e.g. Desktop ICS import). */
  titleOverride?: string;
  /** Optional intro line under the title. */
  introOverride?: string;
  onClose: () => void;
  onSubmit: (values: UserEventFormValues) => void;
};

const emptyValues: UserEventFormValues = {
  title: "",
  startTime: "",
  endTime: "",
  location: "",
  body: "",
  taskId: USER_EVENTS_FILTER_ID,
};

const fieldsClass = "flex flex-col gap-md";

/** One-off user event form (no RRULE). */
export function UserEventDialog({
  open,
  mode,
  initial,
  taskOptions = [],
  busy = false,
  error = null,
  titleOverride,
  introOverride,
  onClose,
  onSubmit,
}: UserEventDialogProps) {
  const { t } = useTranslation("timeline");
  const [values, setValues] = useState<UserEventFormValues>(emptyValues);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    setValues({
      title: initial?.title ?? "",
      startTime: initial?.startTime
        ? toDateTimeLocalInput(initial.startTime)
        : toDateTimeLocalInput(new Date().toISOString()),
      endTime: initial?.endTime ? toDateTimeLocalInput(initial.endTime) : "",
      location: initial?.location ?? "",
      body: initial?.body ?? "",
      taskId: toUserEventFormTaskId(initial?.taskId),
    });
  }, [open, initial]);

  const handleSubmit = () => {
    const title = values.title.trim();
    if (!title) {
      setLocalError(t("userEvent.errors.titleRequired"));
      return;
    }
    if (!values.startTime) {
      setLocalError(t("userEvent.errors.startRequired"));
      return;
    }
    const startIso = fromDateTimeLocalInput(values.startTime);
    if (!startIso) {
      setLocalError(t("userEvent.errors.startInvalid"));
      return;
    }
    let endIso: string | null = null;
    if (values.endTime) {
      endIso = fromDateTimeLocalInput(values.endTime);
      if (!endIso) {
        setLocalError(t("userEvent.errors.endInvalid"));
        return;
      }
    }
    setLocalError(null);
    onSubmit({
      title,
      startTime: startIso,
      endTime: endIso ?? "",
      location: values.location.trim(),
      body: values.body.trim(),
      taskId: toUserEventFormTaskId(values.taskId),
    });
  };

  const displayError = localError || error;

  return (
    <ModalDialog
      open={open}
      title={
        titleOverride ??
        (mode === "create" ? t("userEvent.createTitle") : t("userEvent.editTitle"))
      }
      onClose={onClose}
      testId="user-event-dialog"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            {t("userEvent.cancel")}
          </Button>
          <Button type="button" variant="primary" onClick={handleSubmit} disabled={busy}>
            {busy
              ? t("userEvent.saving")
              : mode === "create"
                ? t("userEvent.create")
                : t("userEvent.save")}
          </Button>
        </>
      }
    >
      <div className={fieldsClass}>
        <p className="m-0 text-caption text-text-muted">
          {introOverride ?? t("userEvent.intro")}
        </p>
        <TextField
          aria-label={t("userEvent.titleAria")}
          placeholder={t("userEvent.titlePlaceholder")}
          value={values.title}
          onChange={(event) => setValues((prev) => ({ ...prev, title: event.target.value }))}
          className="w-full"
          required
        />
        <CalendarTaskTargetSelectField
          aria-label={t("userEvent.taskLabel")}
          value={values.taskId}
          onChange={(taskId) => setValues((prev) => ({ ...prev, taskId }))}
          options={taskOptions}
          keepStaleOption
          className="w-full"
          data-testid="user-event-task-select"
        />
        <TextField
          aria-label={t("userEvent.startAria")}
          type="datetime-local"
          value={values.startTime}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, startTime: event.target.value }))
          }
          className="w-full"
          required
        />
        <TextField
          aria-label={t("userEvent.endAria")}
          type="datetime-local"
          value={values.endTime}
          onChange={(event) => setValues((prev) => ({ ...prev, endTime: event.target.value }))}
          className="w-full"
        />
        <TextField
          aria-label={t("userEvent.locationAria")}
          placeholder={t("userEvent.locationPlaceholder")}
          value={values.location}
          onChange={(event) => setValues((prev) => ({ ...prev, location: event.target.value }))}
          className="w-full"
        />
        <TextField
          aria-label={t("userEvent.bodyAria")}
          placeholder={t("userEvent.bodyPlaceholder")}
          value={values.body}
          onChange={(event) => setValues((prev) => ({ ...prev, body: event.target.value }))}
          className="w-full"
        />
        {displayError ? (
          <p className="m-0 text-caption text-error" role="alert">
            {displayError}
          </p>
        ) : null}
      </div>
    </ModalDialog>
  );
}
