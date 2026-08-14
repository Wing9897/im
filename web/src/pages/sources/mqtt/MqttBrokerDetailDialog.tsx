import { useTranslation } from "react-i18next";
import type { MqttBrokerInfo } from "../../../types/sources";
import {
  DetailMetaGrid,
  DetailTagList,
  SourceDetailDialogLayout,
  buildMqttBrokerDetailFields,
} from "../../../components/detail";
import { formatStatusLabel, statusDotStyle } from "../../../styles/statusDot";
import {
  detailChromeCardTitleClass,
  sourceDetailMonoHeroClass,
  sourceDetailSubtitleClass,
} from "../../../components/detail/classes";
import { formatOsDateTime } from "../../../utils/time";

interface MqttBrokerDetailDialogProps {
  broker: MqttBrokerInfo;
  onClose: () => void;
  onEdit?: () => void;
}

export function MqttBrokerDetailDialog({
  broker,
  onClose,
  onEdit,
}: MqttBrokerDetailDialogProps) {
  const { t } = useTranslation("sources");
  const fields = buildMqttBrokerDetailFields(broker);
  return (
    <SourceDetailDialogLayout
      ariaLabel={t("mqtt.detailAria", { url: broker.brokerUrl })}
      title={
        <>
          <span style={statusDotStyle(broker.source.status)} aria-hidden="true" />
          {t("mqtt.fallbackName")}
        </>
      }
      subtitle={formatStatusLabel(broker.source.status)}
      error={broker.lastError}
      onClose={onClose}
      onEdit={onEdit}
    >
      <div className={sourceDetailMonoHeroClass}>{broker.brokerUrl}</div>
      <div className={detailChromeCardTitleClass}>{t("mqtt.subscribeTopics")}</div>
      <DetailTagList tags={broker.topics} />
      <DetailMetaGrid
        items={fields
          .filter((field) => !field.standalone)
          .map((field) => ({ label: field.label, value: field.value }))}
      />
      {broker.lastSuccessAt ? (
        <div className={sourceDetailSubtitleClass}>
          {t("mqtt.lastSuccessLabel", {
            time: formatOsDateTime(broker.lastSuccessAt),
          })}
        </div>
      ) : null}
    </SourceDetailDialogLayout>
  );
}
