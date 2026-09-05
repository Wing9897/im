import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ListChecks } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAnalysisStatus } from "../../context/AnalysisStatusContext";
import { prefetchRoute } from "../../routing/prefetchRoute";
import { CountBadge } from "../ui/CountBadge";
import { sidebarNavLinkClass } from "./sidebarNavStyles";

export function SidebarSectionLabel({ label }: { label: string }) {
  return (
    <div
      className="mx-1 mb-1 mt-2 px-1 text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted max-[780px]:hidden"
      aria-hidden="true"
      data-testid="sidebar-nav-group"
    >
      {label}
    </div>
  );
}

/** Isolated so SSE queue updates re-render only this nav item, not the whole rail. */
export function TasksNavLink({ isActive }: { isActive: boolean }) {
  const { t } = useTranslation("nav");
  const { queueStatus } = useAnalysisStatus();
  const pendingCount = queueStatus?.pendingCount ?? 0;
  const showPendingBadge = pendingCount > 0;
  const badgeLabel = pendingCount > 99 ? "99+" : String(pendingCount);
  const Icon = ListChecks;
  const tasksLabel = t("tasks");
  const to = "/tasks";

  return (
    <NavLink
      to={to}
      className={() => sidebarNavLinkClass(isActive)}
      aria-current={isActive ? "page" : false}
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
      </span>
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
    </NavLink>
  );
}

export function SidebarNavLink({
  to,
  label,
  isActive,
  Icon,
  compactLabel = false,
}: {
  to: string;
  label: string;
  isActive: boolean;
  Icon: LucideIcon;
  /** Bottom settings links use a simpler label span. */
  compactLabel?: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={() => sidebarNavLinkClass(isActive)}
      aria-current={isActive ? "page" : false}
      onMouseEnter={() => prefetchRoute(to)}
      onFocus={() => prefetchRoute(to)}
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
      {compactLabel ? (
        <Icon size={16} strokeWidth={2} aria-hidden="true" />
      ) : (
        <span className="relative inline-flex shrink-0">
          <Icon size={16} strokeWidth={2} aria-hidden="true" />
        </span>
      )}
      {compactLabel ? (
        <span className="max-[780px]:hidden">{label}</span>
      ) : (
        <span className="flex min-w-0 flex-1 items-center justify-between gap-1 max-[780px]:hidden">
          <span className="truncate">{label}</span>
        </span>
      )}
    </NavLink>
  );
}
