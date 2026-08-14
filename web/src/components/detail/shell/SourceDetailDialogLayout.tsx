import type React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../ui";
import { DetailDialogShell } from "./DetailDialogShell";
import {
  detailChromeBodyGapFieldClass,
  detailChromeFooterClass,
  detailChromeHeaderClass,
  detailDialogShellClass,
  sourceDetailErrorBannerClass,
  sourceDetailSubtitleClass,
  sourceDetailTitleClass,
} from "../classes";

interface SourceDetailDialogLayoutProps {
  ariaLabel: string;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  children: React.ReactNode;
  error?: string | null;
  onClose: () => void;
  onEdit?: () => void;
  width?: string;
}

export function SourceDetailDialogLayout({
  ariaLabel,
  title,
  subtitle,
  children,
  error,
  onClose,
  onEdit,
  width,
}: SourceDetailDialogLayoutProps) {
  const { t } = useTranslation("sources");
  return (
    <DetailDialogShell
      width={width}
      className={detailDialogShellClass}
      onClose={onClose}
      aria-label={ariaLabel}
    >
      <header className={detailChromeHeaderClass}>
        <h2 className={sourceDetailTitleClass}>{title}</h2>
        <div className={sourceDetailSubtitleClass}>{subtitle}</div>
      </header>
      <div className={detailChromeBodyGapFieldClass}>
        {error ? <div className={sourceDetailErrorBannerClass} role="alert">{error}</div> : null}
        {children}
      </div>
      <footer className={detailChromeFooterClass}>
        {onEdit ? (
          <Button variant="secondary" onClick={onEdit}>
            {t("shared.edit")}
          </Button>
        ) : null}
        <Button variant="secondary" onClick={onClose}>
          {t("shared.close")}
        </Button>
      </footer>
    </DetailDialogShell>
  );
}
