import { useTranslation } from "react-i18next";
import { Button, SurfaceCard } from "../ui";

interface RuntimeResetPanelProps {
  resettingRuntimeData?: boolean;
  onRequestConfirm: () => void;
  embedded?: boolean;
}

export function RuntimeResetPanel({
  resettingRuntimeData,
  onRequestConfirm,
  embedded = false,
}: RuntimeResetPanelProps) {
  const { t } = useTranslation("settings");
  const content = (
    <div className="flex items-center justify-between gap-md">
      <div className="text-xs leading-[1.6] text-text-secondary">
        {t("data.runtimeResetDescription")}
      </div>
      <Button
        variant="danger"
        size="sm"
        className="shrink-0"
        disabled={resettingRuntimeData}
        onClick={onRequestConfirm}
      >
        {resettingRuntimeData ? t("shared.restarting") : t("data.fullResetButton")}
      </Button>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <SurfaceCard className="border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_6%,transparent)]">
      {content}
    </SurfaceCard>
  );
}
