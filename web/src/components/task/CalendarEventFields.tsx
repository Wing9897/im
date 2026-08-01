import { CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FieldLabel, SurfaceCard, TextArea, TextField } from "../ui";
import { InfoTooltip } from "../common/InfoTooltip";
import { sectionTitleClass } from "../ui/pageTypography";

interface CalendarEventFieldsProps {
  /** Event title — reuses the task `name` column */
  name: string;
  onNameChange: (value: string) => void;
  /** Event start time as "HH:MM" (ignored when all-day) */
  eventStartTime: string;
  onEventStartTimeChange: (value: string) => void;
  /** Event end time as "HH:MM" (ignored when all-day) */
  eventEndTime: string;
  onEventEndTimeChange: (value: string) => void;
  /** Whether the event spans the whole day */
  eventIsAllDay: boolean;
  onEventIsAllDayChange: (value: boolean) => void;
  /** Optional event location */
  eventLocation: string;
  onEventLocationChange: (value: string) => void;
  /** Optional event description */
  eventDescription: string;
  onEventDescriptionChange: (value: string) => void;
  isBusy?: boolean;
}

/**
 * Calendar-specific event detail fields shown when the task is in `calendar`
 * analysis mode. Renders the event title, start/end time, an all-day toggle,
 * location, and description. The start and end time inputs are hidden while the
 * all-day toggle is enabled (Requirement 3.2).
 */
export function CalendarEventFields({
  name,
  onNameChange,
  eventStartTime,
  onEventStartTimeChange,
  eventEndTime,
  onEventEndTimeChange,
  eventIsAllDay,
  onEventIsAllDayChange,
  eventLocation,
  onEventLocationChange,
  eventDescription,
  onEventDescriptionChange,
  isBusy = false,
}: CalendarEventFieldsProps) {
  const { t } = useTranslation();

  return (
    <SurfaceCard className="p-xl" data-testid="calendar-event-fields">
      <div className={`mb-lg flex items-center gap-sm ${sectionTitleClass}`}>
        <CalendarDays size={20} strokeWidth={2} aria-hidden="true" />
        <span>{t("tasks.calendarFields.section")}</span>
        <InfoTooltip content={t("tasks.calendarFields.tooltip")} />
      </div>

      <div className="flex flex-col gap-2xl">
        <div>
          <FieldLabel htmlFor="calendar-event-title">{t("tasks.calendarFields.title")}</FieldLabel>
          <TextField
            id="calendar-event-title"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t("tasks.calendarFields.titlePlaceholder")}
            disabled={isBusy}
            maxLength={200}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="calendar-event-all-day"
            type="checkbox"
            checked={eventIsAllDay}
            onChange={(e) => onEventIsAllDayChange(e.target.checked)}
            disabled={isBusy}
          />
          <FieldLabel htmlFor="calendar-event-all-day" className="mb-0">
            {t("tasks.calendarFields.allDay")}
          </FieldLabel>
        </div>

        {!eventIsAllDay && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2xl">
            <div>
              <FieldLabel htmlFor="calendar-event-start">{t("tasks.calendarFields.start")}</FieldLabel>
              <TextField
                id="calendar-event-start"
                type="time"
                value={eventStartTime}
                onChange={(e) => onEventStartTimeChange(e.target.value)}
                disabled={isBusy}
              />
            </div>
            <div>
              <FieldLabel htmlFor="calendar-event-end">{t("tasks.calendarFields.end")}</FieldLabel>
              <TextField
                id="calendar-event-end"
                type="time"
                value={eventEndTime}
                onChange={(e) => onEventEndTimeChange(e.target.value)}
                disabled={isBusy}
              />
            </div>
          </div>
        )}

        <div>
          <FieldLabel htmlFor="calendar-event-location">{t("tasks.calendarFields.location")}</FieldLabel>
          <TextField
            id="calendar-event-location"
            value={eventLocation}
            onChange={(e) => onEventLocationChange(e.target.value)}
            placeholder={t("tasks.calendarFields.locationPlaceholder")}
            disabled={isBusy}
            maxLength={500}
          />
        </div>

        <div>
          <FieldLabel htmlFor="calendar-event-description">
            {t("tasks.calendarFields.description")}
          </FieldLabel>
          <TextArea
            id="calendar-event-description"
            value={eventDescription}
            onChange={(e) => onEventDescriptionChange(e.target.value)}
            placeholder={t("tasks.calendarFields.descriptionPlaceholder")}
            disabled={isBusy}
            maxLength={10000}
          />
        </div>
      </div>

      {eventIsAllDay && (
        <p className="mt-md text-xs leading-normal text-text-muted">
          {t("tasks.calendarFields.allDayHint")}
        </p>
      )}
    </SurfaceCard>
  );
}
