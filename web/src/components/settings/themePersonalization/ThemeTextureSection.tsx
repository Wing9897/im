import { useTranslation } from "react-i18next";
import {
  THEME_MOTIFS,
  applyThemePersonalization,
  getEffectiveTexture,
  getThemeDefinition,
  loadThemeTexturePref,
  parseThemeTexturePref,
  saveThemeTexturePref,
  type ThemeTexturePref,
} from "../../../styles/themeData";
import { FieldLabel, MenuSelect } from "../../ui";
import { formHelpClass } from "../../ui/pageTypography";

function motifName(
  t: (key: string, opts?: Record<string, string>) => string,
  motif: string,
): string {
  if (motif === "none") return t("theme.textureNone");
  return t(`theme.textureMotif.${motif}`, { defaultValue: motif });
}

type ThemeTextureSectionProps = {
  themeId: string;
  texturePref: ThemeTexturePref;
  photoActive: boolean;
  onTexturePrefChange: (pref: ThemeTexturePref) => void;
};

/** Texture motif picker for ThemePersonalizationPanel. */
export function ThemeTextureSection({
  themeId,
  texturePref,
  photoActive,
  onTexturePrefChange,
}: ThemeTextureSectionProps) {
  const { t } = useTranslation("settings");

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
    onTexturePrefChange(loadThemeTexturePref(themeId));
  };

  return (
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
  );
}
