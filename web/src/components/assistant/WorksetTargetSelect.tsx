import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import { MenuSelect } from "../ui";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { useGeneralWorksetLabel } from "../../domain/timeline/useGeneralWorksetLabel";

export type WorksetTargetOption = {
  id: string;
  name: string;
};

/**
 * Presentational workset picker (all worksets including builtin ``__user__``).
 */
export function WorksetTargetSelectField({
  id,
  value,
  onChange,
  options,
  disabled,
  className,
  keepStaleOption = false,
  "data-testid": testId = "workset-target",
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (worksetId: string) => void;
  options: readonly WorksetTargetOption[];
  disabled?: boolean;
  className?: string;
  keepStaleOption?: boolean;
  "data-testid"?: string;
  "aria-label"?: string;
}) {
  const { t } = useTranslation(["assistant", "common"]);
  const generalWorksetLabel = useGeneralWorksetLabel();
  const normalized = value.trim() || SYSTEM_WORKSET_ID;
  const inOptions = options.some((opt) => opt.id === normalized);
  const selectValue = keepStaleOption || inOptions ? normalized : SYSTEM_WORKSET_ID;
  const showStale = keepStaleOption && !inOptions && normalized !== SYSTEM_WORKSET_ID;

  const menuOptions = useMemo(() => {
    const rows = [
      { value: SYSTEM_WORKSET_ID, label: generalWorksetLabel },
      ...(showStale ? [{ value: normalized, label: normalized }] : []),
      ...options
        .filter((opt) => opt.id !== SYSTEM_WORKSET_ID)
        .map((opt) => ({ value: opt.id, label: opt.name })),
    ];
    return rows;
  }, [generalWorksetLabel, normalized, options, showStale]);

  return (
    <MenuSelect
      id={id}
      variant="field"
      value={selectValue}
      options={menuOptions}
      onChange={onChange}
      disabled={disabled}
      className={className}
      data-testid={testId}
      aria-label={ariaLabel ?? t("assistant:targetWorkset.aria")}
    />
  );
}

/**
 * Target workset picker for assistant / calendar / voice defaults.
 */
export function WorksetTargetSelect({
  id,
  value,
  onChange,
  disabled,
  className,
  "data-testid": testId = "workset-target",
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (worksetId: string) => void;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
  "aria-label"?: string;
}) {
  const { worksets } = useTaskCatalog();
  const options = useMemo<WorksetTargetOption[]>(
    () => worksets.map((ws) => ({ id: ws.id, name: ws.name })),
    [worksets],
  );

  return (
    <WorksetTargetSelectField
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled}
      className={className}
      data-testid={testId}
      aria-label={ariaLabel}
    />
  );
}
