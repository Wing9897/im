import { useTranslation } from "react-i18next";
import { CalendarEventFields } from "../../../components/task/CalendarEventFields";
import { RecurrenceRuleEditor } from "../../../components/task/RecurrenceRuleEditor";
import type { TaskFormState } from "./useChatEditor";

interface ChatCalendarFieldsProps {
  formState: TaskFormState;
  updateField: <K extends keyof TaskFormState>(field: K, value: TaskFormState[K]) => void;
}

export function ChatCalendarFields({
  formState,
  updateField,
}: ChatCalendarFieldsProps) {
  const { t } = useTranslation("common");
  return (
    <>
      <CalendarEventFields
        name={formState.name}
        onNameChange={(v) => updateField("name", v)}
        eventStartTime={formState.eventStartTime}
        onEventStartTimeChange={(v) => updateField("eventStartTime", v)}
        eventEndTime={formState.eventEndTime}
        onEventEndTimeChange={(v) => updateField("eventEndTime", v)}
        eventIsAllDay={formState.eventIsAllDay}
        onEventIsAllDayChange={(v) => updateField("eventIsAllDay", v)}
        eventLocation={formState.eventLocation}
        onEventLocationChange={(v) => updateField("eventLocation", v)}
        eventDescription={formState.eventDescription}
        onEventDescriptionChange={(v) => updateField("eventDescription", v)}
      />
      <p
        role="note"
        className="mt-sm text-caption leading-normal text-text-secondary"
      >
        {t("tasks.editor.rruleHint")}
      </p>
      <RecurrenceRuleEditor
        value={formState.rrule || ""}
        onChange={(rruleStr: string) => updateField("rrule", rruleStr)}
      />
    </>
  );
}
