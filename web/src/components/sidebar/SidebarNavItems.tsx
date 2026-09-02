import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { prefetchRoute } from "../../routing/prefetchRoute";
import { sidebarNavLinkClass } from "./sidebarNavStyles";

export function SidebarSectionLabel({
  label,
  collapsed,
}: {
  label: string;
  collapsed: boolean;
}) {
  if (collapsed) {
    return (
      <div
        className="mx-1 my-1.5 h-px shrink-0 bg-[var(--surface-border-alpha,var(--surface-border))]"
        aria-hidden="true"
      />
    );
  }
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

export function SidebarNavLink({
  to,
  label,
  collapsed,
  isActive,
  Icon,
  compactLabel = false,
}: {
  to: string;
  label: string;
  collapsed: boolean;
  isActive: boolean;
  Icon: LucideIcon;
  /** Bottom settings links use a simpler label span. */
  compactLabel?: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={() => sidebarNavLinkClass(isActive, collapsed)}
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
      {!collapsed ? (
        compactLabel ? (
          <span className="max-[780px]:hidden">{label}</span>
        ) : (
          <span className="flex min-w-0 flex-1 items-center justify-between gap-1 max-[780px]:hidden">
            <span className="truncate">{label}</span>
          </span>
        )
      ) : null}
    </NavLink>
  );
}
