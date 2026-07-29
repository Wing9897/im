import React from "react";
import { useTranslation } from "react-i18next";
import { SelectField } from "./ui/TextField";

export type TimeFilterPreset = "today" | "1d" | "7d" | "30d";

interface TimeFilterProps {
  value: TimeFilterPreset;
  onChange: (preset: TimeFilterPreset) => void;
  className?: string;
}

export const TIME_FILTER_PRESETS: {
  key: TimeFilterPreset;
  labelKey: string;
}[] = [
  { key: "today", labelKey: "timeFilter.today" },
  { key: "1d", labelKey: "timeFilter.1d" },
  { key: "7d", labelKey: "timeFilter.7d" },
  { key: "30d", labelKey: "timeFilter.30d" },
];

/** Compact time-range select — replaces a row of preset chips to save toolbar space. */
export const TimeFilter = React.memo(function TimeFilter({
  value,
  onChange,
  className,
}: TimeFilterProps) {
  const { t } = useTranslation();

  return (
    <SelectField
      value={value}
      onChange={(e) => onChange(e.target.value as TimeFilterPreset)}
      aria-label={t("timeFilter.aria")}
      className={[
        "h-9 w-auto min-w-[5.5rem] max-w-[7rem] text-sm font-medium",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {TIME_FILTER_PRESETS.map(({ key, labelKey }) => (
        <option key={key} value={key}>
          {t(labelKey)}
        </option>
      ))}
    </SelectField>
  );
});
