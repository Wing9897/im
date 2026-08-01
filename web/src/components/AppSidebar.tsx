import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BellRing,
  Bot,
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
import { useAnalysisStatus } from "../context/AnalysisStatusContext";
import { useSidebarCollapsed } from "../hooks/useSidebarCollapsed";
import { useSidebarRailMode } from "../hooks/useSidebarRailMode";
import { useSimpleMode } from "../context/SimpleModeContext";
import { isSimpleModeHiddenPath } from "../domain/ui/simpleMode";
import { prefetchRoute } from "../routing/prefetchRoute";
import { formatAppVersionLabel } from "../utils/appVersion";
import { CountBadge } from "./ui/CountBadge";
import { AssistantHistoryRail } from "./AssistantHistoryRail";

interface SidebarNavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  /** Route prefix that marks this item active (defaults to exact match on `to`). */
  activePrefix?: string;
}

const mainNavItems: readonly SidebarNavItem[] = [
  { to: "/monitor", labelKey: "monitor", icon: Radio },
  { to: "/tasks", labelKey: "tasks", icon: ListChecks, activePrefix: "/tasks" },
  { to: "/leaderboard", labelKey: "leaderboard", icon: Trophy },
  { to: "/intelligence", labelKey: "keyEvents", icon: MapPin },
  { to: "/timeline", labelKey: "timeline", icon: CalendarDays },
  { to: "/items", labelKey: "items", icon: Package },
  { to: "/actions", labelKey: "actions", icon: BellRing },
  { to: "/accounts", labelKey: "sources", icon: Database, activePrefix: "/accounts" },
  { to: "/assistant", labelKey: "assistant", icon: MessageSquare },
];

const bottomNavItems: readonly SidebarNavItem[] = [
  { to: "/ai/provider", labelKey: "aiSettings", icon: Bot, activePrefix: "/ai" },
  { to: "/settings", labelKey: "systemSettings", icon: Settings, activePrefix: "/settings" },
  { to: "/account/identity", labelKey: "account", icon: User },
];

/** Primary sidebar paths for idle prefetch after App ready. */
export const MAIN_SIDEBAR_PREFETCH_PATHS: readonly string[] = mainNavItems.map(
  (item) => item.to,
);

const sidebarNavLinkClass = (isActive: boolean, collapsed: boolean) =>
  [
    "group relative flex min-h-8 cursor-pointer flex-row items-center rounded-md border border-transparent text-[12px] font-medium leading-tight text-text-secondary no-underline transition-[background,color] duration-150 ease-out [-webkit-app-region:no-drag] [pointer-events:auto]",
    collapsed ? "justify-center px-0 py-1.5" : "gap-2.5 px-2.5 py-1.5",
    isActive
      ? "bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] text-text-primary [&_svg]:text-accent"
      : "hover:bg-[color-mix(in_srgb,var(--text-primary)_4%,transparent)] hover:text-text-primary",
  ].join(" ");

const railModeButtonClass = (active: boolean, collapsed: boolean) =>
  [
    "inline-flex min-h-7 flex-1 items-center justify-center gap-1 rounded-md border-none text-[11px] font-medium transition-[background,color] duration-150",
    collapsed ? "px-0" : "px-1.5",
    active
      ? "bg-[color-mix(in_srgb,var(--text-primary)_8%,transparent)] text-text-primary"
      : "bg-transparent text-text-muted hover:bg-[color-mix(in_srgb,var(--text-primary)_4%,transparent)] hover:text-text-primary",
  ].join(" ");

/** Isolated so SSE queue updates re-render only this nav item, not the whole rail. */
function TasksNavLink({
  to,
  collapsed,
  isActive,
}: {
  to: string;
  collapsed: boolean;
  isActive: boolean;
}) {
  const { t } = useTranslation("nav");
  const { queueStatus } = useAnalysisStatus();
  const pendingCount = queueStatus?.pendingCount ?? 0;
  const showPendingBadge = pendingCount > 0;
  const badgeLabel = pendingCount > 99 ? "99+" : String(pendingCount);
  const Icon = ListChecks;
  const tasksLabel = t("tasks");

  return (
    <NavLink
      to={to}
      className={sidebarNavLinkClass(isActive, collapsed)}
      onMouseEnter={() => prefetchRoute(to)}
      onFocus={() => prefetchRoute(to)}
      aria-label={
        showPendingBadge ? t("tasksPendingAria", { count: pendingCount }) : tasksLabel
      }
      title={
        showPendingBadge
          ? t("tasksPendingTitle", { count: pendingCount })
          : tasksLabel
      }
      data-testid="sidebar-link"
    >
      {isActive ? (
        <span
          className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent max-[780px]:hidden"
          aria-hidden="true"
        />
      ) : null}
      <span className="relative inline-flex shrink-0">
        <Icon size={16} strokeWidth={2} aria-hidden="true" />
        {showPendingBadge && collapsed ? (
          <span
            className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-accent"
            aria-hidden="true"
          />
        ) : null}
      </span>
      {!collapsed ? (
        <span className="flex min-w-0 flex-1 items-center justify-between gap-1 max-[780px]:hidden">
          <span className="truncate">{tasksLabel}</span>
          {showPendingBadge ? (
            <CountBadge
              count={pendingCount > 99 ? 99 : pendingCount}
              aria-label={t("pendingAnalysisBadge", { count: badgeLabel })}
              className="min-w-[18px] px-1 text-[9px]"
            />
          ) : null}
        </span>
      ) : null}
    </NavLink>
  );
}

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
  const visibleMainNav = simpleMode
    ? mainNavItems.filter((item) => !isSimpleModeHiddenPath(item.to))
    : mainNavItems;

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

  const isItemActive = (item: SidebarNavItem) => {
    if (item.activePrefix) {
      // AI settings: only /ai/* (assistant is a top-level /assistant page).
      if (item.activePrefix === "/ai") {
        return location.pathname.startsWith("/ai");
      }
      return location.pathname.startsWith(item.activePrefix);
    }
    return location.pathname === item.to;
  };

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
          {visibleMainNav.map((item) => {
            const Icon = item.icon;
            const isActive = isItemActive(item);
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
              <NavLink
                key={item.to}
                to={item.to}
                className={sidebarNavLinkClass(isActive, hideLabel)}
                onMouseEnter={() => prefetchRoute(item.to)}
                onFocus={() => prefetchRoute(item.to)}
                aria-label={label}
                title={label}
                data-testid="sidebar-link"
              >
                {isActive ? (
                  <span
                    className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent max-[780px]:hidden"
                    aria-hidden="true"
                  />
                ) : null}
                <span className="relative inline-flex shrink-0">
                  <Icon size={16} strokeWidth={2} aria-hidden="true" />
                </span>
                {!hideLabel ? (
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-1 max-[780px]:hidden">
                    <span className="truncate">{label}</span>
                  </span>
                ) : null}
              </NavLink>
            );
          })}
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
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = isItemActive(item);
            const label = t(item.labelKey);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={sidebarNavLinkClass(isActive, hideLabel)}
                onMouseEnter={() => prefetchRoute(item.to)}
                onFocus={() => prefetchRoute(item.to)}
                aria-label={label}
                title={label}
                data-testid="sidebar-link"
              >
                {isActive ? (
                  <span
                    className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent max-[780px]:hidden"
                    aria-hidden="true"
                  />
                ) : null}
                <Icon size={16} strokeWidth={2} aria-hidden="true" />
                {!hideLabel ? (
                  <span className="max-[780px]:hidden">{label}</span>
                ) : null}
              </NavLink>
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
