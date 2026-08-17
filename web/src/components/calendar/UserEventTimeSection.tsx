import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";

import {
  Button,
  FieldLabel,
  PillButton,
  TextField,
} from "../ui";
import { ToggleSwitch } from "../ToggleSwitch";
import { OvernightClockHint } from "./OvernightClockHint";
import { NowFillButton } from "./NowFillButton";
import {
  USER_EVENT_DAY_PRESETS,
  type UserEventFormValues,
} from "../../domain/timeline/userEventFormModel";

type UserEventTimeSectionProps = {
  values: UserEventFormValues;
  setValues: Dispatch<SetStateAction<UserEventFormValues>>;
  isRecurring: boolean;
  startLabel: string;
  endLabel: string;
  customDays: string;
  setCustomDays: (value: string) => void;
  onAllDayChange: (checked: boolean) => void;
  onApplyDaySpan: (days: number) => void;
  onNowFill: () => void;
  remindBeforeDaysHint?: string;
};

/** All-day toggle, duration presets, and start/end (or recurring clock) fields. */
export function UserEventTimeSection({
  values,
  setValues,
  isRecurring,
  startLabel,
  endLabel,
  customDays,
  setCustomDays,
  onAllDayChange,
  onApplyDaySpan,
  onNowFill,
  remindBeforeDaysHint,
}: UserEventTimeSectionProps) {
  const { t } = useTranslation("timeline");
  const remindHint = remindBeforeDaysHint ?? t("userEvent.remindBeforeDaysHint");

  return (
    <div
      className="flex flex-col gap-sm rounded-md border border-surface-border/70 bg-[color-mix(in_srgb,var(--surface-overlay)_35%,transparent)] px-md py-sm"
      data-testid="user-event-time-section"
    >
      <div className="flex min-w-0 items-center gap-md">
        <FieldLabel className="mb-0 min-w-0 flex-1">
          {t("userEvent.allDay")}
        </FieldLabel>
        <ToggleSwitch
          checked={values.isAllDay}
          onChange={onAllDayChange}
          label={t("userEvent.allDay")}
          showLabel={false}
          data-testid="user-event-all-day"
        />
      </div>

      {!isRecurring ? (
        <div className="flex flex-col gap-xs">
          <FieldLabel className="mb-0">{t("userEvent.durationPresets")}</FieldLabel>
          <div className="flex flex-wrap items-center gap-xs">
            {USER_EVENT_DAY_PRESETS.map((days) => (
              <PillButton
                key={days}
                type="button"
                onClick={() => onApplyDaySpan(days)}
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
                  onApplyDaySpan(Math.min(days, 366));
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
            <div className="flex min-w-0 items-center gap-xs">
              <FieldLabel className="mb-0 w-16 shrink-0" htmlFor="user-event-event-start">
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
                className="min-w-0 w-[9.5rem] max-w-full shrink-0"
                required
                data-testid="user-event-event-start"
              />
              <NowFillButton onClick={onNowFill} />
            </div>
            <div className="flex min-w-0 items-center gap-xs">
              <FieldLabel className="mb-0 w-16 shrink-0" htmlFor="user-event-event-end">
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
                className="w-[9.5rem] max-w-full shrink-0"
                data-testid="user-event-event-end"
              />
            </div>
            <OvernightClockHint
              startClock={values.eventStartTime}
              endClock={values.eventEndTime}
              testId="user-event-overnight-hint"
            />
          </div>
        ) : null
      ) : (
        <div className="flex flex-col gap-sm">
          <div className="flex min-w-0 items-center gap-xs">
            <FieldLabel className="mb-0 w-16 shrink-0" htmlFor="user-event-start">
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
              className="min-w-0 w-[16rem] max-w-full shrink-0"
              required
              data-testid="user-event-start"
            />
            <NowFillButton onClick={onNowFill} />
          </div>
          <div className="flex min-w-0 items-center gap-xs">
            <FieldLabel className="mb-0 w-16 shrink-0" htmlFor="user-event-end">
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
              className="w-[16rem] max-w-full shrink-0"
              data-testid="user-event-end"
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-xs">
        <div className="flex min-w-0 items-center gap-md">
          <FieldLabel className="mb-0 min-w-0 flex-1" htmlFor="user-event-remind-before">
            {t("userEvent.remindBeforeDays")}
          </FieldLabel>
          <TextField
            id="user-event-remind-before"
            aria-label={t("userEvent.remindBeforeDaysAria")}
            type="number"
            min={0}
            max={3660}
            inputMode="numeric"
            placeholder={t("userEvent.remindBeforeDaysPlaceholder")}
            value={values.remindBeforeDays}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, remindBeforeDays: event.target.value }))
            }
            className="w-24 max-w-24 shrink-0"
            data-testid="user-event-remind-before"
          />
        </div>
        <p className="m-0 text-caption text-text-muted">{remindHint}</p>
      </div>
    </div>
  );
}
