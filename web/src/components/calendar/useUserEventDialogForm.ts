import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  allDayFormRangeForDays,
  datePartFromInput,
  timedLocalRangeForDays,
  todayDateInput,
} from "../../domain/timeline/dateUtils";
import {
  valuesForKindChange,
  type UserEventKind,
} from "../../domain/timeline/userEventKindSwitch";
import {
  DEFAULT_RRULE,
  EMPTY_USER_EVENT_FORM,
  valuesFromInitial,
  type UserEventFormValues,
} from "../../domain/timeline/userEventFormModel";
import { buildUserEventSubmitValues } from "./userEventFormSubmit";

type UseUserEventDialogFormArgs = {
  open: boolean;
  mode: "create" | "edit";
  initial?: Partial<UserEventFormValues> | null;
  /** Optional dialog title (e.g. Desktop ICS import) — disables kind switch. */
  titleOverride?: string;
  onSubmit: (values: UserEventFormValues) => void;
};

/**
 * Form state and kind/all-day transitions for UserEventDialog.
 * Submit validation lives in {@link buildUserEventSubmitValues}.
 */
export function useUserEventDialogForm({
  open,
  mode,
  initial,
  titleOverride,
  onSubmit,
}: UseUserEventDialogFormArgs) {
  const { t } = useTranslation("timeline");
  const [values, setValues] = useState<UserEventFormValues>(EMPTY_USER_EVENT_FORM);
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
  const initialRemindBeforeDays = initial?.remindBeforeDays ?? "";
  const initialItemId = initial?.itemId ?? "";
  const initialAmountInput = initial?.amountInput ?? "";
  const initialDirection = initial?.direction === "income" ? "income" : "expense";
  const initialKind = initial?.kind === "recurring" ? "recurring" : "one_off";
  const initialCalendarKind = initial?.calendarKind ?? "normal";
  const initialRrule = initial?.rrule ?? "";
  const initialEventStart = initial?.eventStartTime ?? "";
  const initialEventEnd = initial?.eventEndTime ?? "";

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    setCustomDays("");
    setValues(
      valuesFromInitial({
        // When kind switch is locked (edit / titled create), honor caller `initial.kind`
        // so schedule-page recurring create can stay on `recurring`.
        kind: initialKind,
        calendarKind: initialCalendarKind,
        title: initialTitle,
        startTime: initialStart,
        endTime: initialEnd,
        location: initialLocation,
        body: initialBody,
        worksetId: initialWorksetId,
        isAllDay: initialIsAllDay,
        remindBeforeDays: initialRemindBeforeDays,
        itemId: initialItemId,
        amountInput: initialAmountInput,
        direction: initialDirection,
        rrule: initialRrule,
        eventStartTime: initialEventStart,
        eventEndTime: initialEventEnd,
      }),
    );
  }, [
    open,
    allowKindSwitch,
    initialKind,
    initialCalendarKind,
    initialTitle,
    initialStart,
    initialEnd,
    initialLocation,
    initialBody,
    initialWorksetId,
    initialIsAllDay,
    initialRemindBeforeDays,
    initialItemId,
    initialAmountInput,
    initialDirection,
    initialRrule,
    initialEventStart,
    initialEventEnd,
  ]);

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
    setValues((prev) =>
      valuesForKindChange(prev, nextKind, { defaultRrule: DEFAULT_RRULE }),
    );
  };

  const handleAllDayChange = (checked: boolean) => {
    setValues((prev) => {
      if (prev.kind === "recurring") {
        return { ...prev, isAllDay: checked };
      }
      if (checked) {
        const startDate = datePartFromInput(prev.startTime) || todayDateInput();
        const endDate = datePartFromInput(prev.endTime) || startDate;
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
    const result = buildUserEventSubmitValues(values);
    if (!result.ok) {
      setLocalError(result.errorMessage ?? t(result.errorKey));
      return;
    }
    onSubmit(result.values);
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

  return {
    values,
    setValues,
    localError,
    customDays,
    setCustomDays,
    allowKindSwitch,
    isRecurring,
    kindItems,
    applyDaySpan,
    handleKindChange,
    handleAllDayChange,
    handleSubmit,
    startLabel,
    endLabel,
  };
}
