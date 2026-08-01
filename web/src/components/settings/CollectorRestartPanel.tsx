import { useTranslation } from "react-i18next";
import { Button, SurfaceCard } from "../ui";
import { formHelpClass } from "../ui/pageTypography";

interface CollectorRestartPanelProps {
  restarting?: boolean;
  onRequestConfirm: () => void;
  embedded?: boolean;
}

export function CollectorRestartPanel({
  restarting,
  onRequestConfirm,
  embedded = false,
}: CollectorRestartPanelProps) {
  const { t } = useTranslation("settings");
  const content = (
    <div className="flex items-center justify-between gap-md">
      <div className={`${formHelpClass} max-w-none`}>
        {t("general.collectorRestartDescription")}
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="shrink-0"
        disabled={restarting}
        onClick={onRequestConfirm}
      >
        {restarting ? t("shared.restarting") : t("general.restartCollectorButton")}
      </Button>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <SurfaceCard className="border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_6%,transparent)]">
      {content}
    </SurfaceCard>
  );
}
