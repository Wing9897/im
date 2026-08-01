import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSegmentedIndicator } from "../../hooks/useSegmentedIndicator";
import {
  segmentedIndicatorClass,
  segmentedNavClass,
  segmentedNavInlineClass,
  segmentedTabActiveClass,
  segmentedTabClass,
  segmentedTabInlineClass,
  segmentedTrackClass,
  segmentedTrackInlineClass,
} from "./segmentedTabStyles";

export interface SegmentedControlItem {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface SegmentedControlProps {
  items: readonly SegmentedControlItem[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
  className?: string;
  /** full = page-width tabs; inline = compact toolbar toggle */
  layout?: "full" | "inline";
}

/** Stateful segmented control — same chrome as SegmentedTabs, without router links. */
export function SegmentedControl({
  items,
  value,
  onChange,
  ariaLabel,
  className,
  layout = "full",
}: SegmentedControlProps) {
  const { t } = useTranslation("common");
  const resolvedAria = ariaLabel ?? t("ui.tabs");
  const activeIndex = useMemo(
    () => Math.max(0, items.findIndex((item) => item.id === value)),
    [items, value],
  );

  const { trackRef, setTabRef, indicatorStyle } = useSegmentedIndicator(activeIndex);
  const isInline = layout === "inline";
  const navCls = [
    isInline ? segmentedNavInlineClass : segmentedNavClass,
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  const trackCls = isInline ? segmentedTrackInlineClass : segmentedTrackClass;
  const tabBaseCls = isInline ? segmentedTabInlineClass : segmentedTabClass;

  return (
    <nav className={navCls} aria-label={resolvedAria}>
      <div ref={trackRef} className={trackCls} role="tablist">
        <span
          className={segmentedIndicatorClass}
          style={indicatorStyle}
          aria-hidden="true"
          data-testid="segmented-indicator"
        />
        {items.map((item, index) => {
          const isActive = value === item.id;
          const tabCls = [
            tabBaseCls,
            "cursor-pointer border-none bg-transparent font-[inherit]",
            isActive ? segmentedTabActiveClass : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={item.id}
              ref={setTabRef(index)}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={tabCls}
              onClick={() => onChange(item.id)}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
