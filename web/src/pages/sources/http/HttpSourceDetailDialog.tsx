import { useTranslation } from "react-i18next";
import type { HttpSourceInfo } from "../../../types/sources";
import {
  DetailMetaGrid,
  SourceDetailDialogLayout,
  buildHttpSourceDetailFields,
} from "../../../components/detail";
import { formatStatusLabel, statusDotStyle } from "../../../styles/statusDot";
import {
  sourceDetailMonoHeroClass,
  sourceDetailSubtitleClass,
} from "../../../components/detail/classes";
import { formatAccountLabel } from "../../../utils/accountDisplay";
import { platformDisplayLabel } from "../../../utils/platformRegistry";
import { formatOsDateTime } from "../../../utils/time";

interface HttpSourceDetailDialogProps {
  source: HttpSourceInfo;
  onClose: () => void;
  onEdit?: () => void;
}

export function HttpSourceDetailDialog({
  source,
  onClose,
  onEdit,
}: HttpSourceDetailDialogProps) {
  const { t } = useTranslation("sources");
  const fields = buildHttpSourceDetailFields(source);
  return (
    <SourceDetailDialogLayout
      ariaLabel={t("http.detailAria", { url: source.url })}
      title={
        <>
          <span style={statusDotStyle(source.account.status)} aria-hidden="true" />
          {formatAccountLabel(source.account) || t("http.fallbackName")}
        </>
      }
      subtitle={`${platformDisplayLabel(source.account.platform)} · ${formatStatusLabel(source.account.status)}`}
      error={source.lastError}
      onClose={onClose}
      onEdit={onEdit}
    >
      <div className={sourceDetailMonoHeroClass}>
        {source.method} {source.url}
      </div>
      <DetailMetaGrid
        items={fields
          .filter((field) => !field.standalone)
          .map((field) => ({ label: field.label, value: field.value }))}
      />
      {source.lastSuccessAt ? (
        <div className={sourceDetailSubtitleClass}>
          {t("http.lastSuccessLabel", {
            time: formatOsDateTime(source.lastSuccessAt),
          })}
        </div>
      ) : null}
    </SourceDetailDialogLayout>
  );
}
