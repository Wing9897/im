import { useTranslation } from "react-i18next";
import { FieldLabel, SelectTile, formHelpClass } from "../ui";
import { ToggleSwitch } from "../ToggleSwitch";
import {
  notifyPrefChecked,
  notifyPrefFromChecked,
  type NotifyPref,
} from "../../domain/notify/notifyPref";

export function NotifyPrefField({
  value,
  onChange,
  disabled = false,
  testId = "notify-pref-field",
  variant = "field",
}: {
  value: string | null | undefined;
  onChange: (next: NotifyPref) => void;
  disabled?: boolean;
  testId?: string;
  /** `tile` for compact SelectTile grids; `field` keeps a labeled switch. */
  variant?: "field" | "tile";
}) {
  const { t } = useTranslation("common");
  const checked = notifyPrefChecked(value);

  if (variant === "tile") {
    return (
      <SelectTile
        compact
        variant="toggle"
        active={checked}
        disabled={disabled}
        data-testid={testId}
        aria-label={t("notify.prefAria")}
        title={t("notify.prefHelp")}
        hint={t("notify.prefHint")}
        onClick={() => {
          if (disabled) return;
          onChange(notifyPrefFromChecked(!checked));
        }}
      >
        {t("notify.prefLabel")}
      </SelectTile>
    );
  }

  return (
    <div
      className="flex min-w-0 w-full flex-col gap-xs rounded-lg border border-surface-border/70 bg-[color-mix(in_srgb,var(--surface-overlay)_25%,transparent)] px-md py-sm"
      title={t("notify.prefHelp")}
    >
      <div className="flex min-w-0 items-center justify-between gap-md">
        <FieldLabel className="mb-0 min-w-0 flex-1">{t("notify.prefLabel")}</FieldLabel>
        <ToggleSwitch
          checked={checked}
          disabled={disabled}
          onChange={(next) => onChange(notifyPrefFromChecked(next))}
          label={t("notify.prefAria")}
          showLabel={false}
          data-testid={testId}
        />
      </div>
      <p className={`m-0 min-w-0 break-words ${formHelpClass}`}>{t("notify.prefHelp")}</p>
    </div>
  );
}
