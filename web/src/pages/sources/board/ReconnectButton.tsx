import { useTranslation } from "react-i18next";
import { Button } from "../../../components/ui";

interface ReconnectButtonProps {
  /**
   * Whether the reconnect control should be shown. Mirrors the previous
   * per-card `showError` guard (status === "error" || "disconnected").
   */
  show: boolean;
  /** True while a reconnect attempt is in flight — dims and disables the button. */
  reconnecting: boolean;
  /** Optional external disable (e.g. while a bulk refresh is running). */
  disabled?: boolean;
  /** Reconnect handler from `useReconnectCard` (returns void). */
  onReconnect: () => void;
}

/**
 * Shared reconnect control used by RssFeedCard / MqttBrokerCard /
 * DiscordBotCard. Renders nothing unless `show` is true. Behavior is a
 * byte-for-byte extraction of the button previously inlined in each card:
 * secondary button styling, dim+disable while reconnecting, and the
 * fire-and-forget onClick wrapper.
 */
export function ReconnectButton({
  show,
  reconnecting,
  disabled = false,
  onReconnect,
}: ReconnectButtonProps) {
  const { t } = useTranslation("sources");
  if (!show) return null;
  const isDisabled = reconnecting || disabled;
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={isDisabled}
      onClick={() => void Promise.resolve(onReconnect()).catch(() => {})}
    >
      {reconnecting ? t("shared.reconnectingShort") : t("shared.reconnect")}
    </Button>
  );
}
