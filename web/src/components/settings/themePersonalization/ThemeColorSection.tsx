import { useTranslation } from "react-i18next";
import {
  applyThemePersonalization,
  getEffectiveColorOpacityMap,
  getEffectiveColorPickerValues,
  setThemeColorOpacity,
  setThemeColorOverride,
  type ThemeColorOpacityMap,
  type ThemeColorOverrideKey,
  type ThemeColorOverrides,
} from "../../../styles/themeData";
import { FieldLabel, PercentSlider } from "../../ui";
import { formHelpClass } from "../../ui/pageTypography";

const COLOR_FIELDS: readonly { key: ThemeColorOverrideKey; labelKey: string }[] = [
  { key: "accent", labelKey: "theme.colorAccent" },
  { key: "surfaceBase", labelKey: "theme.colorSurfaceBase" },
  { key: "surfaceCard", labelKey: "theme.colorSurfaceCard" },
  { key: "surfaceBorder", labelKey: "theme.colorSurfaceBorder" },
  { key: "surfaceOverlay", labelKey: "theme.colorSurfaceOverlay" },
];

type ThemeColorSectionProps = {
  themeId: string;
  colorValues: Required<ThemeColorOverrides>;
  colorOpacity: Required<ThemeColorOpacityMap>;
  onColorValuesChange: (next: Required<ThemeColorOverrides>) => void;
  onColorOpacityChange: (next: Required<ThemeColorOpacityMap>) => void;
};

/** Per-theme color + opacity rows inside ThemePersonalizationPanel. */
export function ThemeColorSection({
  themeId,
  colorValues,
  colorOpacity,
  onColorValuesChange,
  onColorOpacityChange,
}: ThemeColorSectionProps) {
  const { t } = useTranslation("settings");

  return (
    <div className="flex w-full flex-col gap-md">
      <div>
        <FieldLabel>{t("theme.colorsHeading")}</FieldLabel>
        <p className={formHelpClass}>{t("theme.colorOpacityHelp")}</p>
      </div>
      {COLOR_FIELDS.map(({ key, labelKey }) => {
        const label = t(labelKey);
        return (
          <div
            key={key}
            /* Photo BG: frosted --surface-panel (opaque when data-theme-bg=none). */
            className="im-surface-panel flex w-full flex-col gap-xs rounded-md border border-surface-border px-md py-sm"
            data-testid={`theme-color-row-${key}`}
          >
            <span className="text-caption font-medium text-text-secondary">{label}</span>
            <div className="flex w-full flex-wrap items-center gap-md sm:flex-nowrap">
              <input
                type="color"
                value={colorValues[key]}
                aria-label={label}
                data-testid={`theme-color-${key}`}
                onChange={(e) => {
                  setThemeColorOverride(themeId, key, e.target.value);
                  applyThemePersonalization(themeId);
                  onColorValuesChange(getEffectiveColorPickerValues(themeId));
                }}
                className="h-8 w-14 shrink-0 cursor-pointer rounded-md border border-surface-border bg-transparent p-0.5"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-xs">
                <span className="text-caption text-text-muted">
                  {t("theme.colorOpacityLabel")}
                </span>
                <PercentSlider
                  id={`theme-color-opacity-${key}`}
                  data-testid={`theme-color-opacity-${key}`}
                  aria-label={`${label} ${t("theme.colorOpacityLabel")}`}
                  value={colorOpacity[key]}
                  onChange={(next) => {
                    setThemeColorOpacity(themeId, key, next);
                    applyThemePersonalization(themeId);
                    onColorOpacityChange(getEffectiveColorOpacityMap(themeId));
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
