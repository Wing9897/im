import { useTranslation } from "react-i18next";

import { PlatformIcon } from "../common/PlatformIcon";
import { FilterChip } from "../ui/FilterChip";
import { platformDisplayLabel } from "../../utils/platformRegistry";

interface PlatformFilterChipsProps {
  platforms: string[];
  selectedPlatform: string;
  onSelect: (platform: string | undefined) => void;
  ariaLabel?: string;
  /** Segmented control groups chips in a single bordered pill row. */
  variant?: "chips" | "segmented";
}

/** Shared platform pill row for monitor filters and wall channel picker. */
export function PlatformFilterChips({
  platforms,
  selectedPlatform,
  onSelect,
  ariaLabel,
  variant = "chips",
}: PlatformFilterChipsProps) {
  const { t } = useTranslation("common");
  if (platforms.length === 0) return null;

  const groupClass =
    variant === "segmented"
      ? "inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg border border-surface-border bg-[color-mix(in_srgb,var(--surface-overlay)_45%,transparent)] p-0.5"
      : "flex flex-wrap gap-sm";

  const chipVariant = variant === "segmented" ? "segmented" : "default";

  return (
    <div
      role="group"
      aria-label={ariaLabel ?? t("channelPicker.platformFilterAria")}
      className={groupClass}
    >
      <FilterChip
        active={selectedPlatform === ""}
        onClick={() => onSelect(undefined)}
        className={chipVariant === "segmented" ? "border-none shadow-none" : undefined}
      >
        {t("channelPicker.all")}
      </FilterChip>
      {platforms.map((platform) => (
        <FilterChip
          key={platform}
          active={selectedPlatform === platform}
          onClick={() => onSelect(platform)}
          className={chipVariant === "segmented" ? "border-none shadow-none" : undefined}
        >
          <PlatformIcon platform={platform} size={14} className="shrink-0" />
          {platformDisplayLabel(platform)}
        </FilterChip>
      ))}
    </div>
  );
}
