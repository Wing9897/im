import { useTranslation } from "react-i18next";
import { PlatformIcon } from "../../../../components/common/PlatformIcon";
import { SelectField } from "../../../../components/ui";
import { formLabelClass, formHelpClass } from "../../../../components/ui/pageTypography";
import { groupRssProvidersForPicker } from "./registry";
import type { RssProviderDefinition, RssProviderId } from "./types";

interface RssProviderPickerProps {
  providers: RssProviderDefinition[];
  activeId: RssProviderId;
  onChange: (id: RssProviderId) => void;
  disabled?: boolean;
}

/** Scalable provider switcher — grouped select instead of stacked chips. */
export function RssProviderPicker({
  providers,
  activeId,
  onChange,
  disabled = false,
}: RssProviderPickerProps) {
  const { t } = useTranslation("sources");
  const activeProvider =
    providers.find((provider) => provider.id === activeId) ?? providers[0];
  const groups = groupRssProvidersForPicker(providers);

  return (
    <div className="flex flex-col gap-sm">
      <label className={formLabelClass} htmlFor="rss-provider-select">
        {t("rss.pickerLabel")}
      </label>
      <div className="flex min-w-0 items-center gap-md">
        <span
          className="im-surface-inset inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-surface-border"
          aria-hidden="true"
        >
          <PlatformIcon platform={activeProvider.iconPlatform} size={16} />
        </span>
        {/* Native select: MenuSelect has no optgroup support for provider grouping. */}
        <SelectField
          id="rss-provider-select"
          className="min-w-0 flex-1"
          value={activeId}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value as RssProviderId)}
        >
          {groups.map((group) => (
            <optgroup key={group.group} label={t(`rss.pickerGroups.${group.group}`)}>
              {group.providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {t(provider.labelKey)}
                </option>
              ))}
            </optgroup>
          ))}
        </SelectField>
      </div>
      <p className={formHelpClass}>{t(activeProvider.pickerHintKey)}</p>
    </div>
  );
}
