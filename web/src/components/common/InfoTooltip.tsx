import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FloatingTooltip } from "./FloatingTooltip";

interface InfoTooltipProps {
  content: string | string[];
  /** Accessible name for the ? control (default: ui.infoTooltip). */
  ariaLabel?: string;
}

export function InfoTooltip({ content, ariaLabel }: InfoTooltipProps) {
  const { t } = useTranslation("common");
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useId();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const resolvedAriaLabel = ariaLabel ?? t("ui.infoTooltip");

  const contentArray = Array.isArray(content) ? content : [content];

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <button
        ref={anchorRef}
        type="button"
        aria-label={resolvedAriaLabel}
        aria-describedby={isVisible ? tooltipId : undefined}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setIsVisible(false);
        }}
        className={`flex h-[18px] w-[18px] cursor-help items-center justify-center rounded-full border-[1.5px] border-info p-0 text-caption font-bold text-info transition-colors ${
          isVisible
            ? "bg-[color-mix(in_srgb,var(--info)_15%,transparent)]"
            : "bg-transparent"
        }`}
      >
        ?
      </button>

      <FloatingTooltip
        open={isVisible}
        anchorRef={anchorRef}
        id={tooltipId}
        testId="info-tooltip"
        className="min-w-[280px] max-w-[360px] px-md py-md"
      >
        <div className="text-caption leading-relaxed text-text-secondary">
          {contentArray.length === 1 ? (
            <div>{contentArray[0]}</div>
          ) : (
            <ul className="m-0 flex list-disc flex-col gap-xs pl-lg">
              {contentArray.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      </FloatingTooltip>
    </div>
  );
}
