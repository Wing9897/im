import {
  UserEventDialog,
  type UserEventFormValues,
} from "../../components/calendar/UserEventDialog";
import { timelineItemToFormInitial } from "../../domain/timeline/userEventFormMapping";
import { toUserEventFormWorksetId } from "../../domain/timeline/userEvents";
import type { TimelineItem } from "../../types";

type WorksetOption = { id: string; name: string };

type Props = {
  dialogOpen: boolean;
  dialogMode: "create" | "edit";
  editingEvent: TimelineItem | null;
  createInitial: Partial<UserEventFormValues> | null;
  dialogBusy: boolean;
  dialogError: string | null;
  worksetOptions: WorksetOption[];
  onCloseDialog: () => void;
  onSubmitDialog: (values: UserEventFormValues) => void;
};

/** User-event dialog layer for TimelinePage. */
export function TimelinePageDialogs({
  dialogOpen,
  dialogMode,
  editingEvent,
  createInitial,
  dialogBusy,
  dialogError,
  worksetOptions,
  onCloseDialog,
  onSubmitDialog,
}: Props) {
  return (
    <UserEventDialog
      open={dialogOpen}
      mode={dialogMode}
      worksetOptions={worksetOptions}
      initial={
        editingEvent
          ? timelineItemToFormInitial(editingEvent)
          : {
              worksetId: toUserEventFormWorksetId(createInitial?.worksetId),
              isAllDay: Boolean(createInitial?.isAllDay),
              startTime: createInitial?.startTime ?? "",
              endTime: createInitial?.endTime ?? "",
              itemId: createInitial?.itemId ?? "",
              remindBeforeDays: createInitial?.remindBeforeDays ?? "",
              calendarKind: "normal",
            }
      }
      busy={dialogBusy}
      error={dialogError}
      onClose={onCloseDialog}
      onSubmit={onSubmitDialog}
    />
  );
}
