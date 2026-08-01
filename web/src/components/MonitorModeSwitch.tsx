import { LayoutGrid, PanelsTopLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMonitorMode, type MonitorMode } from "../context/MonitorModeContext";

export function MonitorModeSwitch({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("common");
  const { monitorMode, setMonitorMode } = useMonitorMode();

  const OPTIONS: { mode: MonitorMode; label: string; title: string; icon: typeof LayoutGrid }[] = [
    {
      mode: "pages",
      label: t("monitorMode.pages"),
      title: t("monitorMode.pagesTitle"),
      icon: PanelsTopLeft,
    },
    {
      mode: "canvas",
      label: t("monitorMode.canvas"),
      title: t("monitorMode.canvasTitle"),
      icon: LayoutGrid,
    },
  ];

  return (
    <div
      className={
        compact
          ? "monitor-mode-switch monitor-mode-switch--compact"
          : "monitor-mode-switch"
      }
      role="group"
      aria-label={t("monitorMode.aria")}
      data-testid="monitor-mode-switch"
    >
      {OPTIONS.map(({ mode, label, title, icon: Icon }) => {
        const active = monitorMode === mode;
        return (
          <button
            key={mode}
            type="button"
            data-testid={`monitor-mode-${mode}`}
            aria-pressed={active}
            title={title}
            className={
              active
                ? "monitor-mode-switch__btn monitor-mode-switch__btn--active"
                : "monitor-mode-switch__btn"
            }
            onClick={() => setMonitorMode(mode)}
          >
            <Icon size={compact ? 12 : 14} strokeWidth={2} aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
