import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSidebarCollapsed } from "../hooks/useSidebarCollapsed";

/** Shared collapse control for DesktopTitleBar / AppTopBar (keeps data-testid). */
export function SidebarCollapseButton({
  className,
}: {
  className?: string;
}) {
  const { t } = useTranslation("common");
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();
  const label = collapsed ? t("ui.expandSidebar") : t("ui.collapseSidebar");

  return (
    <button
      type="button"
      className={
        className ??
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-none bg-transparent text-text-muted hover:bg-[color-mix(in_srgb,var(--text-primary)_5%,transparent)] hover:text-text-primary max-[780px]:hidden"
      }
      onClick={toggleCollapsed}
      aria-label={label}
      title={label}
      data-testid="sidebar-collapse"
    >
      {collapsed ? (
        <PanelLeftOpen size={14} aria-hidden="true" />
      ) : (
        <PanelLeftClose size={14} aria-hidden="true" />
      )}
    </button>
  );
}
