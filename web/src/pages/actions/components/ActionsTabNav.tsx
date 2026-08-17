import { Bell, BellRing, History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SegmentedControl } from "../../../components/ui";
import {
  ACTIONS_TAB_DEFS,
  type ActionsTabKey,
} from "../actionsTab";

const TAB_ICONS: Record<ActionsTabKey, typeof BellRing> = {
  types: BellRing,
  notify: Bell,
  history: History,
};

interface ActionsTabNavProps {
  activeTab: ActionsTabKey;
  onTabChange: (tab: ActionsTabKey) => void;
}

/** Segmented sub-nav for the notifications workspace (types / notify / history). */
export function ActionsTabNav({ activeTab, onTabChange }: ActionsTabNavProps) {
  const { t } = useTranslation("actions");

  return (
    <SegmentedControl
      ariaLabel={t("tabs.navAria")}
      value={activeTab}
      onChange={(id) => onTabChange(id as ActionsTabKey)}
      items={ACTIONS_TAB_DEFS.map(({ id, labelKey }) => {
        const Icon = TAB_ICONS[id];
        return {
          id,
          label: t(labelKey),
          icon: <Icon size={14} strokeWidth={2} aria-hidden="true" />,
        };
      })}
    />
  );
}
