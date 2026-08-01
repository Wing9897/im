import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { WorksetTargetSelectField } from "../assistant/WorksetTargetSelect";
import { ModalDialog } from "../ModalDialog";
import {
  Button,
  CheckboxField,
  FieldLabel,
  FormStack,
  PillButton,
  TextField,
} from "../ui";
import { toUserEventFormWorksetId } from "../../domain/timeline/userEvents";
import {
  addDaysToDateInput,
  allDayFormRangeForDays,
  datePartFromInput,
  fromAllDayDateInput,
  fromDateTimeLocalInput,
  inclusiveEndDateFromExclusive,
  timedLocalRangeForDays,
  toAllDayDateInput,
  toDateTimeLocalInput,
  todayDateInput,
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
  isAllDay: boolean;
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
  isAllDay: false,
};

const DAY_PRESETS = [1, 3, 7, 13] as const;

function valuesFromInitial(initial?: Partial<UserEventFormValues> | null): UserEventFormValues {
  const isAllDay = Boolean(initial?.isAllDay);
  if (isAllDay) {
    const startDate = toAllDayDateInput(initial?.startTime ?? "");
    const exclusiveEnd = toAllDayDateInput(initial?.endTime ?? "");
    const endDate =
      (exclusiveEnd ? inclusiveEndDateFromExclusive(exclusiveEnd) : "") || startDate;
    return {
      title: initial?.title ?? "",
      startTime: startDate,
      endTime: endDate,
      location: initial?.location ?? "",
      body: initial?.body ?? "",
      worksetId: toUserEventFormWorksetId(initial?.worksetId),
      isAllDay: true,
    };
  }
  return {
    title: initial?.title ?? "",
    startTime: toDateTimeLocalInput(initial?.startTime ?? ""),
    endTime: toDateTimeLocalInput(initial?.endTime ?? ""),
    location: initial?.location ?? "",
    body: initial?.body ?? "",
    worksetId: toUserEventFormWorksetId(initial?.worksetId),
    isAllDay: false,
  };
}

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
  const [customDays, setCustomDays] = useState("");

  // Depend on field values — not `initial` object identity — so parent re-renders
  // (inline `{ worksetId }` / editing snapshots) do not wipe in-progress edits.
  const initialTitle = initial?.title ?? "";
  const initialStart = initial?.startTime ?? "";
  const initialEnd = initial?.endTime ?? "";
  const initialLocation = initial?.location ?? "";
  const initialBody = initial?.body ?? "";
  const initialWorksetId = initial?.worksetId;
  const initialIsAllDay = Boolean(initial?.isAllDay);

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    setCustomDays("");
    setValues(
      valuesFromInitial({
        title: initialTitle,
        startTime: initialStart,
        endTime: initialEnd,
        location: initialLocation,
        body: initialBody,
        worksetId: initialWorksetId,
        isAllDay: initialIsAllDay,
      }),
    );
  }, [
    open,
    initialTitle,
    initialStart,
    initialEnd,
    initialLocation,
    initialBody,
    initialWorksetId,
    initialIsAllDay,
  ]);

  const displayError = error ?? localError;

  const baseStartDate = () =>
    datePartFromInput(values.startTime) || todayDateInput();

  const applyDaySpan = (days: number) => {
    const startDate = baseStartDate();
    if (values.isAllDay) {
      const range = allDayFormRangeForDays(startDate, days);
      if (!range) return;
      setValues((prev) => ({
        ...prev,
        startTime: range.startDate,
        endTime: range.endDate,
      }));
      return;
    }
    const range = timedLocalRangeForDays(startDate, days);
    if (!range) return;
    setValues((prev) => ({
      ...prev,
      startTime: range.startTime,
      endTime: range.endTime,
    }));
  };

  const handleAllDayChange = (checked: boolean) => {
    setValues((prev) => {
      if (checked) {
        const startDate = datePartFromInput(prev.startTime) || todayDateInput();
        const endDate =
          datePartFromInput(prev.endTime) || startDate;
        const orderedEnd = endDate < startDate ? startDate : endDate;
        return {
          ...prev,
          isAllDay: true,
          startTime: startDate,
          endTime: orderedEnd,
        };
      }
      const startDate = datePartFromInput(prev.startTime) || todayDateInput();
      const endDate = datePartFromInput(prev.endTime) || startDate;
      const orderedEnd = endDate < startDate ? startDate : endDate;
      return {
        ...prev,
        isAllDay: false,
        startTime: `${startDate}T00:00`,
        endTime: `${orderedEnd}T23:59`,
      };
    });
  };

  const handleSubmit = () => {
    const title = values.title.trim();
    if (!title) {
      setLocalError(t("userEvent.errors.titleRequired"));
      return;
    }

    if (values.isAllDay) {
      const startDate = datePartFromInput(values.startTime);
      if (!startDate) {
        setLocalError(t("userEvent.errors.startRequired"));
        return;
      }
      let endDate = datePartFromInput(values.endTime) || startDate;
      if (endDate < startDate) endDate = startDate;
      const startTime = fromAllDayDateInput(startDate);
      const exclusiveEnd = fromAllDayDateInput(addDaysToDateInput(endDate, 1));
      if (!startTime || !exclusiveEnd) {
        setLocalError(t("userEvent.errors.startInvalid"));
        return;
      }
      onSubmit({
        title,
        startTime,
        endTime: exclusiveEnd,
        location: values.location.trim(),
        body: values.body.trim(),
        worksetId: toUserEventFormWorksetId(values.worksetId),
        isAllDay: true,
      });
      return;
    }

    const startTime = fromDateTimeLocalInput(values.startTime);
    if (!startTime) {
      setLocalError(t("userEvent.errors.startRequired"));
      return;
    }
    const endTime = values.endTime ? fromDateTimeLocalInput(values.endTime) : "";
    if (values.endTime && !endTime) {
      setLocalError(t("userEvent.errors.endInvalid"));
      return;
    }
    onSubmit({
      title,
      startTime,
      endTime: endTime || "",
      location: values.location.trim(),
      body: values.body.trim(),
      worksetId: toUserEventFormWorksetId(values.worksetId),
      isAllDay: false,
    });
  };

  const startLabel = values.isAllDay
    ? t("userEvent.startDateAria")
    : t("userEvent.startAria");
  const endLabel = values.isAllDay
    ? t("userEvent.endDateAria")
    : t("userEvent.endAria");

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
      <FormStack gap="lg">
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

        <div
          className="flex flex-col gap-sm rounded-md border border-surface-border/70 bg-[color-mix(in_srgb,var(--surface-overlay)_35%,transparent)] px-md py-sm"
          data-testid="user-event-time-section"
        >
          <CheckboxField
            id="user-event-all-day"
            label={t("userEvent.allDay")}
            checked={values.isAllDay}
            onChange={(event) => handleAllDayChange(event.target.checked)}
            data-testid="user-event-all-day"
          />

          <div className="flex flex-col gap-xs">
            <FieldLabel className="mb-0">{t("userEvent.durationPresets")}</FieldLabel>
            <div className="flex flex-wrap items-center gap-xs">
              {DAY_PRESETS.map((days) => (
                <PillButton
                  key={days}
                  type="button"
                  onClick={() => applyDaySpan(days)}
                  data-testid={`user-event-days-${days}`}
                >
                  {t("userEvent.daysPreset", { count: days })}
                </PillButton>
              ))}
              <div className="inline-flex items-center gap-xs">
                <TextField
                  aria-label={t("userEvent.customDaysAria")}
                  placeholder={t("userEvent.customDaysPlaceholder")}
                  type="number"
                  min={1}
                  max={366}
                  inputMode="numeric"
                  value={customDays}
                  onChange={(event) => setCustomDays(event.target.value)}
                  className="w-16"
                  data-testid="user-event-custom-days"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const days = Number.parseInt(customDays, 10);
                    if (!Number.isFinite(days) || days < 1) return;
                    applyDaySpan(Math.min(days, 366));
                  }}
                  data-testid="user-event-apply-custom-days"
                >
                  {t("userEvent.applyDays")}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-sm">
            <div className="flex flex-col gap-xs">
              <FieldLabel className="mb-0" htmlFor="user-event-start">
                {startLabel}
              </FieldLabel>
              <TextField
                id="user-event-start"
                aria-label={startLabel}
                type={values.isAllDay ? "date" : "datetime-local"}
                value={values.startTime}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, startTime: event.target.value }))
                }
                className="w-full"
                required
                data-testid="user-event-start"
              />
            </div>
            <div className="flex flex-col gap-xs">
              <FieldLabel className="mb-0" htmlFor="user-event-end">
                {endLabel}
              </FieldLabel>
              <TextField
                id="user-event-end"
                aria-label={endLabel}
                type={values.isAllDay ? "date" : "datetime-local"}
                value={values.endTime}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, endTime: event.target.value }))
                }
                className="w-full"
                data-testid="user-event-end"
              />
            </div>
          </div>
        </div>

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
      </FormStack>
    </ModalDialog>
  );
}
