import { useState } from "react";
import { LayoutGrid } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ChannelPickerDialogShell } from "../../../components/channels/ChannelPickerDialogShell";
import type { ChannelWithAccount } from "../../../types";
import { FilterTrigger } from "../../../components/ui";

interface WallChannelPickerProps {
  channels: ChannelWithAccount[];
  selectedChannelIds: string[];
  onChange: (channelIds: string[]) => void;
  /** Compact icon control for ops-board frame header. */
  compact?: boolean;
}

/** Trigger button + modal for selecting wall monitor channels (platform → account → scope). */
export function WallChannelPicker({
  channels,
  selectedChannelIds,
  onChange,
  compact = false,
}: WallChannelPickerProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const selectedCount = selectedChannelIds.length;
  const ariaLabel =
    selectedCount > 0
      ? t("channelPicker.wallTitleWithCount", { count: selectedCount })
      : t("channelPicker.wallTitle");

  return (
    <>
      {compact ? (
        <button
          type="button"
          className={
            selectedCount > 0
              ? "board-widget-frame__btn board-widget-frame__btn--active board-wall-scope-btn"
              : "board-widget-frame__btn board-wall-scope-btn"
          }
          data-testid="wall-channel-picker-trigger"
          aria-label={ariaLabel}
          title={t("channelPicker.wallSelectScope")}
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <LayoutGrid size={12} strokeWidth={2} aria-hidden="true" />
          {selectedCount > 0 ? (
            <span className="board-task-filter__badge" aria-hidden="true">
              {selectedCount}
            </span>
          ) : null}
        </button>
      ) : (
        <FilterTrigger
          className="min-h-7 shrink-0"
          label={<LayoutGrid size={16} strokeWidth={2.5} aria-hidden="true" />}
          count={selectedCount > 0 ? selectedCount : undefined}
          active={selectedCount > 0}
          data-testid="wall-channel-picker-trigger"
          aria-label={ariaLabel}
          title={t("channelPicker.wallSelectScope")}
          aria-expanded={open}
          onClick={() => setOpen(true)}
        />
      )}

      <ChannelPickerDialogShell
        open={open}
        title={t("channelPicker.wallTitle")}
        size="wide"
        testId="wall-channel-picker-dialog"
        channels={channels}
        selectedChannelIds={selectedChannelIds}
        onConfirm={onChange}
        onClose={() => setOpen(false)}
        summaryLabel={t("platformScope.channel")}
        platformFilterAriaLabel={t("channelPicker.wallPlatformFilterAria")}
        showPlatformHelper
        panelTestId="wall-channel-picker-panel"
        confirmTestId="wall-channel-picker-apply"
        confirmLabel={t("channelPicker.wallConfirm")}
      />
    </>
  );
}
