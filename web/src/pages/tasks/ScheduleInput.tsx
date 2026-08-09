import type React from "react";
import { useTranslation } from "react-i18next";
import { FieldLabel, FormStack, SelectField, TextField } from "../../components/ui";
import { formHelpClass } from "../../components/ui/pageTypography";
import { isUnmappedTriggerSchedule } from "../../domain/tasks/triggerSchedule";
import i18n from "../../i18n";
import type { ScheduleType } from "../../types";

export type { ScheduleType } from "../../types";
export { isUnmappedTriggerSchedule } from "../../domain/tasks/triggerSchedule";

/** FE preset UI for AI trigger schedules (persisted as scheduleRrule server-side). */

const SCHEDULE_TYPES: ScheduleType[] = [
  "seconds_10",
  "hourly",
  "daily",
  "weekly",
  "custom_seconds",
];

const WEEKDAY_VALUES = ["0", "1", "2", "3", "4", "5", "6"] as const;

/** Schedule types that pair the type select with a value field side-by-side. */
const PAIR_VALUE_WITH_TYPE: ReadonlySet<ScheduleType> = new Set(["daily", "custom_seconds"]);

export function validateScheduleValue(
  scheduleType: ScheduleType,
  scheduleValue: string | null,
): string | null {
  switch (scheduleType) {
    case "seconds_10":
    case "hourly":
      return null;

    case "daily": {
      if (!scheduleValue) return String(i18n.t("tasks.schedule.errors.dailyRequired"));
      const match = /^(\d{2}):(\d{2})$/.exec(scheduleValue);
      if (!match) return String(i18n.t("tasks.schedule.errors.dailyFormat"));
      const hh = parseInt(match[1], 10);
      const mm = parseInt(match[2], 10);
      if (hh < 0 || hh > 23) return String(i18n.t("tasks.schedule.errors.hourRange"));
      if (mm < 0 || mm > 59) return String(i18n.t("tasks.schedule.errors.minuteRange"));
      return null;
    }

    case "weekly": {
      if (!scheduleValue) return String(i18n.t("tasks.schedule.errors.weeklyRequired"));
      const match = /^(\d):(\d{2}):(\d{2})$/.exec(scheduleValue);
      if (!match) return String(i18n.t("tasks.schedule.errors.weeklyFormat"));
      const d = parseInt(match[1], 10);
      const hh = parseInt(match[2], 10);
      const mm = parseInt(match[3], 10);
      if (d < 0 || d > 6) return String(i18n.t("tasks.schedule.errors.weekdayRange"));
      if (hh < 0 || hh > 23) return String(i18n.t("tasks.schedule.errors.hourRange"));
      if (mm < 0 || mm > 59) return String(i18n.t("tasks.schedule.errors.minuteRange"));
      return null;
    }

    case "custom_seconds": {
      if (!scheduleValue) return String(i18n.t("tasks.schedule.errors.secondsRequired"));
      const num = Number(scheduleValue);
      if (!Number.isInteger(num) || num <= 0) {
        return String(i18n.t("tasks.schedule.errors.secondsPositive"));
      }
      return null;
    }

    default:
      return null;
  }
}

interface ScheduleInputProps {
  scheduleType: ScheduleType;
  scheduleValue: string | null;
  /** Canonical trigger RRULE; when unmappable to presets, shown read-only. */
  scheduleRrule?: string | null;
  onScheduleTypeChange: (type: ScheduleType) => void;
  onScheduleValueChange: (value: string | null) => void;
  validationError?: string | null;
  /** Project-mode: show project wave interval after schedule fields. */
  showAgentWaveInterval?: boolean;
  agentWaveIntervalSeconds?: string;
  onProjectWaveIntervalSecondsChange?: (value: string) => void;
  onProjectWaveIntervalSecondsCommit?: (value: string) => void;
}

function parseWeeklyValue(value: string | null): { day: string; time: string } {
  if (!value) return { day: "0", time: "" };
  const match = /^(\d):(\d{2}:\d{2})$/.exec(value);
  if (match) return { day: match[1], time: match[2] };
  return { day: "0", time: "" };
}

function ScheduleError({ message }: { message: string }) {
  return <p className={`${formHelpClass} text-error`}>{message}</p>;
}

function FieldStack({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-xs">{children}</div>;
}

export function ScheduleInput({
  scheduleType,
  scheduleValue,
  scheduleRrule = null,
  onScheduleTypeChange,
  onScheduleValueChange,
  validationError,
  showAgentWaveInterval = false,
  agentWaveIntervalSeconds = "20",
  onProjectWaveIntervalSecondsChange,
  onProjectWaveIntervalSecondsCommit,
}: ScheduleInputProps) {
  const { t } = useTranslation("common");
  const error = validationError ?? validateScheduleValue(scheduleType, scheduleValue);
  const showError =
    (scheduleType === "daily" ||
      scheduleType === "weekly" ||
      scheduleType === "custom_seconds") &&
    error !== null;
  const unmappedRrule = isUnmappedTriggerSchedule(scheduleType, scheduleValue, scheduleRrule);
  const wireRrule = scheduleRrule?.trim() || "";

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as ScheduleType;
    onScheduleTypeChange(newType);
    if (newType === "seconds_10" || newType === "hourly") {
      onScheduleValueChange(null);
      return;
    }
    onScheduleValueChange("");
  };

  const typeSelect = (
    <FieldStack>
      <FieldLabel htmlFor="schedule-type">{t("tasks.schedule.typeLabel")}</FieldLabel>
      <SelectField
        id="schedule-type"
        value={unmappedRrule ? "" : scheduleType}
        onChange={handleTypeChange}
        aria-label={t("tasks.schedule.typeAria")}
      >
        {unmappedRrule ? (
          <option value="" disabled>
            {t("tasks.schedule.unmappedOption")}
          </option>
        ) : null}
        {SCHEDULE_TYPES.map((value) => (
          <option key={value} value={value}>
            {t(`tasks.schedule.types.${value}`)}
          </option>
        ))}
      </SelectField>
    </FieldStack>
  );

  const unmappedBanner = unmappedRrule ? (
    <FieldStack>
      <p className={formHelpClass}>{t("tasks.schedule.unmappedHelp")}</p>
      <code
        className="block break-all rounded-md border border-surface-border bg-surface-base px-sm py-xs text-caption text-text-primary"
        data-testid="schedule-unmapped-rrule"
      >
        {wireRrule}
      </code>
    </FieldStack>
  ) : null;

  let valueField: React.ReactNode = null;
  if (!unmappedRrule) {
    switch (scheduleType) {
      case "daily":
        valueField = (
          <FieldStack>
            <FieldLabel htmlFor="schedule-daily-time">{t("tasks.schedule.dailyTime")}</FieldLabel>
            <TextField
              id="schedule-daily-time"
              type="time"
              value={scheduleValue ?? ""}
              onChange={(e) => onScheduleValueChange(e.target.value)}
              aria-label={t("tasks.schedule.dailyTimeAria")}
            />
            {showError && error ? <ScheduleError message={error} /> : null}
          </FieldStack>
        );
        break;

      case "weekly": {
        const { day, time } = parseWeeklyValue(scheduleValue);
        valueField = (
          <FieldStack>
            <FieldLabel>{t("tasks.schedule.weeklyDateTime")}</FieldLabel>
            <div className="flex items-start gap-sm">
              <SelectField
                className="w-auto shrink-0"
                value={day}
                onChange={(e) => {
                  const newDay = e.target.value;
                  onScheduleValueChange(time ? `${newDay}:${time}` : `${newDay}:`);
                }}
                aria-label={t("tasks.schedule.weekdayAria")}
              >
                {WEEKDAY_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {t(`tasks.schedule.weekday.${value}`)}
                  </option>
                ))}
              </SelectField>
              <TextField
                id="schedule-weekly-time"
                type="time"
                className="min-w-0 flex-1"
                value={time}
                onChange={(e) => onScheduleValueChange(`${day}:${e.target.value}`)}
                aria-label={t("tasks.schedule.weeklyTimeAria")}
              />
            </div>
            {showError && error ? <ScheduleError message={error} /> : null}
          </FieldStack>
        );
        break;
      }

      case "custom_seconds":
        valueField = (
          <FieldStack>
            <FieldLabel htmlFor="schedule-custom-seconds">
              {t("tasks.schedule.customSeconds")}
            </FieldLabel>
            <TextField
              id="schedule-custom-seconds"
              type="number"
              placeholder={t("tasks.schedule.customSecondsPlaceholder")}
              min={1}
              step={1}
              value={scheduleValue ?? ""}
              onChange={(e) => onScheduleValueChange(e.target.value)}
              aria-label={t("tasks.schedule.customSecondsAria")}
            />
            {showError && error ? <ScheduleError message={error} /> : null}
          </FieldStack>
        );
        break;

      default:
        break;
    }
  }

  const scheduleFields =
    valueField && PAIR_VALUE_WITH_TYPE.has(scheduleType) ? (
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 sm:items-start">
        {typeSelect}
        {valueField}
      </div>
    ) : (
      <>
        {typeSelect}
        {valueField}
      </>
    );

  return (
    <FormStack gap="lg">
      {unmappedBanner}
      {scheduleFields}
      {showAgentWaveInterval ? (
        <FieldStack>
          <div className="border-t border-surface-border/70 pt-md">
            <FieldLabel htmlFor="schedule-project-wave-interval">
              {t("tasks.schedule.agentWaveInterval")}
            </FieldLabel>
            <TextField
              id="schedule-project-wave-interval"
              data-testid="schedule-project-wave-interval"
              className="mt-xs"
              type="number"
              min={0}
              max={600}
              step={1}
              value={agentWaveIntervalSeconds}
              onChange={(e) => onProjectWaveIntervalSecondsChange?.(e.target.value)}
              onBlur={(e) => onProjectWaveIntervalSecondsCommit?.(e.target.value)}
              aria-label={t("tasks.schedule.agentWaveIntervalAria")}
              placeholder="20"
            />
            <p className={formHelpClass}>{t("tasks.schedule.agentWaveIntervalHelp")}</p>
          </div>
        </FieldStack>
      ) : null}
    </FormStack>
  );
}
