import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getEffectiveColorOpacityMap,
  getEffectiveColorPickerValues,
  loadBgOpacity,
  loadFocalCache,
  loadFocalRefreshHours,
  loadThemeTexturePref,
  resetThemePersonalization,
  resolveThemeBgMode,
  storageBgKey,
  type FocalCacheEntry,
  type FocalRefreshHours,
  type ThemeBgMode,
  type ThemeTexturePref,
} from "../../styles/themeData";
import { Button, CollapsePanel } from "../ui";
import { formHelpClass } from "../ui/pageTypography";
import { ThemeBackgroundSection } from "./themePersonalization/ThemeBackgroundSection";
import { ThemeColorSection } from "./themePersonalization/ThemeColorSection";
import { ThemeTextureSection } from "./themePersonalization/ThemeTextureSection";

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
  const [focalMeta, setFocalMeta] = useState<FocalCacheEntry | null>(() => loadFocalCache());
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

  const photoActive = bgMode === "custom" || bgMode === "focal";

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
        <ThemeColorSection
          themeId={themeId}
          colorValues={colorValues}
          colorOpacity={colorOpacity}
          onColorValuesChange={setColorValues}
          onColorOpacityChange={setColorOpacity}
        />

        <ThemeTextureSection
          themeId={themeId}
          texturePref={texturePref}
          photoActive={photoActive}
          onTexturePrefChange={setTexturePref}
        />

        <ThemeBackgroundSection
          themeId={themeId}
          bgMode={bgMode}
          bgUrl={bgUrl}
          bgOpacity={bgOpacity}
          bgError={bgError}
          focalMeta={focalMeta}
          focalLoading={focalLoading}
          focalRefreshing={focalRefreshing}
          focalRefreshHours={focalRefreshHours}
          setBgMode={setBgMode}
          setBgUrl={setBgUrl}
          setBgOpacity={setBgOpacity}
          setBgError={setBgError}
          setFocalMeta={setFocalMeta}
          setFocalLoading={setFocalLoading}
          setFocalRefreshing={setFocalRefreshing}
          setFocalRefreshHours={setFocalRefreshHours}
        />

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
