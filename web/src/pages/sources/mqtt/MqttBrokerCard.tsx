import { useTranslation } from "react-i18next";
import { SourceCard, SourceCardErrorLines } from "../board/SourceCard";
import { SourceCardActions } from "../board/SourceCardActions";
import { Button } from "../../../components/ui";
import { formatOsDateTime } from "../../../utils/time";
import type { MqttBrokerInfo } from "../../../types";
import { useReconnectCard } from "../board/useReconnectCard";

interface MqttBrokerCardProps {
  broker: MqttBrokerInfo;
  onEditClick: () => void;
  onRemoveClick: () => void;
  onSelectClick: () => void;
  onReconnectSuccess: () => void;
}

export function MqttBrokerCard({
  broker,
  onEditClick,
  onRemoveClick,
  onSelectClick,
  onReconnectSuccess,
}: MqttBrokerCardProps) {
  const { t } = useTranslation("sources");
  const status = broker.source.status;
  const showError = status === "error" || status === "disconnected";

  const { reconnecting, reconnectError, handleReconnect } = useReconnectCard({
    sourceId: broker.source.id,
    onReconnectSuccess,
  });

  const topicCount = broker.topics.length;

  const subtitle = (
    <>
      <span
        className="block overflow-hidden text-ellipsis whitespace-nowrap break-all"
        title={broker.brokerUrl}
      >
        {broker.brokerUrl}
        {topicCount > 0 && ` · ${t("mqtt.topicsCount", { count: topicCount })}`}
        {broker.lastSuccessAt && status === "connected" && (
          <>
            {" "}
            · {t("mqtt.lastSuccessInline", { time: formatOsDateTime(broker.lastSuccessAt) })}
          </>
        )}
      </span>
      <SourceCardErrorLines
        status={status}
        lastError={broker.lastError}
        sourceLastError={broker.source.lastError}
        reconnectError={reconnectError}
      />
    </>
  );

  const actions = (
    <>
      <Button size="sm" variant="secondary" onClick={onEditClick}>
        {t("shared.edit")}
      </Button>
      <SourceCardActions
        showReconnect={showError}
        reconnecting={reconnecting}
        onReconnect={handleReconnect}
        onRemove={onRemoveClick}
      />
    </>
  );

  return (
    <SourceCard
      platform="mqtt"
      status={status}
      title={broker.brokerUrl || t("mqtt.fallbackName")}
      subtitle={subtitle}
      actions={actions}
      onSelect={onSelectClick}
    />
  );
}
