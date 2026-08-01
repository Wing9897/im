import type { ChannelWithAccount } from "../../types";
import { useTranslation } from "react-i18next";
import { formatMessage } from "../../i18n/formatMessage";
import {
  MSG_CHANNELS_SELECTED,
  MSG_CONFIRM_CHANNEL_SELECTION,
} from "../../i18n/messageKeys";
import { ChannelPickerDialogShell } from "../channels/ChannelPickerDialogShell";

interface ChannelSelectorDialogProps {
  open: boolean;
  channels: ChannelWithAccount[];
  selectedChannelIds: string[];
  onConfirm: (channelIds: string[]) => void;
  onClose: () => void;
}

/** Task editor channel picker — shares wall/filter picker UI and platform chips. */
export function ChannelSelectorDialog({
  open,
  channels,
  selectedChannelIds,
  onConfirm,
  onClose,
}: ChannelSelectorDialogProps) {
  const { t } = useTranslation("common");
  return (
    <ChannelPickerDialogShell
      open={open}
      title={t("channelPicker.taskTitle")}
      size="xl"
      testId="task-channel-selector-dialog"
      channels={channels}
      selectedChannelIds={selectedChannelIds}
      onConfirm={onConfirm}
      onClose={onClose}
      onCancel={onClose}
      closeAriaLabel={t("dialog.cancel")}
      summaryLabel={t("channelPicker.taskSummary")}
      platformFilterAriaLabel={t("channelPicker.taskPlatformFilterAria")}
      panelTestId="task-channel-picker-panel"
      confirmTestId="task-channel-selector-confirm"
      confirmLabel={(count) => formatMessage(MSG_CONFIRM_CHANNEL_SELECTION, { count })}
      subtitle={(draftCount) => (
        <p className="im-dialog-subtitle">
          {formatMessage(MSG_CHANNELS_SELECTED, {
            selected: draftCount,
            total: channels.length,
          })}
        </p>
      )}
    />
  );
}
