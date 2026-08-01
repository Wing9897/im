import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { ChannelWithAccount } from "../../types";
import { Button, FieldLabel } from "../../components/ui";
import { ModalDialog } from "../ModalDialog";
import { AccountChannelPickerContent } from "./AccountChannelPickerContent";
import { PlatformFilterChips } from "./PlatformFilterChips";
import { useChannelPickerDialogState } from "./useChannelPickerDialogState";

interface ChannelPickerDialogShellProps {
  open: boolean;
  title: string;
  ariaLabel?: string;
  size?: "wide" | "xl";
  testId: string;
  channels: ChannelWithAccount[];
  selectedChannelIds: string[];
  onConfirm: (channelIds: string[]) => void;
  onClose: () => void;
  /** When set, shows a cancel button and resets the draft on close. */
  onCancel?: () => void;
  summaryLabel: string;
  platformFilterAriaLabel: string;
  showPlatformHelper?: boolean;
  subtitle?: ReactNode | ((draftCount: number) => ReactNode);
  /** Max height for the scroll list; 0 fills available modal height. */
  listMaxHeight?: number;
  panelTestId: string;
  confirmTestId: string;
  confirmLabel: string | ((draftCount: number) => string);
  closeAriaLabel?: string;
}

/** Shared modal shell for wall and task channel pickers. */
export function ChannelPickerDialogShell({
  open,
  title,
  ariaLabel,
  size = "wide",
  testId,
  channels,
  selectedChannelIds,
  onConfirm,
  onClose,
  onCancel,
  summaryLabel,
  platformFilterAriaLabel,
  showPlatformHelper = false,
  subtitle,
  listMaxHeight = 0,
  panelTestId,
  confirmTestId,
  confirmLabel,
  closeAriaLabel,
}: ChannelPickerDialogShellProps) {
  const { t } = useTranslation("common");
  const {
    platformFilter,
    setPlatformFilter,
    draftIds,
    setDraftIds,
    resetDraft,
    platforms,
    visibleChannels,
  } = useChannelPickerDialogState(channels, selectedChannelIds, open);

  const handleClose = () => {
    if (onCancel) {
      resetDraft();
      onCancel();
    } else {
      onClose();
    }
  };

  const handleConfirm = () => {
    onConfirm(draftIds);
    onClose();
  };

  const resolvedConfirmLabel =
    typeof confirmLabel === "function" ? confirmLabel(draftIds.length) : confirmLabel;

  const resolvedSubtitle =
    typeof subtitle === "function" ? subtitle(draftIds.length) : subtitle;

  return (
    <ModalDialog
      open={open}
      title={title}
      ariaLabel={ariaLabel ?? title}
      size={size}
      onClose={handleClose}
      closeAriaLabel={closeAriaLabel}
      testId={testId}
      bodyClassName="im-picker-dialog-body"
      footerJustify={draftIds.length > 0 ? "space-between" : "flex-end"}
      footer={
        <>
          {draftIds.length > 0 ? (
            <Button
              variant="secondary"
              onClick={() => setDraftIds([])}
              aria-label={t("channelPicker.clearAllAria")}
            >
              {t("channelPicker.clearSelection")}
            </Button>
          ) : null}
          {onCancel ? (
            <span className="im-dialog-footer-actions">
              <Button variant="secondary" onClick={handleClose}>
                {t("dialog.cancel")}
              </Button>
              <Button
                variant="primary"
                data-testid={confirmTestId}
                onClick={handleConfirm}
              >
                {resolvedConfirmLabel}
              </Button>
            </span>
          ) : (
            <Button
              variant="primary"
              data-testid={confirmTestId}
              onClick={handleConfirm}
            >
              {resolvedConfirmLabel}
            </Button>
          )}
        </>
      }
    >
      <div className="im-channel-picker-dialog">
        {resolvedSubtitle}

        {platforms.length > 1 && (
          <div className="im-channel-picker-platforms">
            <FieldLabel>{t("channelPicker.platformLabel")}</FieldLabel>
            {showPlatformHelper ? (
              <p className="im-channel-picker-helper">{t("channelPicker.platformHelper")}</p>
            ) : null}
            <PlatformFilterChips
              platforms={platforms}
              selectedPlatform={platformFilter}
              onSelect={(platform) => setPlatformFilter(platform ?? "")}
              ariaLabel={platformFilterAriaLabel}
            />
          </div>
        )}

        <AccountChannelPickerContent
          channels={visibleChannels}
          selectedIds={draftIds}
          onChange={setDraftIds}
          summaryLabel={summaryLabel}
          emptyMessage={
            platformFilter
              ? t("channelPicker.emptyForPlatform")
              : t("channelPicker.emptyNeedSources")
          }
          searchable={channels.length > 6}
          hidePlatformHeaders={Boolean(platformFilter)}
          fillAvailableHeight={listMaxHeight <= 0}
          listMaxHeight={listMaxHeight > 0 ? listMaxHeight : 320}
          testId={panelTestId}
        />
      </div>
    </ModalDialog>
  );
}
