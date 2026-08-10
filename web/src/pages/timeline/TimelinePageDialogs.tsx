import { useTranslation } from "react-i18next";

import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog";
import {
  UserEventDialog,
  type UserEventFormValues,
} from "../../components/calendar/UserEventDialog";
import { toUserEventFormWorksetId } from "../../domain/timeline/userEvents";
import type { TimelineItem } from "../../types";
import type { PendingTimelineConfirm } from "./useTimelinePageDialogs";

type WorksetOption = { id: string; name: string };

type Props = {
  dialogOpen: boolean;
  dialogMode: "create" | "edit";
  editingEvent: TimelineItem | null;
  createInitial: Partial<UserEventFormValues> | null;
  dialogBusy: boolean;
  dialogError: string | null;
  worksetOptions: WorksetOption[];
  pendingConfirm: PendingTimelineConfirm | null;
  userEventActionBusy: boolean;
  onCloseDialog: () => void;
  onSubmitDialog: (values: UserEventFormValues) => void;
  onCancelConfirm: () => void;
  onConfirmPending: () => void;
};

/** User-event dialog + dismiss/restore confirm layer for TimelinePage. */
export function TimelinePageDialogs({
  dialogOpen,
  dialogMode,
  editingEvent,
  createInitial,
  dialogBusy,
  dialogError,
  worksetOptions,
  pendingConfirm,
  userEventActionBusy,
  onCloseDialog,
  onSubmitDialog,
  onCancelConfirm,
  onConfirmPending,
}: Props) {
  const { t } = useTranslation("timeline");
  const { t: tc } = useTranslation("common");

  const scopedItemId = (
    editingEvent
      ? editingEvent.itemId?.trim()
      : createInitial?.itemId?.trim()
  ) || "";
  const parentItemMode = scopedItemId ? "readonly" : "hidden";

  return (
    <>
      <UserEventDialog
        open={dialogOpen}
        mode={dialogMode}
        worksetOptions={worksetOptions}
        parentItemMode={parentItemMode}
        initial={
          editingEvent
            ? {
                title: editingEvent.title,
                startTime: editingEvent.startTime ?? "",
                endTime: editingEvent.endTime ?? "",
                location: editingEvent.location ?? "",
                body: editingEvent.body ?? "",
                worksetId: toUserEventFormWorksetId(editingEvent.worksetId),
                isAllDay: Boolean(editingEvent.isAllDay),
                remindBeforeDays:
                  editingEvent.remindBeforeDays != null
                    ? String(editingEvent.remindBeforeDays)
                    : "",
                itemId: editingEvent.itemId?.trim() ?? "",
              }
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

      {pendingConfirm ? (
        <ConfirmDialog
          title={
            pendingConfirm.kind === "dismiss"
              ? t("detail.dismiss")
              : t("detail.restore")
          }
          body={
            pendingConfirm.kind === "dismiss"
              ? t("messages.dismissConfirm", { title: pendingConfirm.event.title })
              : t("messages.restoreConfirm", { title: pendingConfirm.event.title })
          }
          confirmLabel={tc("dialog.confirm")}
          confirmBusyLabel={tc("dialog.confirm")}
          busy={userEventActionBusy}
          onCancel={onCancelConfirm}
          onConfirm={onConfirmPending}
        />
      ) : null}
    </>
  );
}
