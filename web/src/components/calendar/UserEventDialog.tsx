import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { WorksetTargetSelectField } from "../assistant/WorksetTargetSelect";
import { ModalDialog } from "../ModalDialog";
import { Button, TextField } from "../ui";
import { toUserEventFormWorksetId } from "../../domain/timeline/userEvents";
import {
  fromDateTimeLocalInput,
  toDateTimeLocalInput,
} from "../../domain/timeline/dateUtils";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";

export type UserEventFormValues = {
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  body: string;
  /** Ownership workset id (``__user__`` = builtin system workset). */
  worksetId: string;
};

export type UserEventTaskOption = {
  id: string;
  name: string;
};

type UserEventDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  initial?: Partial<UserEventFormValues> | null;
  /** Available worksets (incl. builtin ``__user__``). */
  worksetOptions?: readonly UserEventTaskOption[];
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
  worksetId: SYSTEM_WORKSET_ID,
};

const fieldsClass = "flex flex-col gap-md";

/** One-off user event form (no RRULE). */
export function UserEventDialog({
  open,
  mode,
  initial,
  worksetOptions = [],
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
      startTime: toDateTimeLocalInput(initial?.startTime ?? ""),
      endTime: toDateTimeLocalInput(initial?.endTime ?? ""),
      location: initial?.location ?? "",
      body: initial?.body ?? "",
      worksetId: toUserEventFormWorksetId(initial?.worksetId),
    });
  }, [open, initial]);

  const displayError = error ?? localError;

  const handleSubmit = () => {
    const title = values.title.trim();
    if (!title) {
      setLocalError(t("userEvent.titleRequired"));
      return;
    }
    const startTime = fromDateTimeLocalInput(values.startTime);
    if (!startTime) {
      setLocalError(t("userEvent.startRequired"));
      return;
    }
    const endTime = values.endTime ? fromDateTimeLocalInput(values.endTime) : "";
    onSubmit({
      title,
      startTime,
      endTime: endTime || "",
      location: values.location.trim(),
      body: values.body.trim(),
      worksetId: toUserEventFormWorksetId(values.worksetId),
    });
  };

  return (
    <ModalDialog
      open={open}
      title={
        titleOverride ??
        (mode === "create" ? t("userEvent.createTitle") : t("userEvent.editTitle"))
      }
      closeAriaLabel={t("userEvent.closeAria")}
      onClose={onClose}
      testId="user-event-dialog"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            {t("userEvent.cancel")}
          </Button>
          <Button type="button" variant="primary" onClick={handleSubmit} disabled={busy}>
            {mode === "create" ? t("userEvent.create") : t("userEvent.save")}
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
        <WorksetTargetSelectField
          aria-label={t("userEvent.taskLabel")}
          value={values.worksetId}
          onChange={(worksetId) => setValues((prev) => ({ ...prev, worksetId }))}
          options={worksetOptions}
          keepStaleOption
          className="w-full"
          data-testid="user-event-workset-select"
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
