import { useTranslation } from "react-i18next";

interface RefreshIndicatorProps {
  /** Accessible label for screen readers. */
  label?: string;
}

/** Compact inline spinner for toolbar / header refresh states. */
export function RefreshIndicator({ label }: RefreshIndicatorProps) {
  const { t } = useTranslation("common");
  const resolvedLabel = label ?? t("ui.refreshing");

  return (
    <span
      className="im-refresh-indicator"
      role="status"
      aria-live="polite"
      aria-label={resolvedLabel}
    />
  );
}
