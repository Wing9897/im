import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { SourceCard, SourceCardErrorLines } from "../board/SourceCard";
import { ReconnectButton } from "../board/ReconnectButton";
import { subscribeDiscordChannels } from "../../../api/sources";
import { Button } from "../../../components/ui";
import type { DiscordBotInfo, DiscordChannelInfo } from "../../../types";
import { toErrorMessage } from "../../../utils/errors";
import { formatSourceLabel } from "../../../utils/sourceDisplay";
import { useToast } from "../../../context/ToastContext";
import { usePersistedState } from "../../../hooks/usePersistedState";
import { useReconnectCard } from "../board/useReconnectCard";
import { DISCORD_CHANNELS_EXPANDED_STORAGE_KEY } from "../../../domain/prefs";

interface DiscordBotCardProps {
  bot: DiscordBotInfo;
  onRemoveClick: () => void;
  onEditClick: () => void;
  onSelectClick: () => void;
  onReconnectSuccess: () => void;
}

export function DiscordBotCard({
  bot,
  onRemoveClick,
  onEditClick,
  onSelectClick,
  onReconnectSuccess,
}: DiscordBotCardProps) {
  const { t } = useTranslation("sources");
  const status = bot.source.status;
  const name = formatSourceLabel(bot.source) || t("discord.fallbackName");
  const showError = status === "error" || status === "disconnected";

  const { reconnecting, reconnectError, handleReconnect } = useReconnectCard({
    sourceId: bot.source.id,
    onReconnectSuccess,
  });
  const { showToast } = useToast();

  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(() => {
    return new Set(bot.channels.map((ch) => ch.platformChannelId));
  });
  const [subscribing, setSubscribing] = useState(false);
  const [expandedByBot, setExpandedByBot] = usePersistedState<Record<string, boolean>>(
    DISCORD_CHANNELS_EXPANDED_STORAGE_KEY,
    {},
  );
  const channelsExpanded = expandedByBot[bot.source.id] ?? false;
  const setChannelsExpanded = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setExpandedByBot((prev) => {
        const current = prev[bot.source.id] ?? false;
        const value = typeof next === "function" ? next(current) : next;
        if (value === current) return prev;
        return { ...prev, [bot.source.id]: value };
      });
    },
    [bot.source.id, setExpandedByBot],
  );

  const handleChannelToggle = useCallback(
    async (channelId: string) => {
      const next = new Set(selectedChannels);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      setSelectedChannels(next);
      setSubscribing(true);
      try {
        await subscribeDiscordChannels(bot.source.id, Array.from(next));
      } catch (e) {
        setSelectedChannels(selectedChannels);
        showToast(toErrorMessage(e), "error");
      } finally {
        setSubscribing(false);
      }
    },
    [bot.source.id, selectedChannels, showToast],
  );

  const channelsByGuild = bot.channels.reduce<Record<string, DiscordChannelInfo[]>>(
    (acc, ch) => {
      const guild = ch.guildName || "Unknown";
      const group = acc[guild] ?? [];
      group.push(ch);
      acc[guild] = group;
      return acc;
    },
    {},
  );

  const subtitle = (
    <>
      {t("discord.botSubtitle")}
      {bot.channels.length > 0 &&
        ` · ${t("discord.channelsCount", { count: bot.channels.length })}`}
    </>
  );

  const actions = (
    <>
      <Button size="sm" variant="secondary" onClick={onEditClick}>
        {t("shared.edit")}
      </Button>
      <ReconnectButton
        show={showError}
        reconnecting={reconnecting}
        onReconnect={handleReconnect}
      />
      <Button variant="danger" size="sm" onClick={onRemoveClick}>
        {t("shared.remove")}
      </Button>
    </>
  );

  return (
    <SourceCard
      platform="discord"
      status={status}
      title={name}
      subtitle={subtitle}
      actions={actions}
      onSelect={onSelectClick}
    >
      <SourceCardErrorLines
        status={status}
        sourceLastError={bot.source.lastError}
        reconnectError={reconnectError}
      />

      {status === "connected" && bot.channels.length > 0 ? (
        <>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-1.5 rounded-sm border-none bg-transparent pt-1.5 text-left text-xs font-semibold text-text-secondary transition-colors hover:bg-[color-mix(in_srgb,var(--surface-overlay)_60%,transparent)] hover:text-text-primary"
            aria-expanded={channelsExpanded}
            onClick={() => setChannelsExpanded((value) => !value)}
          >
            <ChevronDown
              size={14}
              strokeWidth={2}
              aria-hidden="true"
              className={`[transition:transform_150ms_ease] ${channelsExpanded ? "rotate-180" : ""}`}
            />
            {t("discord.channelsCount", { count: bot.channels.length })}
            {subscribing ? t("discord.updating") : ""}
          </button>

          {channelsExpanded ? (
            <div className="pt-sm">
              {Object.entries(channelsByGuild).map(([guildName, channels]) => (
                <div key={guildName} className="mb-2">
                  <div className="mb-xs text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    {guildName}
                  </div>
                  {channels.map((ch) => (
                    <label
                      key={ch.platformChannelId}
                      className="flex min-w-0 cursor-pointer items-center gap-1.5 py-[3px] text-sm text-text-primary"
                    >
                      <input
                        type="checkbox"
                        className="shrink-0"
                        checked={selectedChannels.has(ch.platformChannelId)}
                        onChange={() => void handleChannelToggle(ch.platformChannelId).catch(() => {})}
                        disabled={subscribing}
                      />
                      <span className="truncate">
                        #{ch.name.split(" / #").pop() || ch.name}
                      </span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </SourceCard>
  );
}
