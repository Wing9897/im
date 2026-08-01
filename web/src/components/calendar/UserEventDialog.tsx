import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { WorksetTargetSelectField } from "../assistant/WorksetTargetSelect";
import { ModalDialog } from "../ModalDialog";
import { RecurrenceRuleEditor } from "../task/RecurrenceRuleEditor";
import {
  Button,
  CheckboxField,
  FieldLabel,
  FormStack,
  PillButton,
  SegmentedControl,
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
import { buildRRule } from "../../utils/rrule";

export type UserEventKind = "one_off" | "recurring";

export type UserEventFormValues = {
  /** Create-dialog kind; edit / import paths always submit ``one_off``. */
  kind: UserEventKind;
  title: string;
  /** One-off: ISO wire datetime (or all-day DATE start). Recurring: unused. */
  startTime: string;
  /** One-off: ISO wire datetime / exclusive all-day end. Recurring: unused. */
  endTime: string;
  location: string;
  body: string;
  /** Ownership workset id (``__user__`` = builtin system workset). */
  worksetId: string;
  isAllDay: boolean;
  /** RRULE when ``kind === "recurring"``. */
  rrule: string;
  /** HH:MM when recurring and not all-day. */
  eventStartTime: string;
  eventEndTime: string;
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

const DEFAULT_RRULE = buildRRule({
  freq: "daily",
  interval: 1,
  byDay: [],
  byMonthDay: [],
  byMonth: [],
  ordinal: null,
  end: { type: "never", until: null, count: null },
});

const emptyValues: UserEventFormValues = {
  kind: "one_off",
  title: "",
  startTime: "",
  endTime: "",
  location: "",
  body: "",
  worksetId: SYSTEM_WORKSET_ID,
  isAllDay: false,
  rrule: DEFAULT_RRULE,
  eventStartTime: "09:00",
  eventEndTime: "10:00",
};

const DAY_PRESETS = [1, 3, 7, 13] as const;
const CLOCK_RE = /^\d{2}:\d{2}$/;

function valuesFromInitial(initial?: Partial<UserEventFormValues> | null): UserEventFormValues {
  const isAllDay = Boolean(initial?.isAllDay);
  const kind: UserEventKind = initial?.kind === "recurring" ? "recurring" : "one_off";
  const base = {
    kind,
    title: initial?.title ?? "",
    location: initial?.location ?? "",
    body: initial?.body ?? "",
    worksetId: toUserEventFormWorksetId(initial?.worksetId),
    isAllDay,
    rrule: (initial?.rrule ?? "").trim() || DEFAULT_RRULE,
    eventStartTime: (initial?.eventStartTime ?? "").trim() || "09:00",
    eventEndTime: (initial?.eventEndTime ?? "").trim() || "10:00",
  };

  if (kind === "recurring") {
    return {
      ...base,
      startTime: "",
      endTime: "",
    };
  }

  if (isAllDay) {
    const startDate = toAllDayDateInput(initial?.startTime ?? "");
    const exclusiveEnd = toAllDayDateInput(initial?.endTime ?? "");
    const endDate =
      (exclusiveEnd ? inclusiveEndDateFromExclusive(exclusiveEnd) : "") || startDate;
    return {
      ...base,
      startTime: startDate,
      endTime: endDate,
    };
  }
  return {
    ...base,
    startTime: toDateTimeLocalInput(initial?.startTime ?? ""),
    endTime: toDateTimeLocalInput(initial?.endTime ?? ""),
  };
}

/** User / recurring event create-edit form (timeline Add Event dialog). */
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

  // Import / edit stay on one-off user events; only plain create can switch.
  const allowKindSwitch = mode === "create" && !titleOverride;

  // Depend on field values — not `initial` object identity — so parent re-renders
  // (inline `{ worksetId }` / editing snapshots) do not wipe in-progress edits.
  const initialTitle = initial?.title ?? "";
  const initialStart = initial?.startTime ?? "";
  const initialEnd = initial?.endTime ?? "";
  const initialLocation = initial?.location ?? "";
  const initialBody = initial?.body ?? "";
  const initialWorksetId = initial?.worksetId;
  const initialIsAllDay = Boolean(initial?.isAllDay);
  const initialKind = initial?.kind === "recurring" ? "recurring" : "one_off";
  const initialRrule = initial?.rrule ?? "";
  const initialEventStart = initial?.eventStartTime ?? "";
  const initialEventEnd = initial?.eventEndTime ?? "";

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    setCustomDays("");
    setValues(
      valuesFromInitial({
        kind: allowKindSwitch ? initialKind : "one_off",
        title: initialTitle,
        startTime: initialStart,
        endTime: initialEnd,
        location: initialLocation,
        body: initialBody,
        worksetId: initialWorksetId,
        isAllDay: initialIsAllDay,
        rrule: initialRrule,
        eventStartTime: initialEventStart,
        eventEndTime: initialEventEnd,
      }),
    );
  }, [
    open,
    allowKindSwitch,
    initialKind,
    initialTitle,
    initialStart,
    initialEnd,
    initialLocation,
    initialBody,
    initialWorksetId,
    initialIsAllDay,
    initialRrule,
    initialEventStart,
    initialEventEnd,
  ]);

  const displayError = error ?? localError;
  const isRecurring = values.kind === "recurring";

  const kindItems = useMemo(
    () => [
      { id: "one_off", label: t("userEvent.kind.oneOff") },
      { id: "recurring", label: t("userEvent.kind.recurring") },
    ],
    [t],
  );

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

  const handleKindChange = (id: string) => {
    const nextKind: UserEventKind = id === "recurring" ? "recurring" : "one_off";
    if (nextKind === values.kind) return;
    setLocalError(null);
    setValues((prev) => {
      if (nextKind === "recurring") {
        const clockFromStart = prev.startTime.includes("T")
          ? prev.startTime.slice(11, 16)
          : "";
        const clockFromEnd = prev.endTime.includes("T")
          ? prev.endTime.slice(11, 16)
          : "";
        return {
          ...prev,
          kind: "recurring",
          rrule: prev.rrule.trim() || DEFAULT_RRULE,
          eventStartTime: CLOCK_RE.test(clockFromStart) ? clockFromStart : prev.eventStartTime || "09:00",
          eventEndTime: CLOCK_RE.test(clockFromEnd) ? clockFromEnd : prev.eventEndTime || "10:00",
        };
      }
      const today = todayDateInput();
      return {
        ...prev,
        kind: "one_off",
        startTime: prev.isAllDay
          ? today
          : `${today}T${prev.eventStartTime || "09:00"}`,
        endTime: prev.isAllDay
          ? today
          : `${today}T${prev.eventEndTime || "10:00"}`,
      };
    });
  };

  const handleAllDayChange = (checked: boolean) => {
    setValues((prev) => {
      if (prev.kind === "recurring") {
        return { ...prev, isAllDay: checked };
      }
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

    if (values.kind === "recurring") {
      const rrule = values.rrule.trim();
      if (!rrule) {
        setLocalError(t("userEvent.errors.rruleRequired"));
        return;
      }
      if (!values.isAllDay) {
        if (!CLOCK_RE.test(values.eventStartTime.trim())) {
          setLocalError(t("userEvent.errors.startRequired"));
          return;
        }
        const endClock = values.eventEndTime.trim();
        if (endClock && !CLOCK_RE.test(endClock)) {
          setLocalError(t("userEvent.errors.endInvalid"));
          return;
        }
      }
      onSubmit({
        kind: "recurring",
        title,
        startTime: "",
        endTime: "",
        location: values.location.trim(),
        body: values.body.trim(),
        worksetId: toUserEventFormWorksetId(values.worksetId),
        isAllDay: values.isAllDay,
        rrule,
        eventStartTime: values.isAllDay ? "" : values.eventStartTime.trim(),
        eventEndTime: values.isAllDay ? "" : values.eventEndTime.trim(),
      });
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
        kind: "one_off",
        title,
        startTime,
        endTime: exclusiveEnd,
        location: values.location.trim(),
        body: values.body.trim(),
        worksetId: toUserEventFormWorksetId(values.worksetId),
        isAllDay: true,
        rrule: "",
        eventStartTime: "",
        eventEndTime: "",
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
      kind: "one_off",
      title,
      startTime,
      endTime: endTime || "",
      location: values.location.trim(),
      body: values.body.trim(),
      worksetId: toUserEventFormWorksetId(values.worksetId),
      isAllDay: false,
      rrule: "",
      eventStartTime: "",
      eventEndTime: "",
    });
  };

  const startLabel = isRecurring
    ? t("userEvent.eventStartAria")
    : values.isAllDay
      ? t("userEvent.startDateAria")
      : t("userEvent.startAria");
  const endLabel = isRecurring
    ? t("userEvent.eventEndAria")
    : values.isAllDay
      ? t("userEvent.endDateAria")
      : t("userEvent.endAria");

  const introText = introOverride
    ?? (isRecurring ? t("userEvent.introRecurring") : t("userEvent.intro"));

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
        {allowKindSwitch ? (
          <div data-testid="user-event-kind-tabs">
            <SegmentedControl
              items={kindItems}
              value={values.kind}
              onChange={handleKindChange}
              ariaLabel={t("userEvent.kindAria")}
              layout="inline"
            />
          </div>
        ) : null}
        <p className="m-0 text-caption text-text-muted">
          {introText}
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

          {!isRecurring ? (
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
          ) : null}

          {isRecurring ? (
            !values.isAllDay ? (
              <div className="flex flex-col gap-sm">
                <div className="flex flex-col gap-xs">
                  <FieldLabel className="mb-0" htmlFor="user-event-event-start">
                    {startLabel}
                  </FieldLabel>
                  <TextField
                    id="user-event-event-start"
                    aria-label={startLabel}
                    type="time"
                    value={values.eventStartTime}
                    onChange={(event) =>
                      setValues((prev) => ({ ...prev, eventStartTime: event.target.value }))
                    }
                    className="w-full"
                    required
                    data-testid="user-event-event-start"
                  />
                </div>
                <div className="flex flex-col gap-xs">
                  <FieldLabel className="mb-0" htmlFor="user-event-event-end">
                    {endLabel}
                  </FieldLabel>
                  <TextField
                    id="user-event-event-end"
                    aria-label={endLabel}
                    type="time"
                    value={values.eventEndTime}
                    onChange={(event) =>
                      setValues((prev) => ({ ...prev, eventEndTime: event.target.value }))
                    }
                    className="w-full"
                    data-testid="user-event-event-end"
                  />
                </div>
              </div>
            ) : null
          ) : (
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
          )}
        </div>

        {isRecurring ? (
          <div data-testid="user-event-recurrence">
            <RecurrenceRuleEditor
              value={values.rrule}
              onChange={(rrule) => setValues((prev) => ({ ...prev, rrule }))}
              disabled={busy}
            />
          </div>
        ) : null}

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
