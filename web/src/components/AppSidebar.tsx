import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BellRing,
  Bot,
  Bookmark,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Package,
  Database,
  History,
  Layers,
  ListChecks,
  MapPin,
  Menu,
  MessageSquare,
  Pin,
  PinOff,
  Radio,
  Settings,
  Trophy,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSidebarCollapsed } from "../hooks/useSidebarCollapsed";
import { useSidebarPinned } from "../hooks/useSidebarPinned";
import { useSidebarRailMode } from "../hooks/useSidebarRailMode";
import { useSimpleMode } from "../context/SimpleModeContext";
import { useMonitorMode } from "../context/MonitorModeContext";
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
import { railModeButtonClass } from "./sidebarNavStyles";
import {
  SidebarNavLink,
  SidebarSectionLabel,
  TasksNavLink,
} from "./SidebarNavItems";

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
  subscriptions: Bookmark,
  notify: BellRing,
  assistant: MessageSquare,
  ai: Bot,
  settings: Settings,
  account: User,
};

function pinButtonClass(pinned: boolean): string {
  return [
    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-none transition-[background,color] duration-150",
    pinned
      ? "bg-[color-mix(in_srgb,var(--text-primary)_8%,transparent)] text-text-primary"
      : "bg-transparent text-text-muted hover:bg-[color-mix(in_srgb,var(--text-primary)_4%,transparent)] hover:text-text-primary",
  ].join(" ");
}

/**
 * Global left navigation.
 *
 * Unpinned: overlay drawer (matches 通知 RecentDayInboxDrawer: OverlayPortal +
 * light scrim + frosted im-dialog-drawer). Does not push page layout.
 * Pinned: docked rail that occupies `--app-sidebar-width`; App.tsx pads the
 * pages pane so main content is not overlayed. Esc / backdrop do not dismiss.
 *
 * Pages + canvas: this chrome is for pages mode. On ops board (canvas) the
 * component returns null so the left-edge `>` chevron never sits on the
 * immersive canvas. App.tsx also skips mounting it in canvas.
 */
export function AppSidebar() {
  const location = useLocation();
  const { t } = useTranslation("nav");
  const { t: tCommon } = useTranslation("common");
  const { collapsed, setCollapsed, toggleCollapsed } = useSidebarCollapsed();
  const { pinned, setPinned } = useSidebarPinned();
  const { mode, setMode } = useSidebarRailMode();
  const { simpleMode } = useSimpleMode();
  const { monitorMode } = useMonitorMode();
  const overlayOpen = !collapsed;

  const visibleGroups = visibleSidebarGroups(simpleMode);

  useEffect(() => {
    if (monitorMode === "canvas") {
      setCollapsed(true);
    }
  }, [monitorMode, setCollapsed]);

  useEffect(() => {
    if (monitorMode === "canvas" || pinned || !overlayOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setCollapsed(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [monitorMode, pinned, overlayOpen, setCollapsed]);

  if (monitorMode === "canvas") {
    return null;
  }

  const pinLabel = pinned ? tCommon("ui.unpinSidebar") : tCommon("ui.pinSidebar");
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
      data-testid="sidebar-edge-peek"
    >
      {chevron}
    </div>
  );

  if (!pinned && !overlayOpen) {
    return createPortal(collapsedReveal, document.body);
  }

  const sidebarNav = (
            <nav
              id="app-main-sidebar"
              className={[
                "im-material-panel im-sidebar-panel flex h-full min-h-0 w-[var(--app-sidebar-width,200px)] shrink-0 flex-col items-stretch border-r border-[color-mix(in_srgb,var(--surface-border)_55%,transparent)] [-webkit-app-region:no-drag] [pointer-events:auto]",
                pinned
                  ? "im-sidebar-docked"
                  : "relative im-dialog-drawer im-dialog-drawer-start",
              ].join(" ")}
              aria-label={t("mainNav")}
              data-testid="app-sidebar"
              data-pinned={pinned ? "true" : "false"}
              data-rail-mode={mode}
            >
              <div className="shrink-0 px-2 pt-3">
              <div className="mb-2 flex h-8 shrink-0 items-center gap-1 px-0.5">
              <div
                className="flex min-w-0 flex-1 items-center gap-1"
                role="tablist"
                aria-label={t("railMode")}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "nav"}
                  className={railModeButtonClass(mode === "nav")}
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
                  className={railModeButtonClass(mode === "history")}
                  onClick={() => setMode("history")}
                  aria-label={t("history")}
                  title={t("history")}
                  data-testid="sidebar-rail-history"
                >
                  <History size={14} strokeWidth={2.2} aria-hidden="true" />
                  <span>{t("history")}</span>
                </button>
              </div>
              <button
                type="button"
                className={pinButtonClass(pinned)}
                onClick={() => {
                  if (!pinned) setCollapsed(false);
                  setPinned(!pinned);
                }}
                aria-pressed={pinned}
                aria-label={pinLabel}
                title={pinLabel}
                data-testid="sidebar-pin"
              >
                {pinned ? (
                  <PinOff size={14} strokeWidth={2.2} aria-hidden="true" />
                ) : (
                  <Pin size={14} strokeWidth={2.2} aria-hidden="true" />
                )}
              </button>
              </div>
              </div>

              {mode === "history" ? (
                <div className="im-auto-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 pb-3">
                  <AssistantHistoryRail />
                </div>
              ) : (
                <>
                  <div
                    className="im-auto-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2"
                    data-testid="app-sidebar-nav-scroll"
                  >
                    <div className="flex flex-col gap-0.5">
                      {visibleGroups.map((group, groupIndex) => (
                        <div key={group.labelKey ?? `group-${groupIndex}`} className="flex flex-col gap-0.5">
                          {group.labelKey ? (
                            <SidebarSectionLabel label={t(group.labelKey)} />
                          ) : null}
                          {group.items.map((item) => {
                            const Icon = SIDEBAR_ICONS[item.icon];
                            const isActive = isSidebarItemActive(item, location.pathname);
                            const label = t(item.labelKey);
                            if (item.to === "/tasks") {
                              return (
                                <TasksNavLink
                                  key={item.to}
                                  isActive={isActive}
                                />
                              );
                            }
                            return (
                              <SidebarNavLink
                                key={item.to}
                                to={item.to}
                                label={label}
                                isActive={isActive}
                                Icon={Icon}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0 px-2 pb-3">
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
                  </div>
                </>
              )}
            </nav>
  );

  if (pinned) {
    return sidebarNav;
  }

  return (
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
          {sidebarNav}
          {chevron}
        </div>
      </div>
    </OverlayPortal>
  );
}
