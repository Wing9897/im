import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui";
import { ReconnectButton } from "./ReconnectButton";

interface SourceCardActionsProps {
  showReconnect: boolean;
  reconnecting: boolean;
  onReconnect: () => void;
  onRemove: () => void;
  removeLabel?: string;
}

/** Shared reconnect + remove action row for poll-based source cards. */
export function SourceCardActions({
  showReconnect,
  reconnecting,
  onReconnect,
  onRemove,
  removeLabel,
}: SourceCardActionsProps) {
  const { t } = useTranslation("sources");
  return (
    <>
      <ReconnectButton show={showReconnect} reconnecting={reconnecting} onReconnect={onReconnect} />
      <Button type="button" variant="danger" size="sm" onClick={onRemove}>
        {removeLabel ?? t("shared.remove")}
      </Button>
    </>
  );
}
