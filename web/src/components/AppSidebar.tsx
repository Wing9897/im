import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BellRing,
  Bot,
  CalendarClock,
  CalendarDays,
  Package,
  Database,
  History,
  ListChecks,
  MapPin,
  Menu,
  MessageSquare,
  Radio,
  Settings,
  Trophy,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSidebarCollapsed } from "../hooks/useSidebarCollapsed";
import { useSidebarRailMode } from "../hooks/useSidebarRailMode";
import { useSimpleMode } from "../context/SimpleModeContext";
import {
  isSidebarItemActive,
  MAIN_SIDEBAR_PREFETCH_PATHS,
  SIDEBAR_BOTTOM_ITEMS,
  visibleSidebarGroups,
  type SidebarIconKey,
} from "../domain/ui/sidebarNavigation";
import { formatAppVersionLabel } from "../utils/appVersion";
import { AssistantHistoryRail } from "./AssistantHistoryRail";
import { railModeButtonClass } from "./sidebar/sidebarNavStyles";
import {
  SidebarNavLink,
  SidebarSectionLabel,
  TasksNavLink,
} from "./sidebar/SidebarNavItems";

export { MAIN_SIDEBAR_PREFETCH_PATHS };

const SIDEBAR_ICONS: Record<SidebarIconKey, LucideIcon> = {
  monitor: Radio,
  tasks: ListChecks,
  schedule: CalendarClock,
  items: Package,
  sources: Database,
  leaderboard: Trophy,
  intelligence: MapPin,
  timeline: CalendarDays,
  actions: BellRing,
  assistant: MessageSquare,
  ai: Bot,
  settings: Settings,
  account: User,
};

/**
 * Global left navigation rail — collapsible icon+label / icon-only.
 * Top switches between 選單 (nav) and 紀錄 (assistant history).
 */
export function AppSidebar() {
  const location = useLocation();
  const { t } = useTranslation("nav");
  const [lastTasksPath, setLastTasksPath] = useState("/tasks");
  const { collapsed } = useSidebarCollapsed();
  const { mode, setMode } = useSidebarRailMode();
  const { simpleMode } = useSimpleMode();

  const visibleGroups = visibleSidebarGroups(simpleMode);

  useEffect(() => {
    if (location.pathname.startsWith("/tasks")) {
      setLastTasksPath(location.pathname);
    }
  }, [location.pathname]);

  useEffect(() => {
    return () => {
      document.documentElement.style.removeProperty("--app-sidebar-width");
    };
  }, []);

  const hideLabel = collapsed;

  return (
    <nav
      className={[
        "im-shell-sidebar relative z-20 flex h-full shrink-0 flex-col items-stretch gap-0.5 overflow-x-hidden overflow-y-auto border-r border-[color-mix(in_srgb,var(--surface-border)_55%,transparent)] bg-[var(--surface-sidebar,var(--surface-base))] pb-3 pt-3 [-webkit-app-region:no-drag] [pointer-events:auto] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        collapsed ? "w-[var(--app-sidebar-width-collapsed,56px)] px-1.5" : "w-[var(--app-sidebar-width,200px)] px-2",
        "max-[780px]:w-14 max-[780px]:px-1.5",
      ].join(" ")}
      aria-label={t("mainNav")}
      data-collapsed={collapsed ? "true" : "false"}
      data-rail-mode={mode}
    >
      <div
        className={[
          "mb-2 flex h-8 shrink-0 items-center gap-1",
          collapsed ? "flex-col justify-center" : "px-0.5",
        ].join(" ")}
        role="tablist"
        aria-label={t("railMode")}
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "nav"}
          className={railModeButtonClass(mode === "nav", collapsed)}
          onClick={() => setMode("nav")}
          aria-label={t("menu")}
          title={t("menu")}
          data-testid="sidebar-rail-nav"
        >
          <Menu size={14} strokeWidth={2.2} aria-hidden="true" />
          {!hideLabel ? <span className="max-[780px]:hidden">{t("menu")}</span> : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "history"}
          className={railModeButtonClass(mode === "history", collapsed)}
          onClick={() => setMode("history")}
          aria-label={t("history")}
          title={t("history")}
          data-testid="sidebar-rail-history"
        >
          <History size={14} strokeWidth={2.2} aria-hidden="true" />
          {!hideLabel ? <span className="max-[780px]:hidden">{t("history")}</span> : null}
        </button>
      </div>

      {mode === "history" ? (
        <AssistantHistoryRail collapsed={hideLabel} />
      ) : (
        <>
          {visibleGroups.map((group, groupIndex) => (
            <div key={group.labelKey ?? `group-${groupIndex}`} className="flex flex-col gap-0.5">
              {group.labelKey ? (
                <SidebarSectionLabel label={t(group.labelKey)} collapsed={hideLabel} />
              ) : null}
              {group.items.map((item) => {
                const Icon = SIDEBAR_ICONS[item.icon];
                const isActive = isSidebarItemActive(item, location.pathname);
                const label = t(item.labelKey);
                if (item.to === "/tasks") {
                  return (
                    <TasksNavLink
                      key={item.to}
                      to={lastTasksPath}
                      collapsed={hideLabel}
                      isActive={isActive}
                    />
                  );
                }
                return (
                  <SidebarNavLink
                    key={item.to}
                    to={item.to}
                    label={label}
                    collapsed={hideLabel}
                    isActive={isActive}
                    Icon={Icon}
                  />
                );
              })}
            </div>
          ))}
          <div className="min-h-md flex-1" />
          <div className="mx-1 my-2 h-px shrink-0 bg-[var(--surface-border-alpha,var(--surface-border))]" />
          {!hideLabel ? (
            <div
              className="mx-1 mb-1 mt-0.5 px-1 text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted max-[780px]:hidden"
              aria-hidden="true"
            >
              {t("settingsSection")}
            </div>
          ) : null}
          {SIDEBAR_BOTTOM_ITEMS.map((item) => {
            const Icon = SIDEBAR_ICONS[item.icon];
            const isActive = isSidebarItemActive(item, location.pathname);
            const label = t(item.labelKey);
            return (
              <SidebarNavLink
                key={item.to}
                to={item.to}
                label={label}
                collapsed={hideLabel}
                isActive={isActive}
                Icon={Icon}
                compactLabel
              />
            );
          })}
          {!hideLabel ? (
            <p
              className="mt-sm px-2 text-[10px] leading-none text-text-muted/60"
              title={t("appVersionTitle")}
            >
              {formatAppVersionLabel()}
            </p>
          ) : null}
        </>
      )}
    </nav>
  );
}
