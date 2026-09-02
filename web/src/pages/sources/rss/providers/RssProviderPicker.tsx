import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PlatformIcon } from "../../../../components/common/PlatformIcon";
import { MenuSelect } from "../../../../components/ui";
import { formLabelClass, formHelpClass } from "../../../../components/ui/pageTypography";
import { groupRssProvidersForPicker } from "./registry";
import type { RssProviderDefinition, RssProviderId } from "./types";

interface RssProviderPickerProps {
  providers: RssProviderDefinition[];
  activeId: RssProviderId;
  onChange: (id: RssProviderId) => void;
  disabled?: boolean;
}

/** Scalable provider switcher — grouped MenuSelect instead of stacked chips. */
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
  const options = useMemo(
    () =>
      groups.flatMap((group) =>
        group.providers.map((provider) => ({
          value: provider.id,
          label: t(provider.labelKey),
          group: t(`rss.pickerGroups.${group.group}`),
        })),
      ),
    [groups, t],
  );

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
        <MenuSelect
          id="rss-provider-select"
          variant="field"
          menuPortal
          className="min-w-0 flex-1"
          value={activeId}
          disabled={disabled}
          options={options}
          onChange={(value) => onChange(value as RssProviderId)}
          aria-label={t("rss.pickerLabel")}
          data-testid="rss-provider-select"
        />
      </div>
      <p className={formHelpClass}>{t(activeProvider.pickerHintKey)}</p>
    </div>
  );
}
