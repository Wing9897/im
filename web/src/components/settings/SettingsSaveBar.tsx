import { useTranslation } from "react-i18next";
import { Button } from "../ui";

export function SettingsSaveBar({
  saving,
  saveSuccess,
  saveLabel,
  onSave,
  inline = false,
}: {
  saving: boolean;
  saveSuccess: boolean;
  saveLabel: string;
  onSave: () => void | Promise<void>;
  inline?: boolean;
}) {
  const { t } = useTranslation("settings");
  return (
    <div
      className={[
        "flex items-center justify-end gap-sm border-t border-[color-mix(in_srgb,var(--surface-border)_85%,transparent)] pt-md",
        inline ? "mt-0 border-t-0 pt-0" : "mt-lg",
      ].join(" ")}
    >
      {saveSuccess ? (
        <span className="text-xs font-medium text-success">{t("shared.saveSuccess")}</span>
      ) : null}
      <Button
        variant="primary"
        size="sm"
        onClick={() => void Promise.resolve(onSave()).catch(() => {})}
        disabled={saving}
      >
        {saving ? t("shared.saving") : saveLabel}
      </Button>
    </div>
  );
}
