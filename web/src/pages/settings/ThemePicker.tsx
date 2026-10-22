import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  THEMES,
  applyTheme,
  getStoredThemeId,
  loadBgForTheme,
} from "../../styles/themeData";
import { ThemeSection } from "./ThemePickerSections";
import { ThemePersonalizationPanel } from "./ThemePersonalizationPanel";

const deskThemes = THEMES.filter((t) => t.family === "desk");
const classicThemes = THEMES.filter(
  (t) => t.family === "classic" || t.family === "special",
);

export function ThemePicker() {
  const { t } = useTranslation("settings");
  const [activeId, setActiveId] = useState(() => getStoredThemeId());

  const handleSelect = (id: string) => {
    applyTheme(id);
    loadBgForTheme(id);
    setActiveId(id);
  };

  return (
    <div className="w-full min-w-0">
      <ThemeSection
        title={t("theme.deskSectionTitle")}
        themes={deskThemes}
        activeId={activeId}
        onSelect={handleSelect}
      />
      <ThemeSection
        title={t("theme.classicSectionTitle")}
        themes={classicThemes}
        activeId={activeId}
        onSelect={handleSelect}
        showDivider
      />
      <ThemePersonalizationPanel key={activeId} themeId={activeId} />
    </div>
  );
}
