/**
 * Channel selector sub-component for the ChatEditorForm.
 */
import { useMemo } from "react";
import { ChevronDown, LayoutGrid } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PlatformTag } from "../../../components/common/PlatformTag";
import { FieldLabel, FilterTrigger } from "../../../components/ui";
import type { ChannelWithSource } from "../../../types";

interface ChatChannelSelectorProps {
  channelIds: string[];
  channels: ChannelWithSource[];
  onOpenChannelDialog: () => void;
  /** When true, label shows optional (agent schedule / threshold vs required cursor). */
  optional?: boolean;
}

export function ChatChannelSelector({
  channelIds,
  channels,
  onOpenChannelDialog,
  optional = false,
}: ChatChannelSelectorProps) {
  const { t } = useTranslation("common");
  const selectedChannels = useMemo(
    () => channels.filter((ch) => channelIds.includes(ch.id)),
    [channels, channelIds],
  );
  const displayChannels = selectedChannels.slice(0, 3);
  const remainingChannelCount = Math.max(0, selectedChannels.length - 3);

  const label =
    channelIds.length === 0
      ? t("tasks.editor.pickChannels")
      : t("tasks.editor.channelsSelected", {
          selected: channelIds.length,
          total: channels.length,
        });

  return (
    <div className="flex flex-col gap-sm">
      <div className="col-span-full flex w-full flex-col gap-xs">
        <FieldLabel>
          {optional ? t("tasks.editor.channelsLabelOptional") : t("tasks.editor.channelsLabel")}
        </FieldLabel>
        <FilterTrigger
          label={
            <span className="inline-flex items-center gap-1.5">
              <LayoutGrid size={16} strokeWidth={2} aria-hidden="true" />
              {label}
              <ChevronDown size={16} strokeWidth={2} aria-hidden="true" className="opacity-70" />
            </span>
          }
          count={channelIds.length > 0 ? channelIds.length : undefined}
          active={channelIds.length > 0}
          onClick={onOpenChannelDialog}
          aria-label={t("tasks.editor.channelsAria")}
          data-testid="channel-picker-button"
        />

        {selectedChannels.length > 0 && (
          <div className="mt-xs rounded-md border border-surface-border bg-[color-mix(in_srgb,var(--surface-card)_65%,transparent)] px-sm py-xs">
            <div className="mb-xs text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              {t("tasks.editor.channelsPreview")}
            </div>
            <div className="flex flex-col gap-xs">
              {displayChannels.map((channel) => (
                <div key={channel.id} className="flex items-center gap-sm text-xs text-text-primary">
                  <PlatformTag platform={channel.platform} size={9} />
                  <span className="min-w-0 truncate" title={channel.channelName}>
                    {channel.channelName}
                  </span>
                </div>
              ))}
              {remainingChannelCount > 0 && (
                <div className="text-xs italic text-text-muted">
                  {t("tasks.editor.channelsMore", { count: remainingChannelCount })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
