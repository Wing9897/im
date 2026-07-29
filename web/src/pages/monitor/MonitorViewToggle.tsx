import { LayoutGrid, List, Presentation } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SegmentedControl, type SegmentedControlItem } from "../../components/ui";
import type { MonitorViewMode } from "../../domain/monitor/monitorViewMode";

interface MonitorViewToggleProps {
  mode: MonitorViewMode;
  onChange: (mode: MonitorViewMode) => void;
}

export function MonitorViewToggle({ mode, onChange }: MonitorViewToggleProps) {
  const { t } = useTranslation("monitor");
  const { t: tc } = useTranslation("common");

  const items: SegmentedControlItem[] = [
    {
      id: "card",
      label: tc("ui.viewCard"),
      icon: <LayoutGrid size={13} strokeWidth={2} aria-hidden="true" />,
    },
    {
      id: "list",
      label: tc("ui.viewList"),
      icon: <List size={13} strokeWidth={2} aria-hidden="true" />,
    },
    {
      id: "wall",
      label: t("view.wall"),
      icon: <Presentation size={13} strokeWidth={2} aria-hidden="true" />,
    },
  ];

  return (
    <SegmentedControl
      items={items}
      value={mode}
      onChange={(id) => onChange(id as MonitorViewMode)}
      ariaLabel={t("view.aria")}
      layout="inline"
      className="mb-0 w-auto shrink-0"
    />
  );
}
