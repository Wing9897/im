import { useTranslation } from "react-i18next";
import { PlatformIcon } from "../../components/common/PlatformIcon";
import { SelectTile, SelectTileGrid } from "../../components/ui";
import type { ActionType } from "../../types";

const channelOptions: { value: ActionType; label: string; platform: string }[] = [
  { value: "telegram_bot", label: "Telegram Bot", platform: "telegram" },
  { value: "discord_webhook", label: "Discord Webhook", platform: "discord" },
  { value: "http_webhook", label: "HTTP Webhook", platform: "api" },
  { value: "mqtt", label: "MQTT", platform: "mqtt" },
];

export function ActionTypeSelector({
  value,
  onChange,
  disabled,
}: {
  value: ActionType | null;
  onChange: (type: ActionType) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation("actions");

  return (
    <div className="flex flex-col gap-sm" role="group" aria-label={t("types.selectTypeAria")}>
      <SelectTileGrid columns="repeat(auto-fit, minmax(140px, 1fr))" className="gap-md">
        {channelOptions.map((option) => (
          <SelectTile
            key={option.value}
            active={value === option.value}
            aria-pressed={value === option.value}
            onClick={() => !disabled && onChange(option.value)}
            className={[
              "px-sm py-md text-center",
              disabled ? "pointer-events-none opacity-50" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="flex flex-col items-center gap-sm">
              <PlatformIcon platform={option.platform} size={26} />
              <span className="text-sm leading-snug">{option.label}</span>
            </span>
          </SelectTile>
        ))}
      </SelectTileGrid>
      {value === null ? (
        <p className="mt-1 text-caption text-text-muted">{t("types.selectTypeHint")}</p>
      ) : null}
    </div>
  );
}

