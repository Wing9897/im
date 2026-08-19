import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BellRing,
  Bot,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Package,
  Database,
  History,
  ListChecks,
  Layers,
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
import { OverlayPortal } from "./common/OverlayPortal";
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
  worksets: Layers,
  schedule: CalendarClock,
  items: Package,
  sources: Database,
  leaderboard: Trophy,
  intelligence: MapPin,
  timeline: CalendarDays,
  notify: BellRing,
  assistant: MessageSquare,
  ai: Bot,
  settings: Settings,
  account: User,
};

/**
 * Global left navigation — overlay drawer (matches 通知 RecentDayInboxDrawer:
 * OverlayPortal + light scrim + translucent im-dialog-drawer). Does not push page layout.
 */
export function AppSidebar() {
  const location = useLocation();
  const { t } = useTranslation("nav");
  const { t: tCommon } = useTranslation("common");
  const [lastTasksPath, setLastTasksPath] = useState("/tasks");
  const { collapsed, setCollapsed, toggleCollapsed } = useSidebarCollapsed();
  const { mode, setMode } = useSidebarRailMode();
  const { simpleMode } = useSimpleMode();
  const overlayOpen = !collapsed;

  const visibleGroups = visibleSidebarGroups(simpleMode);

  useEffect(() => {
    if (location.pathname.startsWith("/tasks")) {
      setLastTasksPath(location.pathname);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!overlayOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setCollapsed(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlayOpen, setCollapsed]);

  const chevronLabel = overlayOpen
    ? tCommon("ui.collapseSidebar")
    : tCommon("ui.expandSidebar");

  const chevron = (
    <button
      type="button"
      className="im-sidebar-edge-toggle"
      onClick={(event) => {
        event.stopPropagation();
        toggleCollapsed();
      }}
      aria-label={chevronLabel}
      title={chevronLabel}
      aria-expanded={overlayOpen}
      aria-controls="app-main-sidebar"
      data-testid="sidebar-edge-toggle"
    >
      {overlayOpen ? (
        <ChevronLeft size={16} strokeWidth={2.4} aria-hidden="true" />
      ) : (
        <ChevronRight size={16} strokeWidth={2.4} aria-hidden="true" />
      )}
    </button>
  );

  const collapsedReveal = (
    <div
      className="im-sidebar-edge-peek"
      data-collapsed="true"
      data-testid="sidebar-edge-peek"
    >
      {chevron}
    </div>
  );

  return (
    <>
      {overlayOpen ? null : createPortal(collapsedReveal, document.body)}
      {overlayOpen ? (
        <OverlayPortal scrim="light">
          <div
            className="im-sidebar-scrim fixed inset-0 z-[1500] flex justify-start bg-transparent"
            data-testid="app-sidebar-overlay"
            onClick={() => setCollapsed(true)}
          >
            <div
              className="relative flex h-full"
              onClick={(event) => event.stopPropagation()}
            >
            <nav
              id="app-main-sidebar"
              className="im-dialog-drawer im-dialog-drawer-start im-material-panel im-sidebar-panel relative flex h-full w-[var(--app-sidebar-width,200px)] shrink-0 flex-col items-stretch gap-0.5 overflow-x-hidden overflow-y-auto border-r border-[color-mix(in_srgb,var(--surface-border)_55%,transparent)] px-2 pb-3 pt-3 [-webkit-app-region:no-drag] [pointer-events:auto] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-label={t("mainNav")}
              data-testid="app-sidebar"
              data-collapsed="false"
              data-rail-mode={mode}
            >
              <div
                className="mb-2 flex h-8 shrink-0 items-center gap-1 px-0.5"
                role="tablist"
                aria-label={t("railMode")}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "nav"}
                  className={railModeButtonClass(mode === "nav", false)}
                  onClick={() => setMode("nav")}
                  aria-label={t("menu")}
                  title={t("menu")}
                  data-testid="sidebar-rail-nav"
                >
                  <Menu size={14} strokeWidth={2.2} aria-hidden="true" />
                  <span>{t("menu")}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "history"}
                  className={railModeButtonClass(mode === "history", false)}
                  onClick={() => setMode("history")}
                  aria-label={t("history")}
                  title={t("history")}
                  data-testid="sidebar-rail-history"
                >
                  <History size={14} strokeWidth={2.2} aria-hidden="true" />
                  <span>{t("history")}</span>
                </button>
              </div>

              {mode === "history" ? (
                <AssistantHistoryRail collapsed={false} />
              ) : (
                <>
                  {visibleGroups.map((group, groupIndex) => (
                    <div key={group.labelKey ?? `group-${groupIndex}`} className="flex flex-col gap-0.5">
                      {group.labelKey ? (
                        <SidebarSectionLabel label={t(group.labelKey)} collapsed={false} />
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
                              collapsed={false}
                              isActive={isActive}
                            />
                          );
                        }
                        return (
                          <SidebarNavLink
                            key={item.to}
                            to={item.to}
                            label={label}
                            collapsed={false}
                            isActive={isActive}
                            Icon={Icon}
                          />
                        );
                      })}
                    </div>
                  ))}
                  <div className="min-h-md flex-1" />
                  <div className="mx-1 my-2 h-px shrink-0 bg-[var(--surface-border-alpha,var(--surface-border))]" />
                  <div
                    className="mx-1 mb-1 mt-0.5 px-1 text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted"
                    aria-hidden="true"
                  >
                    {t("settingsSection")}
                  </div>
                  {SIDEBAR_BOTTOM_ITEMS.map((item) => {
                    const Icon = SIDEBAR_ICONS[item.icon];
                    const isActive = isSidebarItemActive(item, location.pathname);
                    const label = t(item.labelKey);
                    return (
                      <SidebarNavLink
                        key={item.to}
                        to={item.to}
                        label={label}
                        collapsed={false}
                        isActive={isActive}
                        Icon={Icon}
                        compactLabel
                      />
                    );
                  })}
                  <p
                    className="mt-sm px-2 text-[10px] leading-none text-text-muted/60"
                    title={t("appVersionTitle")}
                  >
                    {formatAppVersionLabel()}
                  </p>
                </>
              )}
            </nav>
              {chevron}
            </div>
          </div>
        </OverlayPortal>
      ) : null}
    </>
  );
}
