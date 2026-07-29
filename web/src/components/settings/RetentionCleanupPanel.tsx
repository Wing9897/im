import { useTranslation } from "react-i18next";
import { Button, SurfaceCard } from "../ui";

interface RetentionCleanupPanelProps {
  running?: boolean;
  onRequestConfirm: () => void;
  embedded?: boolean;
}

export function RetentionCleanupPanel({
  running,
  onRequestConfirm,
  embedded = false,
}: RetentionCleanupPanelProps) {
  const { t } = useTranslation("settings");
  const content = (
    <div className="flex items-center justify-between gap-md">
      <div className="text-xs leading-[1.6] text-text-secondary">
        {t("data.retentionCleanupDescription")}
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="shrink-0"
        disabled={running}
        onClick={onRequestConfirm}
        data-testid="retention-run-button"
      >
        {running ? t("shared.cleaning") : t("data.runCleanupButton")}
      </Button>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <SurfaceCard className="border-[color-mix(in_srgb,var(--info)_30%,transparent)] bg-[color-mix(in_srgb,var(--info)_6%,transparent)]">
      {content}
    </SurfaceCard>
  );
}
