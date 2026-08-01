import { useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  THEME_MOTIFS,
  applyBgImage,
  applyThemePersonalization,
  getEffectiveColorOpacityMap,
  getEffectiveColorPickerValues,
  getEffectiveTexture,
  getThemeDefinition,
  loadThemeTexturePref,
  parseThemeTexturePref,
  resetThemePersonalization,
  saveThemeTexturePref,
  setThemeColorOpacity,
  setThemeColorOverride,
  storageBgKey,
  storageBgOpacityKey,
  type ThemeColorOverrideKey,
  type ThemeTexturePref,
} from "../../styles/themeData";
import {
  AlertBanner,
  Button,
  CollapsePanel,
  FieldLabel,
  MenuSelect,
  PercentSlider,
} from "../ui";
import { formHelpClass } from "../ui/pageTypography";
import { MAX_BG_SIZE } from "./ThemePickerSections";

const COLOR_FIELDS: readonly { key: ThemeColorOverrideKey; labelKey: string }[] = [
  { key: "accent", labelKey: "theme.colorAccent" },
  { key: "surfaceBase", labelKey: "theme.colorSurfaceBase" },
  { key: "surfaceCard", labelKey: "theme.colorSurfaceCard" },
  { key: "surfaceBorder", labelKey: "theme.colorSurfaceBorder" },
  { key: "surfaceOverlay", labelKey: "theme.colorSurfaceOverlay" },
];

function motifName(
  t: (key: string, opts?: Record<string, string>) => string,
  motif: string,
): string {
  if (motif === "none") return t("theme.textureNone");
  return t(`theme.textureMotif.${motif}`, { defaultValue: motif });
}

type ThemePersonalizationPanelProps = {
  themeId: string;
};

/**
 * Per-theme customization (colors + opacity, texture, optional photo BG).
 * Remount with `key={themeId}` from the parent when the active theme changes.
 */
export function ThemePersonalizationPanel({ themeId }: ThemePersonalizationPanelProps) {
  const { t } = useTranslation("settings");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [colorValues, setColorValues] = useState(() =>
    getEffectiveColorPickerValues(themeId),
  );
  const [colorOpacity, setColorOpacity] = useState(() =>
    getEffectiveColorOpacityMap(themeId),
  );
  const [texturePref, setTexturePref] = useState<ThemeTexturePref>(() =>
    loadThemeTexturePref(themeId),
  );
  const [bgUrl, setBgUrl] = useState<string | null>(() =>
    localStorage.getItem(storageBgKey(themeId)),
  );
  const [bgOpacity, setBgOpacity] = useState(() =>
    parseFloat(localStorage.getItem(storageBgOpacityKey(themeId)) || "0.3"),
  );
  const [bgError, setBgError] = useState<string | null>(null);
  const [colorsOpen, setColorsOpen] = useState(false);

  const catalogTexture = getThemeDefinition(themeId).texture ?? "none";
  const effectiveTexture = getEffectiveTexture(themeId);
  const catalogLabel = motifName(t, catalogTexture);
  const effectiveLabel = motifName(t, effectiveTexture);

  const textureOptions = [
    {
      value: "default",
      label: t("theme.textureDefaultWithName", { name: catalogLabel }),
    },
    { value: "none", label: t("theme.textureNone") },
    ...THEME_MOTIFS.map((motif) => ({
      value: motif,
      label: motifName(t, motif),
    })),
  ];

  const setTexture = (pref: ThemeTexturePref) => {
    saveThemeTexturePref(themeId, pref);
    applyThemePersonalization(themeId);
    setTexturePref(loadThemeTexturePref(themeId));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BG_SIZE) {
      setBgError(t("theme.bgTooLarge"));
      e.target.value = "";
      return;
    }
    setBgError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      try {
        localStorage.setItem(storageBgKey(themeId), dataUrl);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "QuotaExceededError") {
          setBgError(t("theme.bgQuotaExceeded"));
          return;
        }
        throw err;
      }
      setBgUrl(dataUrl);
      applyBgImage(dataUrl, bgOpacity);
    };
    reader.onerror = () => setBgError(t("theme.bgReadFailed"));
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removeBg = () => {
    localStorage.removeItem(storageBgKey(themeId));
    localStorage.removeItem(storageBgOpacityKey(themeId));
    setBgUrl(null);
    setBgOpacity(0.3);
    setBgError(null);
    applyBgImage(null, 0);
  };

  return (
    <div
      className="mt-lg flex w-full min-w-[280px] flex-col gap-lg pt-lg"
      data-testid="theme-personalization"
    >
      <CollapsePanel
        title={t("theme.customizeHeading")}
        open={colorsOpen}
        onToggle={() => setColorsOpen((v) => !v)}
        className="w-full"
      >
        <p className={formHelpClass}>{t("theme.colorOpacityHelp")}</p>
        <div className="flex w-full flex-col gap-md">
          {COLOR_FIELDS.map(({ key, labelKey }) => {
            const label = t(labelKey);
            return (
              <div
                key={key}
                className="flex w-full flex-col gap-xs rounded-md border border-surface-border bg-surface-card px-md py-sm"
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
                      setColorValues(getEffectiveColorPickerValues(themeId));
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
                        setColorOpacity(getEffectiveColorOpacityMap(themeId));
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CollapsePanel>

      <div className="flex w-full min-w-[280px] flex-col gap-sm">
        <FieldLabel>{t("theme.textureLabel")}</FieldLabel>
        <MenuSelect
          id="theme-texture-pref"
          data-testid="theme-texture-pref"
          value={texturePref}
          options={textureOptions}
          aria-label={t("theme.textureLabel")}
          onChange={(value) => setTexture(parseThemeTexturePref(value))}
        />
        {bgUrl ? (
          <p className={formHelpClass}>{t("theme.texturePausedForBg")}</p>
        ) : texturePref === "default" ? (
          <p className={formHelpClass}>
            {t("theme.textureEffective", { name: effectiveLabel })}
          </p>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-md pt-lg">
        <div className="flex min-w-0 flex-col gap-xs">
          <FieldLabel>{t("theme.bgImageLabel")}</FieldLabel>
          <p className={formHelpClass}>{t("theme.bgImageHelp")}</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex min-w-0 flex-wrap items-center gap-sm">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            {t("theme.chooseImage")}
          </Button>
          {bgUrl ? (
            <Button variant="danger" size="sm" onClick={removeBg}>
              {t("theme.removeImage")}
            </Button>
          ) : (
            <span className="text-caption text-text-muted">{t("theme.bgImageNone")}</span>
          )}
        </div>

        {bgError ? (
          <AlertBanner variant="error" className="mb-0 text-xs">
            {bgError}
          </AlertBanner>
        ) : null}

        {bgUrl ? (
          <div className="flex min-w-0 flex-col gap-sm rounded-lg border border-surface-border bg-[color-mix(in_srgb,var(--surface-card)_70%,var(--surface-page))] p-md sm:flex-row sm:items-start sm:gap-lg">
            <img
              src={bgUrl}
              alt={t("theme.bgPreviewAlt")}
              className="h-[88px] w-[140px] shrink-0 rounded-md border border-surface-border object-cover"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-xs">
              <label
                htmlFor="theme-bg-opacity"
                className="text-caption font-medium text-text-secondary"
              >
                {t("theme.opacity")}
              </label>
              <PercentSlider
                id="theme-bg-opacity"
                data-testid="theme-bg-opacity"
                aria-label={t("theme.opacity")}
                min={0.05}
                max={0.6}
                value={bgOpacity}
                onChange={(val) => {
                  setBgOpacity(val);
                  localStorage.setItem(storageBgOpacityKey(themeId), String(val));
                  applyBgImage(bgUrl, val);
                }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col items-start gap-xs pt-lg">
        <Button
          variant="secondary"
          size="sm"
          data-testid="theme-personalization-reset"
          onClick={() => {
            resetThemePersonalization(themeId);
            setColorValues(getEffectiveColorPickerValues(themeId));
            setColorOpacity(getEffectiveColorOpacityMap(themeId));
            setTexturePref(loadThemeTexturePref(themeId));
          }}
        >
          {t("theme.resetPersonalization")}
        </Button>
        <p className={formHelpClass}>{t("theme.resetPersonalizationHelp")}</p>
      </div>
    </div>
  );
}
