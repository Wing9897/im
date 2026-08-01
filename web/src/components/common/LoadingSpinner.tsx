import React from "react";
import { useTranslation } from "react-i18next";

const DEFAULT_SPINNER_SIZE = 24;

interface LoadingSpinnerProps {
  /** Text to display below the spinner */
  text?: string;
  /** Size of the spinner in px (default 24) */
  size?: number;
}

/** A subtle animated loading indicator. */
export const LoadingSpinner = React.memo(function LoadingSpinner({
  text,
  size = DEFAULT_SPINNER_SIZE,
}: LoadingSpinnerProps) {
  const { t } = useTranslation("common");
  const label = text === undefined ? t("ui.loading") : text;

  return (
    <div className="flex flex-col items-center justify-center gap-md p-3xl" role="status" aria-live="polite">
      <div
        className="animate-spin rounded-full border-[3px] border-surface-border border-t-accent"
        style={{ width: size, height: size }}
      />
      {label ? <span className="text-caption text-text-muted">{label}</span> : null}
    </div>
  );
});
