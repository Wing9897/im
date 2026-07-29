import { useTranslation } from "react-i18next";
import type { Account } from "../../../types";
import { DetailMetaGrid, buildAccountDetailFields } from "../../../components/detail";
import { formatAccountLabel } from "../../../utils/accountDisplay";
import { formatStatusLabel, statusDotStyle } from "../../../styles/statusDot";
import { SourceDetailDialogLayout } from "../../../components/detail";

interface TelegramAccountDetailDialogProps {
  account: Account;
  onClose: () => void;
}

export function TelegramAccountDetailDialog({
  account,
  onClose,
}: TelegramAccountDetailDialogProps) {
  const { t } = useTranslation("sources");
  const fields = buildAccountDetailFields(account);
  return (
    <SourceDetailDialogLayout
      ariaLabel={t("telegram.detailAria", { name: formatAccountLabel(account) })}
      title={
        <>
          <span style={statusDotStyle(account.status)} aria-hidden="true" />
          {formatAccountLabel(account)}
        </>
      }
      subtitle={t("telegram.subtitle", {
        status: formatStatusLabel(account.status),
      })}
      error={account.lastError}
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
