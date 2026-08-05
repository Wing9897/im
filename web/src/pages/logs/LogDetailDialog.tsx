import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AppLogEntry } from "../../context/appRuntimeShared";
import { Button, CollapsePanel } from "../../components/ui";
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
import { parseAppLogDetails } from "../../logging/appLogClient";
import { resolveLogDisplayMessage } from "../../domain/logs/resolveLogDisplayMessage";

interface LogDetailViewProps {
  selectedLog: AppLogEntry;
  onClose: () => void;
  presentation?: DetailPresentation;
}

function formatDetailPayload(
  details: string | undefined,
): { labelKey: "detail.payloadLabel" | "detail.detailsLabel"; text: string } | null {
  if (!details) return null;
  const envelope = parseAppLogDetails(details);
  if (envelope?.payload !== undefined) {
    try {
      return {
        labelKey: "detail.payloadLabel",
        text: JSON.stringify(envelope.payload, null, 2) ?? "[empty payload]",
      };
    } catch {
      return {
        labelKey: "detail.payloadLabel",
        text: "[unserializable payload]",
      };
    }
  }
  return { labelKey: "detail.detailsLabel", text: details };
}

export function LogDetailView({
  selectedLog,
  onClose,
  presentation = "modal",
}: LogDetailViewProps) {
  const { t } = useTranslation("logs");
  const displayMessage = resolveLogDisplayMessage(selectedLog);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const detailBlock = useMemo(
    () => formatDetailPayload(selectedLog.details),
    [selectedLog.details],
  );
  const content = (
    <>
      <div className={logLevelBarClass(selectedLog.level)} aria-hidden="true" />

      <header className={logDetailHeaderClass}>
        <div className={logDetailEyebrowClass}>
          {selectedLog.level.toUpperCase()} · {selectedLog.category}
          {selectedLog.kind ? ` · ${selectedLog.kind}` : ""} ·{" "}
          {formatOsDateTime(selectedLog.time)}
        </div>
        <h2 className={logDetailTitleClass}>{displayMessage}</h2>
      </header>

      <div className={logDetailBodyClass}>
        <div>
          <div className={logDetailPreLabelClass}>{t("detail.messageLabel")}</div>
          <pre className={logDetailPreBlockClass}>{displayMessage}</pre>
        </div>
        {detailBlock ? (
          <CollapsePanel
            title={t(detailBlock.labelKey)}
            open={detailsOpen}
            onToggle={() => setDetailsOpen((open) => !open)}
          >
            <pre className={logDetailPreBlockClass}>{detailBlock.text}</pre>
          </CollapsePanel>
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
