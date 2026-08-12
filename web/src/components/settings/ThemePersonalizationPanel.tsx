import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  FOCAL_REFRESH_HOUR_OPTIONS,
  THEME_MOTIFS,
  advanceAndMaterializeFocal,
  applyBgImage,
  applyThemePersonalization,
  getEffectiveColorOpacityMap,
  getEffectiveColorPickerValues,
  getEffectiveTexture,
  getThemeDefinition,
  loadBgOpacity,
  loadFocalCache,
  loadFocalRefreshHours,
  loadThemeTexturePref,
  parseFocalRefreshHours,
  parseThemeBgMode,
  parseThemeTexturePref,
  refreshFocalBackground,
  resetThemePersonalization,
  resolveThemeBgMode,
  saveFocalRefreshHours,
  saveThemeBgMode,
  saveThemeTexturePref,
  setThemeColorOpacity,
  setThemeColorOverride,
  storageBgKey,
  storageBgOpacityKey,
  type FocalRefreshHours,
  type ThemeBgMode,
  type ThemeColorOverrideKey,
  type ThemeTexturePref,
  loadBgForTheme,
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
 * Per-theme customization (colors + opacity, texture, background mode).
 * Remount with `key={themeId}` from the parent when the active theme changes.
 * Collapsed by default so the theme swatch grid stays primary on first paint.
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
  const [bgMode, setBgMode] = useState<ThemeBgMode>(() => resolveThemeBgMode(themeId));
  const [bgUrl, setBgUrl] = useState<string | null>(() =>
    localStorage.getItem(storageBgKey(themeId)),
  );
  const [focalMeta, setFocalMeta] = useState(() => loadFocalCache());
  const [bgOpacity, setBgOpacity] = useState(() => loadBgOpacity(themeId));
  const [bgError, setBgError] = useState<string | null>(null);
  const [focalLoading, setFocalLoading] = useState(
    () => resolveThemeBgMode(themeId) === "focal" && !loadFocalCache(),
  );
  const [focalRefreshing, setFocalRefreshing] = useState(false);
  const [focalRefreshHours, setFocalRefreshHours] = useState<FocalRefreshHours>(() =>
    loadFocalRefreshHours(),
  );
  const [personalizationOpen, setPersonalizationOpen] = useState(false);

  const catalogTexture = getThemeDefinition(themeId).texture ?? "none";
  const effectiveTexture = getEffectiveTexture(themeId);
  const catalogLabel = motifName(t, catalogTexture);
  const effectiveLabel = motifName(t, effectiveTexture);
  const photoActive = bgMode === "custom" || bgMode === "focal";

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

  const bgModeOptions = [
    { value: "none", label: t("theme.bgModeNone") },
    { value: "custom", label: t("theme.bgModeCustom") },
    { value: "focal", label: t("theme.bgModeFocal") },
  ];

  const focalIntervalOptions = FOCAL_REFRESH_HOUR_OPTIONS.map((hours) => ({
    value: String(hours),
    label:
      hours === 0
        ? t("theme.focalRefreshOff")
        : t("theme.focalRefreshHours", { count: hours }),
  }));

  const applyFocalEntry = (applyUrl: string | null) => {
    if (!applyUrl) return;
    applyBgImage(applyUrl, loadBgOpacity(themeId), "focal");
  };

  const handleFocalRefresh = () => {
    setBgError(null);
    setFocalRefreshing(true);
    void advanceAndMaterializeFocal()
      .then(({ entry, applyUrl }) => {
        setFocalRefreshing(false);
        setFocalLoading(false);
        if (entry) {
          setFocalMeta(entry);
          applyFocalEntry(applyUrl);
          return;
        }
        if (!loadFocalCache()) {
          setBgError(t("theme.focalFetchFailed"));
        }
      })
      .catch(() => {
        setFocalRefreshing(false);
        setBgError(t("theme.focalFetchFailed"));
      });
  };

  // Keep credits / preview in sync when this theme already uses focal.
  useEffect(() => {
    if (resolveThemeBgMode(themeId) !== "focal") return;
    let cancelled = false;
    loadBgForTheme(themeId);
    void refreshFocalBackground().then((entry) => {
      if (cancelled) return;
      setFocalLoading(false);
      if (entry) {
        setFocalMeta(entry);
        setBgError(null);
        return;
      }
      const fallback = loadFocalCache();
      if (fallback) {
        setFocalMeta(fallback);
      } else {
        setBgError(t("theme.focalFetchFailed"));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [themeId, t]);

  const setTexture = (pref: ThemeTexturePref) => {
    saveThemeTexturePref(themeId, pref);
    applyThemePersonalization(themeId);
    setTexturePref(loadThemeTexturePref(themeId));
  };

  const handleBgModeChange = (value: string) => {
    const mode = parseThemeBgMode(value) ?? "none";
    setBgError(null);
    setBgMode(mode);
    saveThemeBgMode(themeId, mode);
    if (mode === "custom") {
      setBgUrl(localStorage.getItem(storageBgKey(themeId)));
      setFocalLoading(false);
      loadBgForTheme(themeId);
      return;
    }
    if (mode === "none") {
      setFocalLoading(false);
      loadBgForTheme(themeId);
      return;
    }
    // focal — apply cache / proxy bytes via loadBgForTheme, refresh credits
    const cache = loadFocalCache();
    setFocalMeta(cache);
    setFocalLoading(!cache);
    loadBgForTheme(themeId);
    void refreshFocalBackground().then((entry) => {
      setFocalLoading(false);
      if (entry) {
        setFocalMeta(entry);
        setBgError(null);
      } else if (!loadFocalCache()) {
        setBgError(t("theme.focalFetchFailed"));
      }
    });
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
      setBgMode("custom");
      saveThemeBgMode(themeId, "custom");
      applyBgImage(dataUrl, bgOpacity, "custom");
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
    setBgMode("none");
    saveThemeBgMode(themeId, "none");
    applyBgImage(null, 0, "none");
  };

  const previewUrl =
    bgMode === "custom"
      ? bgUrl
      : bgMode === "focal"
        ? (focalMeta?.imageUrl ?? null)
        : null;

  return (
    <div
      className="mt-lg flex w-full min-w-[280px] flex-col gap-lg pt-lg"
      data-testid="theme-personalization"
    >
      {/* nested: parent SettingsContentCard is already frosted — avoid a second SurfaceCard slab. */}
      <CollapsePanel
        title={t("theme.personalizationSectionTitle")}
        open={personalizationOpen}
        onToggle={() => setPersonalizationOpen((v) => !v)}
        className="w-full"
        nested
      >
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

        <div className="flex w-full min-w-[280px] flex-col gap-sm">
          <FieldLabel>{t("theme.textureLabel")}</FieldLabel>
          <MenuSelect
            id="theme-texture-pref"
            data-testid="theme-texture-pref"
            variant="field"
            value={texturePref}
            options={textureOptions}
            aria-label={t("theme.textureLabel")}
            onChange={(value) => setTexture(parseThemeTexturePref(value))}
          />
          {photoActive ? (
            <p className={formHelpClass}>{t("theme.texturePausedForBg")}</p>
          ) : texturePref === "default" ? (
            <p className={formHelpClass}>
              {t("theme.textureEffective", { name: effectiveLabel })}
            </p>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-md">
          <div className="flex min-w-0 flex-col gap-xs">
            <FieldLabel>{t("theme.bgImageLabel")}</FieldLabel>
            <p className={formHelpClass}>{t("theme.bgImageHelp")}</p>
          </div>

          <MenuSelect
            id="theme-bg-mode"
            data-testid="theme-bg-mode"
            variant="field"
            value={bgMode}
            options={bgModeOptions}
            aria-label={t("theme.bgModeLabel")}
            onChange={handleBgModeChange}
          />
          <p className={formHelpClass}>
            {bgMode === "focal" ? t("theme.bgModeFocalHelp") : t("theme.bgModeHelp")}
          </p>

          {bgMode === "custom" ? (
            <>
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
            </>
          ) : null}

          {bgMode === "focal" ? (
            <div className="flex min-w-0 flex-col gap-sm">
              <div className="flex min-w-0 flex-wrap items-center gap-sm">
                <Button
                  variant="secondary"
                  size="sm"
                  data-testid="theme-focal-refresh"
                  disabled={focalRefreshing}
                  onClick={handleFocalRefresh}
                >
                  {focalRefreshing ? t("theme.focalRefreshing") : t("theme.focalRefresh")}
                </Button>
                <MenuSelect
                  id="theme-focal-refresh-hours"
                  data-testid="theme-focal-refresh-hours"
                  variant="field"
                  value={String(focalRefreshHours)}
                  options={focalIntervalOptions}
                  aria-label={t("theme.focalRefreshIntervalLabel")}
                  onChange={(value) => {
                    const hours = parseFocalRefreshHours(value);
                    saveFocalRefreshHours(hours);
                    setFocalRefreshHours(hours);
                  }}
                />
              </div>
              <p className={formHelpClass}>{t("theme.focalRefreshHelp")}</p>
              {focalLoading && !focalMeta ? (
                <p className="text-caption text-text-muted">{t("theme.focalLoading")}</p>
              ) : null}
              {focalMeta?.title || focalMeta?.copyright ? (
                <p className="text-caption text-text-secondary" data-testid="theme-focal-credit">
                  {focalMeta.title || focalMeta.copyright}
                  {focalMeta.title && focalMeta.copyright && focalMeta.title !== focalMeta.copyright
                    ? ` — ${focalMeta.copyright}`
                    : null}
                </p>
              ) : null}
            </div>
          ) : null}

          {bgError ? (
            <AlertBanner variant="error" className="mb-0 text-xs">
              {bgError}
            </AlertBanner>
          ) : null}

          {previewUrl ? (
            /* Same frosted panel as color rows — not a solid beige island over photo BG. */
            <div className="im-surface-panel flex min-w-0 flex-col gap-sm rounded-lg border border-surface-border p-md sm:flex-row sm:items-start sm:gap-lg">
              <img
                src={previewUrl}
                alt={t("theme.bgPreviewAlt")}
                referrerPolicy="no-referrer"
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
                    applyBgImage(previewUrl, val, bgMode === "focal" ? "focal" : "custom");
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col items-start gap-xs">
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
      </CollapsePanel>
    </div>
  );
}
