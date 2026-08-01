import { useTranslation } from "react-i18next";
import type { DiscordBotInfo } from "../../../types/sources";
import {
  DetailMetaGrid,
  SourceDetailDialogLayout,
  buildDiscordBotDetailFields,
} from "../../../components/detail";
import { formatAccountLabel } from "../../../utils/accountDisplay";
import { formatStatusLabel, statusDotStyle } from "../../../styles/statusDot";
import {
  discordDetailChannelListClass,
  discordDetailGuildClass,
  discordDetailGuildNameClass,
  sourceDetailSubtitleClass,
} from "../../../components/detail/classes";

interface DiscordBotDetailDialogProps {
  bot: DiscordBotInfo;
  onClose: () => void;
}

export function DiscordBotDetailDialog({ bot, onClose }: DiscordBotDetailDialogProps) {
  const { t } = useTranslation("sources");
  const fields = buildDiscordBotDetailFields(bot);
  const fallback = t("discord.fallbackName");
  const channelsByGuild = bot.channels.reduce<Record<string, string[]>>((acc, channel) => {
    const guild = channel.guildName || "Unknown";
    (acc[guild] ??= []).push(`#${channel.name.split(" / #").pop() || channel.name}`);
    return acc;
  }, {});
  return (
    <SourceDetailDialogLayout
      ariaLabel={t("discord.detailAria", {
        name: formatAccountLabel(bot.account) || fallback,
      })}
      title={
        <>
          <span style={statusDotStyle(bot.account.status)} aria-hidden="true" />
          {formatAccountLabel(bot.account) || fallback}
        </>
      }
      subtitle={t("discord.subtitle", {
        status: formatStatusLabel(bot.account.status),
        channels: t("discord.channelsCount", { count: bot.channels.length }),
      })}
      error={bot.account.lastError}
      onClose={onClose}
    >
      {Object.keys(channelsByGuild).length > 0 ? (
        Object.entries(channelsByGuild).map(([guild, names]) => (
          <div key={guild} className={discordDetailGuildClass}>
            <div className={discordDetailGuildNameClass}>{guild}</div>
            <ul className={discordDetailChannelListClass}>
              {names.map((name) => (
                <li key={`${guild}-${name}`}>{name}</li>
              ))}
            </ul>
          </div>
        ))
      ) : (
        <div className={sourceDetailSubtitleClass}>{t("discord.noChannelsYet")}</div>
      )}
      <DetailMetaGrid
        items={fields
          .filter((field) => !field.standalone)
          .map((field) => ({ label: field.label, value: field.value }))}
      />
    </SourceDetailDialogLayout>
  );
}
