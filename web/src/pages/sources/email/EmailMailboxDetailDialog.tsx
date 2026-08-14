import { useTranslation } from "react-i18next";
import type { EmailMailboxInfo } from "../../../types/sources";
import {
  DetailMetaGrid,
  SourceDetailDialogLayout,
  buildEmailMailboxDetailFields,
} from "../../../components/detail";
import { formatSourceLabel } from "../../../utils/sourceDisplay";
import { formatStatusLabel, statusDotStyle } from "../../../styles/statusDot";
import {
  detailChromeCardTitleClass,
  emailDetailFolderCursorClass,
  emailDetailFolderItemClass,
  emailDetailFolderListClass,
  emailDetailHeroClass,
  emailDetailHeroValueClass,
  sourceDetailSubtitleClass,
} from "../../../components/detail/classes";
import { formatOsDateTime } from "../../../utils/time";

interface EmailMailboxDetailDialogProps {
  mailbox: EmailMailboxInfo;
  onClose: () => void;
  onEdit?: () => void;
}

export function EmailMailboxDetailDialog({
  mailbox,
  onClose,
  onEdit,
}: EmailMailboxDetailDialogProps) {
  const { t } = useTranslation("sources");
  const fields = buildEmailMailboxDetailFields(mailbox);
  const metaFields = fields.filter((field) => !field.standalone);
  const titleName =
    mailbox.username || formatSourceLabel(mailbox.source) || t("email.fallbackName");
  return (
    <SourceDetailDialogLayout
      ariaLabel={t("email.detailAria", { name: mailbox.username })}
      title={
        <>
          <span style={statusDotStyle(mailbox.source.status)} aria-hidden="true" />
          {titleName}
        </>
      }
      subtitle={`Email · ${formatStatusLabel(mailbox.source.status)}`}
      error={mailbox.lastError}
      onClose={onClose}
      onEdit={onEdit}
    >
      <div className={emailDetailHeroClass}>
        <div className={detailChromeCardTitleClass}>{t("email.imapConnection")}</div>
        <div className={emailDetailHeroValueClass}>
          {mailbox.imapHost}:{mailbox.imapPort} {mailbox.useSsl ? "(SSL)" : ""}
        </div>
      </div>
      <div className={detailChromeCardTitleClass}>{t("email.foldersAndCursor")}</div>
      <ul className={emailDetailFolderListClass}>
        {mailbox.folders.length > 0 ? (
          mailbox.folders.map((folder) => (
            <li key={folder} className={emailDetailFolderItemClass}>
              <span>{folder}</span>
              <span className={emailDetailFolderCursorClass}>
                UID {mailbox.folderCursors[folder] ?? "—"}
              </span>
            </li>
          ))
        ) : (
          <li className={emailDetailFolderItemClass}>{t("email.notSet")}</li>
        )}
      </ul>
      <DetailMetaGrid
        items={metaFields.map((field) => ({
          label: field.label,
          value: field.value,
          wide: field.value.includes("\n"),
        }))}
      />
      {mailbox.lastSuccessAt ? (
        <div className={sourceDetailSubtitleClass}>
          {t("email.lastSuccess", { time: formatOsDateTime(mailbox.lastSuccessAt) })}
        </div>
      ) : null}
    </SourceDetailDialogLayout>
  );
}
