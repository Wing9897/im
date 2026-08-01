import { useTranslation } from "react-i18next";
import type { AppLogEntry } from "../../context/appRuntimeShared";
import { Button } from "../../components/ui";
import { formatOsDateTime } from "../../utils/time";
import { DetailPresentationShell, type DetailPresentation } from "../../components/detail";
import {
  logDetailBodyClass,
  logDetailEyebrowClass,
  logDetailFooterClass,
  logDetailHeaderClass,
  logDetailPreBlockClass,
  logDetailPreLabelClass,
  logDetailShellClass,
  logDetailTitleClass,
  logLevelBarClass,
} from "../../components/detail/classes";
import { resolveLogDisplayMessage } from "../../domain/logs/resolveLogDisplayMessage";

interface LogDetailViewProps {
  selectedLog: AppLogEntry;
  onClose: () => void;
  presentation?: DetailPresentation;
}

export function LogDetailView({
  selectedLog,
  onClose,
  presentation = "modal",
}: LogDetailViewProps) {
  const { t } = useTranslation("logs");
  const displayMessage = resolveLogDisplayMessage(selectedLog);
  const content = (
    <>
      <div className={logLevelBarClass(selectedLog.level)} aria-hidden="true" />

      <header className={logDetailHeaderClass}>
        <div className={logDetailEyebrowClass}>
          {selectedLog.level.toUpperCase()} · {selectedLog.category} ·{" "}
          {formatOsDateTime(selectedLog.time)}
        </div>
        <h2 className={logDetailTitleClass}>{displayMessage}</h2>
      </header>

      <div className={logDetailBodyClass}>
        <div>
          <div className={logDetailPreLabelClass}>{t("detail.messageLabel")}</div>
          <pre className={logDetailPreBlockClass}>{displayMessage}</pre>
        </div>
        {selectedLog.details ? (
          <div>
            <div className={logDetailPreLabelClass}>{t("detail.detailsLabel")}</div>
            <pre className={logDetailPreBlockClass}>{selectedLog.details}</pre>
          </div>
        ) : null}
      </div>

      <footer className={logDetailFooterClass}>
        <Button variant="secondary" onClick={onClose}>
          {t("detail.close")}
        </Button>
      </footer>
    </>
  );

  return (
    <DetailPresentationShell
      presentation={presentation}
      onClose={onClose}
      className={logDetailShellClass}
      aria-label={t("detail.ariaLabel", { message: displayMessage })}
    >
      {content}
    </DetailPresentationShell>
  );
}

export function LogDetailDialog(props: LogDetailViewProps) {
  return <LogDetailView {...props} presentation={props.presentation ?? "modal"} />;
}
