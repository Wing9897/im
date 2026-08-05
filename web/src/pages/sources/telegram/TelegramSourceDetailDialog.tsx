import { useTranslation } from "react-i18next";
import type { Source } from "../../../types";
import { DetailMetaGrid, buildSourceDetailFields } from "../../../components/detail";
import { formatSourceLabel } from "../../../utils/sourceDisplay";
import { formatStatusLabel, statusDotStyle } from "../../../styles/statusDot";
import { SourceDetailDialogLayout } from "../../../components/detail";

interface TelegramSourceDetailDialogProps {
  source: Source;
  onClose: () => void;
}

export function TelegramSourceDetailDialog({
  source,
  onClose,
}: TelegramSourceDetailDialogProps) {
  const { t } = useTranslation("sources");
  const fields = buildSourceDetailFields(source);
  return (
    <SourceDetailDialogLayout
      ariaLabel={t("telegram.detailAria", { name: formatSourceLabel(source) })}
      title={
        <>
          <span style={statusDotStyle(source.status)} aria-hidden="true" />
          {formatSourceLabel(source)}
        </>
      }
      subtitle={t("telegram.subtitle", {
        status: formatStatusLabel(source.status),
      })}
      error={source.lastError}
      onClose={onClose}
    >
      <DetailMetaGrid
        items={fields
          .filter((field) => !field.standalone)
          .map((field) => ({ label: field.label, value: field.value }))}
      />
    </SourceDetailDialogLayout>
  );
}
