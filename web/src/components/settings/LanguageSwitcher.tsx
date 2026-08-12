import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MenuSelect, SettingsRow } from "../ui";
import {
  APP_LOCALE_PREFERENCES,
  APP_LOCALE_PREFERENCE_LABEL_KEYS,
  getAppLocalePreference,
  onAppLocaleChange,
  setAppLocalePreference,
  type AppLocalePreference,
} from "../../i18n";

const optionBaseClass =
  "inline-flex cursor-pointer items-center rounded-md border text-body leading-snug transition-[border-color,background,color] duration-200";

const optionSelectedClass =
  "border-accent bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface-card))] font-medium text-text-primary shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_28%,transparent)]";

const optionIdleClass =
  "im-surface-inset border-surface-border text-text-secondary hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--surface-border))] hover:text-text-primary";

export type LanguageSwitcherVariant = "settings" | "compact";

interface LanguageSwitcherProps {
  /**
   * `settings` — chip radiogroup with help (Settings → General).
   * `compact` — MenuSelect for auth cards (top-right chrome).
   */
  variant?: LanguageSwitcherVariant;
}

/** UI language preference (independent of TTS/STT speechLanguage). */
export function LanguageSwitcher({ variant = "settings" }: LanguageSwitcherProps) {
  const { t } = useTranslation("common");
  const [preference, setPreference] = useState<AppLocalePreference>(() => getAppLocalePreference());

  useEffect(() => {
    return onAppLocaleChange(() => {
      setPreference(getAppLocalePreference());
    });
  }, []);

  const handleChange = (next: AppLocalePreference) => {
    setPreference(next);
    setAppLocalePreference(next);
  };

  const localeOptions = useMemo(
    () =>
      APP_LOCALE_PREFERENCES.map((id) => ({
        value: id,
        label: t(APP_LOCALE_PREFERENCE_LABEL_KEYS[id]),
      })),
    [t],
  );

  if (variant === "compact") {
    return (
      <div data-testid="language-switcher" data-variant="compact">
        <MenuSelect
          id="auth-ui-locale"
          variant="toolbar"
          menuPortal
          className="min-w-[8.5rem]"
          triggerClassName="min-w-[8.5rem] cursor-pointer text-caption"
          value={preference}
          options={localeOptions}
          onChange={(next) => handleChange(next as AppLocalePreference)}
          aria-label={t("language.label")}
          data-testid="language-switcher-select"
        />
      </div>
    );
  }

  return (
    <div data-testid="language-switcher" data-variant="settings">
      <SettingsRow label={t("language.label")} help={t("language.help")}>
        <div
          role="radiogroup"
          aria-label={t("language.label")}
          className="flex flex-wrap gap-2"
          data-testid="language-switcher-options"
        >
          {APP_LOCALE_PREFERENCES.map((id) => {
            const selected = preference === id;
            return (
              <label
                key={id}
                className={[
                  optionBaseClass,
                  "px-3 py-1.5",
                  selected ? optionSelectedClass : optionIdleClass,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <input
                  type="radio"
                  name="ui-language"
                  value={id}
                  checked={selected}
                  onChange={() => handleChange(id)}
                  className="sr-only"
                  data-testid={`language-option-${id}`}
                />
                {t(APP_LOCALE_PREFERENCE_LABEL_KEYS[id])}
              </label>
            );
          })}
        </div>
      </SettingsRow>
    </div>
  );
}
