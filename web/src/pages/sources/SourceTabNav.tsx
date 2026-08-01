import { useTranslation } from "react-i18next";
import { PlatformIcon } from "../../components/common/PlatformIcon";
import { SegmentedControl } from "../../components/ui";
import type { SourceTabKey } from "../../types/sources";
import { getPlatformSpec } from "../../utils/platformRegistry";
import { SOURCE_TAB_ORDER } from "./plugins";

const TAB_ITEMS = SOURCE_TAB_ORDER.map((platform) => ({
  id: platform,
  label: getPlatformSpec(platform).label,
  platform,
}));

interface SourceTabNavProps {
  activeTab: SourceTabKey;
  onTabChange: (tab: SourceTabKey) => void;
}

export function SourceTabNav({ activeTab, onTabChange }: SourceTabNavProps) {
  const { t } = useTranslation("sources");

  return (
    <SegmentedControl
      ariaLabel={t("nav.aria")}
      value={activeTab}
      onChange={(id) => onTabChange(id as SourceTabKey)}
      items={TAB_ITEMS.map(({ id, label, platform }) => ({
        id,
        label,
        icon: <PlatformIcon platform={platform} size={14} />,
      }))}
    />
  );
}
