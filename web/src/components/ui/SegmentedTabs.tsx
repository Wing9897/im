import { useMemo } from "react";
import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSegmentedIndicator } from "../../hooks/useSegmentedIndicator";
import {
  segmentedIndicatorClass,
  segmentedNavClass,
  segmentedTabActiveClass,
  segmentedTabClass,
  segmentedTrackClass,
} from "./segmentedTabStyles";

export interface SegmentedTabItem {
  to: string;
  label: string;
  icon?: ReactNode;
}

interface SegmentedTabsProps {
  items: readonly SegmentedTabItem[];
  /** Accessible label for the nav element. */
  ariaLabel?: string;
  className?: string;
}

/** Full-width segmented workspace sub-navigation with sliding accent indicator. */
export function SegmentedTabs({
  items,
  ariaLabel,
  className,
}: SegmentedTabsProps) {
  const { t } = useTranslation("common");
  const location = useLocation();
  const activeIndex = useMemo(() => {
    const idx = items.findIndex((item) => {
      const base = item.to.replace(/\/$/, "");
      const path = location.pathname.replace(/\/$/, "");
      return path === base || path.startsWith(`${base}/`);
    });
    return idx >= 0 ? idx : 0;
  }, [items, location.pathname]);

  const { trackRef, setTabRef, indicatorStyle } = useSegmentedIndicator(activeIndex);
  const navCls = [segmentedNavClass, className ?? ""].filter(Boolean).join(" ");
  const resolvedAriaLabel = ariaLabel ?? t("ui.workspaceTabs");

  return (
    <nav className={navCls} aria-label={resolvedAriaLabel}>
      <div ref={trackRef} className={segmentedTrackClass}>
        <span
          className={segmentedIndicatorClass}
          style={indicatorStyle}
          aria-hidden="true"
          data-testid="segmented-indicator"
        />
        {items.map((item, index) => (
          <NavLink
            key={item.to}
            ref={setTabRef(index)}
            to={item.to}
            end
            className={({ isActive }) =>
              `${segmentedTabClass}${isActive ? ` is-active ${segmentedTabActiveClass}` : ""}`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
