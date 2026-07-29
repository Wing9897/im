import type React from "react";
import { useTranslation } from "react-i18next";
import { PlatformIcon } from "../../components/common/PlatformIcon";
import type { ConnectionStatus } from "../../types";
import { formatStatusLabel } from "../../styles/statusDot";
import { formatOsDateTime } from "../../utils/time";
import { AccentBarCard } from "../../components/ui";
import { cardTitleClass } from "../../components/ui/pageTypography";
import { SelectableSurface, stopSelectableActivation } from "../../components/detail";

interface SourceCardErrorLinesProps {
  status: ConnectionStatus;
  lastError?: string | null;
  accountLastError?: string | null;
  reconnectError?: string | null;
  lastSuccessAt?: string | null;
  showLastSuccessOnError?: boolean;
}

export function SourceCardErrorLines({
  status,
  lastError,
  accountLastError,
  reconnectError,
  lastSuccessAt,
  showLastSuccessOnError = false,
}: SourceCardErrorLinesProps) {
  const { t } = useTranslation("sources");
  const showError = status === "error" || status === "disconnected";
  const errorText = lastError ?? accountLastError;
  const displayError = showError
    ? errorText || (status === "error" ? t("card.unknownError") : null)
    : null;

  return (
    <>
      {displayError ? (
        <div className="mt-0.5 text-[11px] text-error">{displayError}</div>
      ) : null}
      {showLastSuccessOnError && status === "error" && lastSuccessAt ? (
        <div className="mt-0.5 text-card-meta text-text-muted">
          {t("card.lastSuccess", { time: formatOsDateTime(lastSuccessAt) })}
        </div>
      ) : null}
      {reconnectError ? (
        <div className="mt-0.5 text-[11px] text-error">{reconnectError}</div>
      ) : null}
    </>
  );
}

interface SourceCardProps {
  platform?: string;
  status: ConnectionStatus;
  title: string;
  subtitle: React.ReactNode;
  actions: React.ReactNode;
  children?: React.ReactNode;
  onSelect?: () => void;
  selectAriaLabel?: string;
}

const accentByStatus: Record<ConnectionStatus, string> = {
  connected: "bg-success",
  connecting: "bg-warning",
  error: "bg-error",
  disconnected: "bg-warning",
};

const statusPillClass: Record<ConnectionStatus, string> = {
  connected:
    "text-success border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)]",
  error:
    "text-error border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)]",
  connecting:
    "text-warning border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)]",
  disconnected:
    "text-warning border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)]",
};

export function SourceCard({
  platform,
  status,
  title,
  subtitle,
  actions,
  children,
  onSelect,
  selectAriaLabel,
}: SourceCardProps) {
  const { t } = useTranslation("sources");
  return (
    <SelectableSurface
      variant="none"
      onSelect={onSelect}
      selectAriaLabel={
        selectAriaLabel ?? (onSelect ? t("card.viewDetailAria", { title }) : undefined)
      }
      className="sources-card relative mb-0 h-full overflow-hidden"
    >
      <AccentBarCard accentClass={accentByStatus[status]} interactive>
        <div className="flex items-center gap-sm">
          {platform ? (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--surface-overlay)_40%,transparent)]">
              <PlatformIcon platform={platform} size={18} />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className={`truncate ${cardTitleClass}`}>{title}</div>
            <div className="mt-0.5 truncate text-card-meta text-text-muted">{subtitle}</div>
          </div>
          <span
            className={`shrink-0 rounded-full border px-1.5 py-px text-[10px] font-semibold ${statusPillClass[status]}`}
          >
            {formatStatusLabel(status)}
          </span>
        </div>

        {children ? <div className="text-[11px] text-text-secondary">{children}</div> : null}

        <div
          className="mt-auto flex flex-wrap justify-end gap-1 pt-xs"
          onClick={stopSelectableActivation}
          onKeyDown={stopSelectableActivation}
        >
          {actions}
        </div>
      </AccentBarCard>
    </SelectableSurface>
  );
}
